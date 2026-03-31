import React from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { PreviewExportEvent } from '@banyone/contracts';

import { useBanyoneAuth } from '@/features/auth/auth-context';

import { createReadyExport, fetchReadyPreview } from '../services/preview-export-api';
import type { PreviewPayload, PreviewStage } from '../types/preview-export';

function mapErrorCopy(code: string): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'This action is temporarily limited. Please wait and try again.';
    case 'PREVIEW_LOAD_FAILED':
      return 'Preview is temporarily unavailable. Retry to load it again.';
    case 'EXPORT_PREPARATION_FAILED':
      return 'Export could not be prepared. Retry without leaving this screen.';
    case 'MEDIA_LIBRARY_PERMISSION_DENIED':
      return 'Allow photo library access to export this result.';
    case 'SHARING_UNAVAILABLE':
      return 'Sharing is unavailable on this device.';
    case 'EXPORT_LOCAL_URI_REQUIRED':
      return 'Export file is not ready on this device. Retry export.';
    default:
      return 'Something went wrong. Retry this action.';
  }
}

type HookState = {
  stage: PreviewStage;
  preview: PreviewPayload | null;
  isExporting: boolean;
  isSharing: boolean;
  exportedFileUri: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function emitPreviewExportEvent(event: PreviewExportEvent): void {
  console.info(`telemetry.${event.event}.v1`, event);
}

export function usePreviewExport(jobId: string | null, status: 'queued' | 'processing' | 'ready' | 'failed' | null) {
  const { getIdToken } = useBanyoneAuth();
  const [state, setState] = React.useState<HookState>({
    stage: 'loading',
    preview: null,
    isExporting: false,
    isSharing: false,
    exportedFileUri: null,
    errorCode: null,
    errorMessage: null,
  });

  const loadPreview = React.useCallback(async () => {
    if (!jobId || status !== 'ready') return;
    setState((prev) => ({ ...prev, stage: 'loading', errorCode: null, errorMessage: null }));

    try {
      const result = await fetchReadyPreview(jobId, getIdToken);
      if (result.error === null) {
        setState((prev) => ({
          ...prev,
          stage: 'ready',
          preview: result.data,
          errorCode: null,
          errorMessage: null,
        }));
        emitPreviewExportEvent({ event: 'preview_viewed', jobId });
        return;
      }

      setState((prev) => ({
        ...prev,
        stage: 'failed-preview',
        errorCode: result.error.code,
        errorMessage:
          result.error.code === 'RATE_LIMITED'
            ? result.error.message
            : mapErrorCopy(result.error.code),
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        stage: 'failed-preview',
        errorCode: 'NETWORK_ERROR',
        errorMessage: mapErrorCopy('NETWORK_ERROR'),
      }));
    }
  }, [getIdToken, jobId, status]);

  React.useEffect(() => {
    if (!jobId || status !== 'ready') return;
    void loadPreview();
  }, [jobId, status, loadPreview]);

  const exportToLibrary = React.useCallback(async () => {
    if (!jobId) return;
    setState((prev) => ({ ...prev, isExporting: true, errorCode: null, errorMessage: null }));
    emitPreviewExportEvent({ event: 'export_started', jobId });

    try {
      const result = await createReadyExport(jobId, getIdToken);
      if (result.error !== null) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          errorCode: result.error.code,
          errorMessage:
            result.error.code === 'RATE_LIMITED'
              ? result.error.message
              : mapErrorCopy(result.error.code),
        }));
        emitPreviewExportEvent({ event: 'export_failed', jobId, code: result.error.code });
        return;
      }

      const { status: permissionStatus } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (permissionStatus !== 'granted') {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          errorCode: 'MEDIA_LIBRARY_PERMISSION_DENIED',
          errorMessage: mapErrorCopy('MEDIA_LIBRARY_PERMISSION_DENIED'),
        }));
        emitPreviewExportEvent({ event: 'export_failed', jobId, code: 'MEDIA_LIBRARY_PERMISSION_DENIED' });
        return;
      }

      if (!result.data.exportUri.startsWith('file:///')) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          errorCode: 'EXPORT_LOCAL_URI_REQUIRED',
          errorMessage: mapErrorCopy('EXPORT_LOCAL_URI_REQUIRED'),
        }));
        emitPreviewExportEvent({ event: 'export_failed', jobId, code: 'EXPORT_LOCAL_URI_REQUIRED' });
        return;
      }

      await MediaLibrary.saveToLibraryAsync(result.data.exportUri);
      setState((prev) => ({
        ...prev,
        isExporting: false,
        exportedFileUri: result.data.exportUri,
        errorCode: null,
        errorMessage: null,
      }));
      emitPreviewExportEvent({ event: 'export_succeeded', jobId });
    } catch {
      setState((prev) => ({
        ...prev,
        isExporting: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: mapErrorCopy('NETWORK_ERROR'),
      }));
      emitPreviewExportEvent({ event: 'export_failed', jobId, code: 'NETWORK_ERROR' });
    }
  }, [getIdToken, jobId]);

  const shareExported = React.useCallback(async () => {
    if (!jobId || !state.exportedFileUri) return;
    setState((prev) => ({ ...prev, isSharing: true, errorCode: null, errorMessage: null }));
    emitPreviewExportEvent({ event: 'share_opened', jobId });

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setState((prev) => ({
          ...prev,
          isSharing: false,
          errorCode: 'SHARING_UNAVAILABLE',
          errorMessage: mapErrorCopy('SHARING_UNAVAILABLE'),
        }));
        return;
      }

      await Sharing.shareAsync(state.exportedFileUri, {
        mimeType: 'video/mp4',
      });
      setState((prev) => ({ ...prev, isSharing: false }));
      emitPreviewExportEvent({ event: 'share_completed', jobId });
    } catch {
      setState((prev) => ({ ...prev, isSharing: false }));
      emitPreviewExportEvent({ event: 'share_dismissed', jobId });
    }
  }, [jobId, state.exportedFileUri]);

  return {
    ...state,
    canShare: Boolean(state.exportedFileUri),
    retryPreview: loadPreview,
    exportToLibrary,
    shareExported,
  };
}
