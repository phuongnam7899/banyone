import * as ImagePicker from 'expo-image-picker';
import { useCallback, useReducer } from 'react';

import {
  initialJobInputSelectionState,
  jobInputSelectionReducer,
} from '@/features/create-job/hooks/job-input-selection-reducer';

function labelFromAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  return asset.fileName ?? asset.uri.split('/').pop() ?? null;
}

export function extensionFromFileNameOrUri(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = value.split('?')[0];
  const lastSegment = clean.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

export function mimeTypeFromExtension(ext: string | null): string | null {
  if (!ext) return null;

  const normalized = ext.toLowerCase();

  switch (normalized) {
    // Common video types
    case 'mp4':
    case 'm4v':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'ogg':
      return 'video/ogg';

    // Common image types
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

function mimeTypeFromAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  // Expo may provide `mimeType`, but older/varied platforms can omit it.
  if (asset.mimeType) return asset.mimeType;

  // Some expo builds expose `type` (sometimes as a MIME string, sometimes just "image"/"video").
  const maybeType = (asset as { type?: unknown }).type;
  if (typeof maybeType === 'string' && maybeType.includes('/')) return maybeType;

  // Fallback: infer from extension in fileName/uri.
  const ext = extensionFromFileNameOrUri(asset.fileName ?? asset.uri);
  return mimeTypeFromExtension(ext);
}

export function durationSecFromAssetDuration(durationMs: number | null | undefined): number | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  // Expo image-picker reports video duration in milliseconds; validators use seconds.
  return durationMs / 1000;
}

export function useJobInputSelection() {
  const [state, dispatch] = useReducer(jobInputSelectionReducer, initialJobInputSelectionState);

  const ensureLibraryPermission = useCallback(async (): Promise<boolean> => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.granted) return true;
    const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return requested.granted;
  }, []);

  const pickVideo = useCallback(async (): Promise<void> => {
    const ok = await ensureLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    dispatch({
      type: 'set_video',
      uri: asset.uri,
      label: labelFromAsset(asset),
      durationSec: durationSecFromAssetDuration(asset.duration),
      widthPx: asset.width ?? null,
      heightPx: asset.height ?? null,
      mimeType: mimeTypeFromAsset(asset),
    });
  }, [ensureLibraryPermission]);

  const pickImage = useCallback(async (): Promise<void> => {
    const ok = await ensureLibraryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    dispatch({
      type: 'set_image',
      uri: asset.uri,
      label: labelFromAsset(asset),
      widthPx: asset.width ?? null,
      heightPx: asset.height ?? null,
      mimeType: mimeTypeFromAsset(asset),
    });
  }, [ensureLibraryPermission]);

  const clearVideo = useCallback(() => {
    dispatch({ type: 'clear_video' });
  }, []);

  const clearImage = useCallback(() => {
    dispatch({ type: 'clear_image' });
  }, []);

  return {
    state,
    pickVideo,
    pickImage,
    clearVideo,
    clearImage,
  };
}
