import type { CreateJobDraftSelectionV1, CreateJobDraftTelemetryEvent } from '@banyone/contracts';
import * as ImagePicker from 'expo-image-picker';
import { getInfoAsync } from 'expo-file-system/legacy';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  initialJobInputSelectionState,
  jobInputSelectionReducer,
} from '@/features/create-job/hooks/job-input-selection-reducer';
import type { JobInputSelectionState } from '@/features/create-job/types/selection';
import {
  copyPickedAssetToSandbox,
  deleteIfManagedLocalFile,
} from '@/features/create-job/services/copy-media-to-sandbox';
import {
  buildDraftPayload,
  clearCreateJobDraft,
  loadCreateJobDraft,
  saveCreateJobDraft,
} from '@/features/create-job/services/job-draft-storage';
import {
  durationSecFromAssetDuration,
  extensionFromFileNameOrUri,
  mimeTypeFromExtension,
} from '@/features/create-job/utils/media-mime';

function emitDraftTelemetry(event: CreateJobDraftTelemetryEvent): void {
  console.info(`telemetry.${event.event}.v1`, event);
}

function labelFromAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  return asset.fileName ?? asset.uri.split('/').pop() ?? null;
}

function mimeTypeFromAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.mimeType) return asset.mimeType;

  const maybeType = (asset as { type?: unknown }).type;
  if (typeof maybeType === 'string' && maybeType.includes('/')) return maybeType;

  const ext = extensionFromFileNameOrUri(asset.fileName ?? asset.uri);
  return mimeTypeFromExtension(ext);
}

/** Re-exported for tests and legacy imports; prefer `@/features/create-job/utils/media-mime`. */
export {
  durationSecFromAssetDuration,
  extensionFromFileNameOrUri,
  mimeTypeFromExtension,
} from '@/features/create-job/utils/media-mime';

function selectionToDraftShape(state: JobInputSelectionState): CreateJobDraftSelectionV1 {
  return { ...state };
}

async function verifyLocalUrisExist(selection: CreateJobDraftSelectionV1): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const uris = [selection.videoUri, selection.imageUri].filter(Boolean) as string[];
  for (const uri of uris) {
    if (!uri.startsWith('file://')) continue;
    try {
      const info = await getInfoAsync(uri);
      if (!info.exists) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const DEBOUNCE_MS = 450;

export function useJobInputSelection() {
  const [state, dispatch] = useReducer(jobInputSelectionReducer, initialJobInputSelectionState);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const [draftRestoreNotice, setDraftRestoreNotice] = useState<'restored' | 'corrupted' | null>(null);
  const [pendingIdempotencyKey, setPendingIdempotencyKey] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After a successful job submit we clear storage; block auto-save until the user changes picks. */
  const suppressDraftSaveRef = useRef(false);
  const stateRef = useRef(state);
  const pendingKeyRef = useRef(pendingIdempotencyKey);
  stateRef.current = state;
  pendingKeyRef.current = pendingIdempotencyKey;

  const persistDraftNow = useCallback(async () => {
    if (suppressDraftSaveRef.current) return;
    const draft = buildDraftPayload({
      selection: selectionToDraftShape(stateRef.current),
      pendingIdempotencyKey: pendingKeyRef.current,
    });
    await saveCreateJobDraft(draft);
    emitDraftTelemetry({
      event: 'create_job_draft_saved',
      hasVideo: Boolean(stateRef.current.videoUri),
      hasImage: Boolean(stateRef.current.imageUri),
      hadPendingIdempotencyKey: Boolean(pendingKeyRef.current),
    });
  }, []);

  const dismissDraftNotice = useCallback(() => {
    setDraftRestoreNotice(null);
  }, []);

  const clearPersistedDraftAfterAcceptedJob = useCallback(async () => {
    await clearCreateJobDraft();
    setPendingIdempotencyKey(null);
    suppressDraftSaveRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await loadCreateJobDraft();
      if (cancelled) return;
      if (!d) {
        setIsRestoringDraft(false);
        return;
      }
      const ok = await verifyLocalUrisExist(d.selection);
      if (!ok) {
        await clearCreateJobDraft();
        if (!cancelled) {
          setDraftRestoreNotice('corrupted');
          emitDraftTelemetry({
            event: 'create_job_draft_discarded',
            hasVideo: false,
            hasImage: false,
          });
        }
        setIsRestoringDraft(false);
        return;
      }
      dispatch({
        type: 'hydrate',
        state: { ...initialJobInputSelectionState, ...d.selection },
      });
      setPendingIdempotencyKey(d.pendingIdempotencyKey ?? null);
      setDraftRestoreNotice('restored');
      emitDraftTelemetry({
        event: 'create_job_draft_loaded',
        hasVideo: Boolean(d.selection.videoUri),
        hasImage: Boolean(d.selection.imageUri),
        hadPendingIdempotencyKey: Boolean(d.pendingIdempotencyKey),
      });
      setIsRestoringDraft(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isRestoringDraft) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistDraftNow();
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, pendingIdempotencyKey, isRestoringDraft, persistDraftNow]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (!isRestoringDraft) void persistDraftNow();
      }
    });
    return () => sub.remove();
  }, [isRestoringDraft, persistDraftNow]);

  const ensureLibraryPermission = useCallback(async (): Promise<boolean> => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.granted) return true;
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return requested.granted;
  }, []);

  const pickVideo = useCallback(async (): Promise<void> => {
    suppressDraftSaveRef.current = false;
    const ok = await ensureLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await deleteIfManagedLocalFile(stateRef.current.videoUri);
    const { uri } = await copyPickedAssetToSandbox({
      sourceUri: asset.uri,
      kind: 'video',
      label: labelFromAsset(asset),
    });
    dispatch({
      type: 'set_video',
      uri,
      label: labelFromAsset(asset),
      durationSec: durationSecFromAssetDuration(asset.duration),
      widthPx: asset.width ?? null,
      heightPx: asset.height ?? null,
      mimeType: mimeTypeFromAsset(asset),
    });
  }, [ensureLibraryPermission]);

  const pickImage = useCallback(async (): Promise<void> => {
    suppressDraftSaveRef.current = false;
    const ok = await ensureLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await deleteIfManagedLocalFile(stateRef.current.imageUri);
    const { uri } = await copyPickedAssetToSandbox({
      sourceUri: asset.uri,
      kind: 'image',
      label: labelFromAsset(asset),
    });
    dispatch({
      type: 'set_image',
      uri,
      label: labelFromAsset(asset),
      widthPx: asset.width ?? null,
      heightPx: asset.height ?? null,
      mimeType: mimeTypeFromAsset(asset),
    });
  }, [ensureLibraryPermission]);

  const clearVideo = useCallback(() => {
    suppressDraftSaveRef.current = false;
    void deleteIfManagedLocalFile(stateRef.current.videoUri);
    dispatch({ type: 'clear_video' });
  }, []);

  const clearImage = useCallback(() => {
    suppressDraftSaveRef.current = false;
    void deleteIfManagedLocalFile(stateRef.current.imageUri);
    dispatch({ type: 'clear_image' });
  }, []);

  return {
    state,
    pickVideo,
    pickImage,
    clearVideo,
    clearImage,
    isRestoringDraft,
    draftRestoreNotice,
    dismissDraftNotice,
    pendingIdempotencyKey,
    setPendingIdempotencyKey,
    clearPersistedDraftAfterAcceptedJob,
  };
}
