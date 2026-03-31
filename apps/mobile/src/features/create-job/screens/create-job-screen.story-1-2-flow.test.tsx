import {
  MAX_REFERENCE_IMAGE_HEIGHT_PX,
  MAX_REFERENCE_IMAGE_WIDTH_PX,
  MAX_SOURCE_VIDEO_DURATION_SEC,
  MAX_SOURCE_VIDEO_HEIGHT_PX,
  MAX_SOURCE_VIDEO_WIDTH_PX,
} from '@banyone/contracts';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

const mockPickVideo = jest.fn();
const mockPickImage = jest.fn();
const mockClearVideo = jest.fn();
const mockClearImage = jest.fn();

const baseSelectionState = {
  videoUri: null as string | null,
  videoLabel: null as string | null,
  videoDurationSec: null as number | null,
  videoWidthPx: null as number | null,
  videoHeightPx: null as number | null,
  videoMimeType: null as string | null,
  imageUri: null as string | null,
  imageLabel: null as string | null,
  imageWidthPx: null as number | null,
  imageHeightPx: null as number | null,
  imageMimeType: null as string | null,
};

let mockSelectionState = { ...baseSelectionState };

jest.mock('@/features/create-job/hooks/use-job-input-selection', () => ({
  useJobInputSelection: () => ({
    state: mockSelectionState,
    pickVideo: mockPickVideo,
    pickImage: mockPickImage,
    clearVideo: mockClearVideo,
    clearImage: mockClearImage,
    isRestoringDraft: false,
    draftRestoreNotice: null,
    dismissDraftNotice: jest.fn(),
    pendingIdempotencyKey: null,
    setPendingIdempotencyKey: jest.fn(),
    clearPersistedDraftAfterAcceptedJob: jest.fn(),
  }),
}));

jest.mock('@/features/create-job/hooks/use-job-submission', () => ({
  useJobSubmission: () => ({
    isSubmittingJob: false,
    ack: null,
    submit: jest.fn(),
  }),
}));

describe('Story 1.2 — upload inputs + constraint guidance (integration flow)', () => {
  beforeEach(() => {
    mockSelectionState = { ...baseSelectionState };
    jest.clearAllMocks();
  });

  it('shows duration, resolution, and format guidance from contracts before any submit', () => {
    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(
      screen.getByText(`Up to ${MAX_SOURCE_VIDEO_DURATION_SEC} seconds per clip (longer files will need trimming in a later step).`),
    ).toBeTruthy();
    expect(
      screen.getByText(`Up to ${MAX_SOURCE_VIDEO_WIDTH_PX}×${MAX_SOURCE_VIDEO_HEIGHT_PX} pixels.`),
    ).toBeTruthy();
    expect(
      screen.getByText(`Up to ${MAX_REFERENCE_IMAGE_WIDTH_PX}×${MAX_REFERENCE_IMAGE_HEIGHT_PX} pixels.`),
    ).toBeTruthy();
    expect(screen.getByText(/MP4 or QuickTime-style containers/i)).toBeTruthy();
    expect(screen.getByText(/JPEG, PNG, or HEIC stills/i)).toBeTruthy();

    const requirements = screen.getByTestId('create-job.requirements.section');
    expect(requirements.props.accessibilityLabel).toContain('Source video length');
    expect(requirements.props.accessibilityLabel).toContain('Formats');
  });

  it('linear flow: tapping video then image slots invokes the corresponding pickers', () => {
    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.upload-video.button'));
    fireEvent.press(screen.getByTestId('create-job.upload-image.button'));

    expect(mockPickVideo).toHaveBeenCalledTimes(1);
    expect(mockPickImage).toHaveBeenCalledTimes(1);
  });

  it('surfaces one selected label per slot (no multi-select in UI)', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///a.mp4',
      videoLabel: 'clip-a.mp4',
      imageUri: 'file:///b.jpg',
      imageLabel: 'ref-b.jpg',
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByLabelText('clip-a.mp4')).toBeTruthy();
    expect(screen.getByLabelText('ref-b.jpg')).toBeTruthy();
  });

  it('replace / clear: clear buttons call clearVideo and clearImage', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///a.mp4',
      videoLabel: 'clip-a.mp4',
      imageUri: 'file:///b.jpg',
      imageLabel: 'ref-b.jpg',
    };

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.upload-video.button.clear'));
    fireEvent.press(screen.getByTestId('create-job.upload-image.button.clear'));

    expect(mockClearVideo).toHaveBeenCalledTimes(1);
    expect(mockClearImage).toHaveBeenCalledTimes(1);
  });

  it('exposes stable testIDs for the create surface (Story 1.2 AC5)', () => {
    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.screen')).toBeTruthy();
    expect(screen.getByTestId('create-job.upload-video.button')).toBeTruthy();
    expect(screen.getByTestId('create-job.upload-image.button')).toBeTruthy();
    expect(screen.getByTestId('create-job.requirements.section')).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker')).toBeTruthy();
  });
});
