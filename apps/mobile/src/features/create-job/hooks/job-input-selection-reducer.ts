import type { JobInputSelectionAction, JobInputSelectionState } from '../types/selection';

export const initialJobInputSelectionState: JobInputSelectionState = {
  videoUri: null,
  videoLabel: null,
  videoDurationSec: null,
  videoWidthPx: null,
  videoHeightPx: null,
  videoMimeType: null,

  imageUri: null,
  imageLabel: null,
  imageWidthPx: null,
  imageHeightPx: null,
  imageMimeType: null,
};

export function jobInputSelectionReducer(
  state: JobInputSelectionState,
  action: JobInputSelectionAction,
): JobInputSelectionState {
  switch (action.type) {
    case 'set_video':
      return {
        ...state,
        videoUri: action.uri,
        videoLabel: action.label,
        videoDurationSec: action.durationSec,
        videoWidthPx: action.widthPx,
        videoHeightPx: action.heightPx,
        videoMimeType: action.mimeType,
      };
    case 'set_image':
      return {
        ...state,
        imageUri: action.uri,
        imageLabel: action.label,
        imageWidthPx: action.widthPx,
        imageHeightPx: action.heightPx,
        imageMimeType: action.mimeType,
      };
    case 'clear_video':
      return {
        ...state,
        videoUri: null,
        videoLabel: null,
        videoDurationSec: null,
        videoWidthPx: null,
        videoHeightPx: null,
        videoMimeType: null,
      };
    case 'clear_image':
      return {
        videoUri: state.videoUri,
        videoLabel: state.videoLabel,
        videoDurationSec: state.videoDurationSec,
        videoWidthPx: state.videoWidthPx,
        videoHeightPx: state.videoHeightPx,
        videoMimeType: state.videoMimeType,

        imageUri: null,
        imageLabel: null,
        imageWidthPx: null,
        imageHeightPx: null,
        imageMimeType: null,
      };
    default:
      return state;
  }
}
