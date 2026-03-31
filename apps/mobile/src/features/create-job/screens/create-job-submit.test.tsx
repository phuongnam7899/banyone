import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

function jsonFetchResponse(body: unknown, status = 200) {
  const serialized = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => serialized,
  };
}

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

jest.mock('@/features/job-status/hooks/use-job-status-polling', () => ({
  useJobStatusPolling: (jobId: string | null, initialStatus: any) => ({
    status: initialStatus,
    isRefreshingStatus: false,
    freshnessSamplesMs: [],
  }),
}));

const waitForOptions = { timeout: 15_000 };
jest.setTimeout(20_000);

describe('CreateJobScreen submit + ack', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('submitting triggers POST and renders accepted acknowledgment', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonFetchResponse({ data: { jobId: 'job-123', status: 'queued' }, error: null }, 201),
      );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/generation-jobs');
    const headers = new Headers((options as RequestInit).headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`);

    const payload = JSON.parse((options as RequestInit).body as string);
    expect(payload.video.durationSec).toBe(60);
    expect(payload.image.widthPx).toBe(3000);
  });

  it('renders rejected acknowledgment on validation error with deterministic reason testIDs', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonFetchResponse({
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
      }, 201),
    );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.rejected')).toBeTruthy();
    }, waitForOptions);

    expect(screen.getByTestId('create-job.submit.ack.rejection.reason.INPUT_VIDEO_DURATION_EXCEEDS_MAX.0')).toBeTruthy();
  });

  it('renders rate-limit path for 429 responses with JSON envelope (not NETWORK_ERROR)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonFetchResponse(
        {
          data: null,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many creations — please wait.',
            retryable: true,
            traceId: 'trace-rl',
            details: { scope: 'account', retryAfterSec: 60 },
          },
        },
        429,
      ),
    );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.rate-limited')).toBeTruthy();
    }, waitForOptions);

    expect(screen.queryByTestId('create-job.submit.ack.rejected')).toBeNull();
    expect(screen.queryByTestId('create-job.submit.ack.rejected.code')).toBeNull();

    expect(screen.getByTestId('create-job.submit.ack.rate-limited.message')).toBeTruthy();
    expect(
      String(screen.getByTestId('create-job.submit.ack.rate-limited.message').props.children),
    ).toContain('Too many creations');
    expect(
      String(screen.getByTestId('create-job.submit.ack.rate-limited.message').props.children),
    ).toContain('60');
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

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }, waitForOptions);

    resolveFetch(
      jsonFetchResponse({ data: { jobId: 'job-456', status: 'queued' }, error: null }, 201),
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    }, waitForOptions);
  });

  it('shows network timeout rejection then allows retry to accepted state', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(
        jsonFetchResponse({ data: { jobId: 'job-retry-1', status: 'queued' }, error: null }, 201),
      );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.rejected')).toBeTruthy();
    }, waitForOptions);
    expect(screen.getByTestId('create-job.submit.ack.rejected.code').props.children).toBe('NETWORK_ERROR');

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
    const body0 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const body1 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body0).toEqual(body1);
  });

  it('shows disclosure gate, acknowledges, then proceeds with submit flow', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse(
          {
            data: null,
            error: {
              code: 'DISCLOSURE_REQUIRED',
              message: 'Synthetic media disclosure acknowledgment is required.',
              retryable: false,
              traceId: 'trace-disclosure',
              details: { currentVersion: 'v1' },
            },
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse(
          {
            data: {
              accepted: true,
              currentVersion: 'v1',
              acceptance: {
                acceptedAt: new Date().toISOString(),
                version: 'v1',
              },
            },
            error: null,
          },
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse({ data: { jobId: 'job-after-disclosure', status: 'queued' }, error: null }, 201),
      );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.disclosure-gate.container')).toBeTruthy();
    }, waitForOptions);

    fireEvent.press(screen.getByTestId('create-job.disclosure-gate.acknowledge.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.submit.ack.accepted')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/v1/synthetic-media-disclosure/acknowledge');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/v1/generation-jobs');
  });
});

