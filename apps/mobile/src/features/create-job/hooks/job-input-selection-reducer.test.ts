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
    });
    expect(state.videoUri).toBe('file:///a.mp4');
    state = jobInputSelectionReducer(state, {
      type: 'set_video',
      uri: 'file:///b.mp4',
      label: 'b.mp4',
    });
    expect(state.videoUri).toBe('file:///b.mp4');
    expect(state.videoLabel).toBe('b.mp4');
  });

  it('keeps video when setting image and replaces only image', () => {
    let state = jobInputSelectionReducer(initialJobInputSelectionState, {
      type: 'set_video',
      uri: 'file:///v.mp4',
      label: 'v.mp4',
    });
    state = jobInputSelectionReducer(state, {
      type: 'set_image',
      uri: 'file:///i.jpg',
      label: 'i.jpg',
    });
    expect(state.videoUri).toBe('file:///v.mp4');
    expect(state.imageUri).toBe('file:///i.jpg');
    state = jobInputSelectionReducer(state, {
      type: 'set_image',
      uri: 'file:///j.jpg',
      label: 'j.jpg',
    });
    expect(state.imageUri).toBe('file:///j.jpg');
    expect(state.videoUri).toBe('file:///v.mp4');
  });

  it('clears slots independently', () => {
    let state = jobInputSelectionReducer(initialJobInputSelectionState, {
      type: 'set_video',
      uri: 'file:///v.mp4',
      label: null,
    });
    state = jobInputSelectionReducer(state, { type: 'set_image', uri: 'file:///i.jpg', label: null });
    state = jobInputSelectionReducer(state, { type: 'clear_video' });
    expect(state.videoUri).toBeNull();
    expect(state.imageUri).toBe('file:///i.jpg');
    state = jobInputSelectionReducer(state, { type: 'clear_image' });
    expect(state.imageUri).toBeNull();
  });
});
