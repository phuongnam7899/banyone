export type MediaSlotKind = 'video' | 'image';

export type JobInputSelectionState = {
  videoUri: string | null;
  videoLabel: string | null;
  imageUri: string | null;
  imageLabel: string | null;
};

export type JobInputSelectionAction =
  | { type: 'set_video'; uri: string; label: string | null }
  | { type: 'set_image'; uri: string; label: string | null }
  | { type: 'clear_video' }
  | { type: 'clear_image' };
