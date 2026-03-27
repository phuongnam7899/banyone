import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

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
  }),
}));

jest.mock('@/features/job-status/hooks/use-job-status-polling', () => ({
  useJobStatusPolling: (jobId: string | null, initialStatus: any) => ({
    status: initialStatus,
    isRefreshingStatus: false,
    freshnessSamplesMs: [],
  }),
}));

describe('CreateJobScreen submit + ack', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('submitting triggers POST and renders accepted acknowledgment', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: { jobId: 'job-123', status: 'queued' },
        error: null,
      }),
    });
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-banyone-idempotency-key']).toEqual(expect.any(String));

    const payload = JSON.parse(options.body as string);
    expect(payload.video.durationSec).toBe(60);
    expect(payload.image.widthPx).toBe(3000);
  });

  it('renders rejected acknowledgment on validation error with deterministic reason testIDs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: null,
        error: {
          code: 'INPUT_INVALID',
          message: 'Input validation failed.',
          retryable: false,
          traceId: 'trace-1',
          details: {
            violationSummary: {
              videoStatus: 'invalid-with-fix',
              imageStatus: 'valid',
            },
            violations: [
              {
                code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
                message: 'Source video duration must be <= 120 seconds.',
                fixAction: 'Pick a shorter video (<= 120 seconds).',
                slot: 'video',
              },
            ],
          },
        },
      }),
    });
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.rejected')).toBeTruthy();
    });

    expect(screen.getByTestId('create-job.submit.ack.rejection.reason.INPUT_VIDEO_DURATION_EXCEEDS_MAX.0')).toBeTruthy();
  });

  it('prevents rapid double taps from triggering multiple requests (in-flight locking)', async () => {
    let resolveFetch: (value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const fetchMock = jest.fn().mockReturnValue(fetchPromise);
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch({
      json: async () => ({
        data: { jobId: 'job-456', status: 'queued' },
        error: null,
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    });
  });

  it('shows network timeout rejection then allows retry to accepted state', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        json: async () => ({
          data: { jobId: 'job-retry-1', status: 'queued' },
          error: null,
        }),
      });
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.rejected')).toBeTruthy();
    });
    expect(screen.getByTestId('create-job.submit.ack.rejected.code').props.children).toBe('NETWORK_ERROR');

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

