import {
  initialJobInputSelectionState,
  jobInputSelectionReducer,
} from '@/features/create-job/hooks/job-input-selection-reducer';

describe('jobInputSelectionReducer', () => {
  it('hydrate replaces the full selection snapshot', () => {
    const next = {
      ...initialJobInputSelectionState,
      videoUri: 'file:///v.mp4',
      videoLabel: 'v.mp4',
      videoDurationSec: 12,
      videoWidthPx: 100,
      videoHeightPx: 200,
      videoMimeType: 'video/mp4',
      imageUri: 'file:///i.jpg',
      imageLabel: 'i.jpg',
      imageWidthPx: 50,
      imageHeightPx: 50,
      imageMimeType: 'image/jpeg',
    };
    const out = jobInputSelectionReducer(initialJobInputSelectionState, {
      type: 'hydrate',
      state: next,
    });
    expect(out).toEqual(next);
  });
});
