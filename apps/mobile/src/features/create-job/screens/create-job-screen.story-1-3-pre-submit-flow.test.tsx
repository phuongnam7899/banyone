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

describe('Story 1.3 — pre-submit validation + fix guidance (integration flow)', () => {
  beforeEach(() => {
    mockSelectionState = { ...baseSelectionState };
    jest.clearAllMocks();
  });

  it('valid video duration (30 seconds): video slot Ready when reference image not selected yet', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///short.mp4',
      videoLabel: 'short.mp4',
      videoDurationSec: 30,
      videoWidthPx: 1280,
      videoHeightPx: 720,
      videoMimeType: 'video/mp4',
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.input-compliance-checker.video.stage.valid')).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker.image.stage.pending')).toBeTruthy();
    expect(screen.getAllByText('Ready')).toHaveLength(1);
    expect(screen.getByText('Validating…')).toBeTruthy();
  });

  it('valid video duration (under max): video slot Ready when reference image not selected yet', () => {
    const underMaxDuration = MAX_SOURCE_VIDEO_DURATION_SEC - 1;
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///short.mp4',
      videoLabel: 'short.mp4',
      videoDurationSec: underMaxDuration,
      videoWidthPx: 1280,
      videoHeightPx: 720,
      videoMimeType: 'video/mp4',
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.input-compliance-checker.video.stage.valid')).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker.image.stage.pending')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(screen.getByText('Validating…')).toBeTruthy();
  });

  it('happy path: valid metadata shows Ready for video and image slots', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///clip.mp4',
      videoLabel: 'clip.mp4',
      videoDurationSec: MAX_SOURCE_VIDEO_DURATION_SEC,
      videoWidthPx: MAX_SOURCE_VIDEO_WIDTH_PX,
      videoHeightPx: MAX_SOURCE_VIDEO_HEIGHT_PX,
      videoMimeType: 'video/mp4',
      imageUri: 'file:///ref.jpg',
      imageLabel: 'ref.jpg',
      imageWidthPx: MAX_REFERENCE_IMAGE_WIDTH_PX,
      imageHeightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
      imageMimeType: 'image/jpeg',
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.input-compliance-checker.video.stage.valid')).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker.image.stage.valid')).toBeTruthy();
    expect(screen.getAllByText('Ready')).toHaveLength(2);
  });

  it('video duration over max: field-linked violation + fix invokes pickVideo', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///long.mp4',
      videoLabel: 'long.mp4',
      videoDurationSec: MAX_SOURCE_VIDEO_DURATION_SEC + 1,
      videoWidthPx: 1280,
      videoHeightPx: 720,
      videoMimeType: 'video/mp4',
      imageUri: null,
      imageLabel: null,
      imageWidthPx: null,
      imageHeightPx: null,
      imageMimeType: null,
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.input-compliance-checker.video.stage.invalid-with-fix')).toBeTruthy();
    expect(
      screen.getByText(`Source video duration must be <= ${MAX_SOURCE_VIDEO_DURATION_SEC} seconds.`),
    ).toBeTruthy();

    const fix = screen.getByTestId('create-job.input-compliance-checker.video.violation.INPUT_VIDEO_DURATION_EXCEEDS_MAX.fix-action');
    fireEvent.press(fix);

    expect(mockPickVideo).toHaveBeenCalledTimes(1);
    expect(mockPickImage).not.toHaveBeenCalled();
  });

  it('reference image resolution over max: violation under image slot + fix invokes pickImage', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///ok.mp4',
      videoLabel: 'ok.mp4',
      videoDurationSec: 10,
      videoWidthPx: 1280,
      videoHeightPx: 720,
      videoMimeType: 'video/mp4',
      imageUri: 'file:///big.jpg',
      imageLabel: 'big.jpg',
      imageWidthPx: MAX_REFERENCE_IMAGE_WIDTH_PX + 100,
      imageHeightPx: MAX_REFERENCE_IMAGE_HEIGHT_PX,
      imageMimeType: 'image/jpeg',
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.input-compliance-checker.video.stage.valid')).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker.image.stage.invalid-with-fix')).toBeTruthy();
    expect(
      screen.getByText(
        `Reference image resolution must be <= ${MAX_REFERENCE_IMAGE_WIDTH_PX}×${MAX_REFERENCE_IMAGE_HEIGHT_PX} pixels.`,
      ),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByTestId('create-job.input-compliance-checker.image.violation.INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX.fix-action'),
    );

    expect(mockPickImage).toHaveBeenCalledTimes(1);
  });

  it('missing image metadata with URI: shows deterministic metadata-unavailable copy on image slot', () => {
    mockSelectionState = {
      ...baseSelectionState,
      videoUri: 'file:///ok.mp4',
      videoLabel: 'ok.mp4',
      videoDurationSec: 10,
      videoWidthPx: 1280,
      videoHeightPx: 720,
      videoMimeType: 'video/mp4',
      imageUri: 'file:///unknown.ext',
      imageLabel: 'unknown.ext',
      imageWidthPx: null,
      imageHeightPx: null,
      imageMimeType: null,
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(
      screen.getByText("We couldn't read the required metadata from your selected reference image."),
    ).toBeTruthy();
    expect(screen.getByTestId('create-job.input-compliance-checker.image.violation.INPUT_METADATA_UNAVAILABLE.message')).toBeTruthy();
  });
});
