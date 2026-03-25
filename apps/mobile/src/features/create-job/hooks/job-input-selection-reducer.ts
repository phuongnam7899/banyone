import type { JobInputSelectionAction, JobInputSelectionState } from '../types/selection';

export const initialJobInputSelectionState: JobInputSelectionState = {
  videoUri: null,
  videoLabel: null,
  imageUri: null,
  imageLabel: null,
};

export function jobInputSelectionReducer(
  state: JobInputSelectionState,
  action: JobInputSelectionAction,
): JobInputSelectionState {
  switch (action.type) {
    case 'set_video':
      return { ...state, videoUri: action.uri, videoLabel: action.label };
    case 'set_image':
      return { ...state, imageUri: action.uri, imageLabel: action.label };
    case 'clear_video':
      return { ...state, videoUri: null, videoLabel: null };
    case 'clear_image':
      return {
        videoUri: state.videoUri,
        videoLabel: state.videoLabel,
        imageUri: null,
        imageLabel: null,
      };
    default:
      return state;
  }
}
