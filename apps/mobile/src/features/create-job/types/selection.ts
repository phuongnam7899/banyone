export type MediaSlotKind = 'video' | 'image';

export type JobInputSelectionState = {
  videoUri: string | null;
  videoLabel: string | null;
  videoDurationSec: number | null;
  videoWidthPx: number | null;
  videoHeightPx: number | null;
  videoMimeType: string | null;

  imageUri: string | null;
  imageLabel: string | null;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  imageMimeType: string | null;
};

export type JobInputSelectionAction =
  | {
      type: 'set_video';
      uri: string;
      label: string | null;
      durationSec: number | null;
      widthPx: number | null;
      heightPx: number | null;
      mimeType: string | null;
    }
  | {
      type: 'set_image';
      uri: string;
      label: string | null;
      widthPx: number | null;
      heightPx: number | null;
      mimeType: string | null;
    }
  | { type: 'clear_video' }
  | { type: 'clear_image' }
  | { type: 'hydrate'; state: JobInputSelectionState };
