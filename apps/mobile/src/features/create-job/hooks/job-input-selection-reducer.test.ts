import {
  initialJobInputSelectionState,
  jobInputSelectionReducer,
} from './job-input-selection-reducer';

describe('jobInputSelectionReducer', () => {
  it('sets a single video and replaces on re-pick', () => {
    let state = initialJobInputSelectionState;
    state = jobInputSelectionReducer(state, {
      type: 'set_video',
      uri: 'file:///a.mp4',
      label: 'a.mp4',
      durationSec: 10,
      widthPx: 1920,
      heightPx: 1080,
      mimeType: 'video/mp4',
    });
    expect(state.videoUri).toBe('file:///a.mp4');
    state = jobInputSelectionReducer(state, {
      type: 'set_video',
      uri: 'file:///b.mp4',
      label: 'b.mp4',
      durationSec: 12,
      widthPx: 1280,
      heightPx: 720,
      mimeType: 'video/mp4',
    });
    expect(state.videoUri).toBe('file:///b.mp4');
    expect(state.videoLabel).toBe('b.mp4');
    expect(state.videoDurationSec).toBe(12);
    expect(state.videoWidthPx).toBe(1280);
    expect(state.videoHeightPx).toBe(720);
    expect(state.videoMimeType).toBe('video/mp4');
  });

  it('keeps video when setting image and replaces only image', () => {
    let state = jobInputSelectionReducer(initialJobInputSelectionState, {
      type: 'set_video',
      uri: 'file:///v.mp4',
      label: 'v.mp4',
      durationSec: 10,
      widthPx: 1920,
      heightPx: 1080,
      mimeType: 'video/mp4',
    });
    state = jobInputSelectionReducer(state, {
      type: 'set_image',
      uri: 'file:///i.jpg',
      label: 'i.jpg',
      widthPx: 800,
      heightPx: 600,
      mimeType: 'image/jpeg',
    });
    expect(state.videoUri).toBe('file:///v.mp4');
    expect(state.imageUri).toBe('file:///i.jpg');
    expect(state.videoDurationSec).toBe(10);
    expect(state.videoWidthPx).toBe(1920);
    expect(state.videoHeightPx).toBe(1080);
    expect(state.videoMimeType).toBe('video/mp4');
    state = jobInputSelectionReducer(state, {
      type: 'set_image',
      uri: 'file:///j.jpg',
      label: 'j.jpg',
      widthPx: 1024,
      heightPx: 768,
      mimeType: 'image/jpeg',
    });
    expect(state.imageUri).toBe('file:///j.jpg');
    expect(state.videoUri).toBe('file:///v.mp4');
    expect(state.imageWidthPx).toBe(1024);
    expect(state.imageHeightPx).toBe(768);
    expect(state.imageMimeType).toBe('image/jpeg');
  });

  it('clears slots independently', () => {
    let state = jobInputSelectionReducer(initialJobInputSelectionState, {
      type: 'set_video',
      uri: 'file:///v.mp4',
      label: null,
      durationSec: 10,
      widthPx: 1920,
      heightPx: 1080,
      mimeType: 'video/mp4',
    });
    state = jobInputSelectionReducer(state, {
      type: 'set_image',
      uri: 'file:///i.jpg',
      label: null,
      widthPx: 800,
      heightPx: 600,
      mimeType: 'image/jpeg',
    });
    state = jobInputSelectionReducer(state, { type: 'clear_video' });
    expect(state.videoUri).toBeNull();
    expect(state.imageUri).toBe('file:///i.jpg');
    expect(state.videoDurationSec).toBeNull();
    expect(state.videoWidthPx).toBeNull();
    expect(state.videoHeightPx).toBeNull();
    expect(state.videoMimeType).toBeNull();
    state = jobInputSelectionReducer(state, { type: 'clear_image' });
    expect(state.imageUri).toBeNull();
    expect(state.imageWidthPx).toBeNull();
    expect(state.imageHeightPx).toBeNull();
    expect(state.imageMimeType).toBeNull();
  });
});
