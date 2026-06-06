import React from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { DEFAULT_QUALITY_TIER, type PreviewExportEventName } from '@banyone/contracts';

import { useBanyoneAuth } from '@/features/auth/auth-context';
import { emitJobExperienceMetrics, emitPreviewExportTelemetry } from '@/infra/telemetry';

import { createReadyExport, fetchReadyPreview } from '../services/preview-export-api';
import type { PreviewPayload, PreviewStage } from '../types/preview-export';

function mapErrorCopy(code: string): string {
  switch (code) {
    case 'ABUSE_RESTRICTION_ACTIVE':
      return 'This account is currently restricted from preview/export actions.';
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

export function usePreviewExport(
  jobId: string | null,
  status: 'queued' | 'processing' | 'ready' | 'failed' | null,
  options?: {
    qualityTier?: number;
    serverTimeToPreviewMs?: number | null;
  },
) {
  const qualityTier = options?.qualityTier ?? DEFAULT_QUALITY_TIER;
  const serverTtp = options?.serverTimeToPreviewMs;
  const { getIdToken } = useBanyoneAuth();

  const trackPreviewExport = React.useCallback(
    (event: PreviewExportEventName, code?: string) => {
      if (!jobId) return;
      emitPreviewExportTelemetry({
        event,
        funnelStage: 'preview_export',
        jobId,
        qualityTier,
        ...(code ? { code } : {}),
      });
      emitJobExperienceMetrics({
        metricKind: 'preview_export_step',
        jobId,
        qualityTier,
        previewExportEvent: event,
        ...(serverTtp !== undefined ? { serverTimeToPreviewMs: serverTtp } : {}),
      });
    },
    [jobId, qualityTier, serverTtp],
  );

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
        trackPreviewExport('preview_viewed');
        return;
      }

      setState((prev) => ({
        ...prev,
        stage: 'failed-preview',
        errorCode: result.error.code,
        errorMessage:
          result.error.code === 'RATE_LIMITED' || result.error.code === 'ABUSE_RESTRICTION_ACTIVE'
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
  }, [getIdToken, jobId, status, trackPreviewExport]);

  React.useEffect(() => {
    if (!jobId || status !== 'ready') return;
    void loadPreview();
  }, [jobId, status, loadPreview]);

  const exportToLibrary = React.useCallback(async () => {
    if (!jobId) return;
    setState((prev) => ({ ...prev, isExporting: true, errorCode: null, errorMessage: null }));
    trackPreviewExport('export_started');

    try {
      const result = await createReadyExport(jobId, getIdToken);
      if (result.error !== null) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          errorCode: result.error.code,
          errorMessage:
            result.error.code === 'RATE_LIMITED' || result.error.code === 'ABUSE_RESTRICTION_ACTIVE'
              ? result.error.message
              : mapErrorCopy(result.error.code),
        }));
        trackPreviewExport('export_failed', result.error.code);
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
        trackPreviewExport('export_failed', 'MEDIA_LIBRARY_PERMISSION_DENIED');
        return;
      }

      if (!result.data.exportUri.startsWith('file:///')) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          errorCode: 'EXPORT_LOCAL_URI_REQUIRED',
          errorMessage: mapErrorCopy('EXPORT_LOCAL_URI_REQUIRED'),
        }));
        trackPreviewExport('export_failed', 'EXPORT_LOCAL_URI_REQUIRED');
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
      trackPreviewExport('export_succeeded');
    } catch {
      setState((prev) => ({
        ...prev,
        isExporting: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: mapErrorCopy('NETWORK_ERROR'),
      }));
      trackPreviewExport('export_failed', 'NETWORK_ERROR');
    }
  }, [getIdToken, jobId, trackPreviewExport]);

  const shareExported = React.useCallback(async () => {
    if (!jobId || !state.exportedFileUri) return;
    setState((prev) => ({ ...prev, isSharing: true, errorCode: null, errorMessage: null }));
    trackPreviewExport('share_opened');

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
      trackPreviewExport('share_completed');
    } catch {
      setState((prev) => ({ ...prev, isSharing: false }));
      trackPreviewExport('share_dismissed');
    }
  }, [jobId, state.exportedFileUri, trackPreviewExport]);

  return {
    ...state,
    canShare: Boolean(state.exportedFileUri),
    retryPreview: loadPreview,
    exportToLibrary,
    shareExported,
  };
}
