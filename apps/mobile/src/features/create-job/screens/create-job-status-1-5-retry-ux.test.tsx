import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

const mockSubmit = jest.fn();

let mockJobStatus: any = null;

jest.mock('@/features/create-job/hooks/use-job-input-selection', () => ({
  useJobInputSelection: () => ({
    state: {
      videoUri: 'file:///video.mp4',
      videoLabel: 'video.mp4',
      videoDurationSec: 60,
      videoWidthPx: 1920,
      videoHeightPx: 1080,
      videoMimeType: 'video/mp4',
      imageUri: 'file:///image.jpg',
      imageLabel: 'image.jpg',
      imageWidthPx: 3000,
      imageHeightPx: 3000,
      imageMimeType: 'image/jpeg',
    },
    pickVideo: jest.fn(),
    pickImage: jest.fn(),
    clearVideo: jest.fn(),
    clearImage: jest.fn(),
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
    ack: { type: 'accepted', jobId: 'job-1', status: 'queued' },
    submit: mockSubmit,
  }),
}));

jest.mock('@/features/job-status/hooks/use-job-status-polling', () => ({
  useJobStatusPolling: () => ({
    status: mockJobStatus,
    isRefreshingStatus: false,
    freshnessSamplesMs: [],
  }),
}));

describe('Story 1.5 retry UX', () => {
  beforeEach(() => {
    mockSubmit.mockClear();
  });

  it('shows retry CTA only when backend failed with retryable=true', () => {
    mockJobStatus = {
      jobId: 'job-1',
      status: 'failed',
      updatedAt: new Date().toISOString(),
      failure: {
        retryable: true,
        reasonCode: 'PROCESSING_FAILED_RETRYABLE',
        nextAction: 'retry',
        message: 'Processing failed. You can retry this job.',
      },
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('job-status.retry.button')).toBeTruthy();
    fireEvent.press(screen.getByTestId('job-status.retry.button'));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('hides retry CTA for non-retryable failures', () => {
    mockJobStatus = {
      jobId: 'job-1',
      status: 'failed',
      updatedAt: new Date().toISOString(),
      failure: {
        retryable: false,
        reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
        nextAction: 'contact_support',
        message: 'Processing failed and cannot be retried.',
      },
    };

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.queryByTestId('job-status.retry.button')).toBeNull();
  });
});

