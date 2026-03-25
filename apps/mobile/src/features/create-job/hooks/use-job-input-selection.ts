import * as ImagePicker from 'expo-image-picker';
import { useCallback, useReducer } from 'react';

import {
  initialJobInputSelectionState,
  jobInputSelectionReducer,
} from '@/features/create-job/hooks/job-input-selection-reducer';

function labelFromAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  return asset.fileName ?? asset.uri.split('/').pop() ?? null;
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
    dispatch({ type: 'set_video', uri: asset.uri, label: labelFromAsset(asset) });
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
    dispatch({ type: 'set_image', uri: asset.uri, label: labelFromAsset(asset) });
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
