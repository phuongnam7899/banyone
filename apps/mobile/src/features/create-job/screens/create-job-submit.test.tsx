import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';
import { emitCreateJobDraftTelemetry, emitFunnelTelemetry } from '@/infra/telemetry';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

jest.mock('@/infra/telemetry', () => ({
  emitFunnelTelemetry: jest.fn(),
  emitCreateJobDraftTelemetry: jest.fn(),
  emitPreviewExportTelemetry: jest.fn(),
  getTelemetrySessionId: jest.fn(() => 'test-session-id'),
}));

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
      videoUri: 'https://cdn.example.com/video.mp4',
      videoLabel: 'video.mp4',
      videoDurationSec: 60,
      videoWidthPx: 1920,
      videoHeightPx: 1080,
      videoMimeType: 'video/mp4',
      imageUri: 'https://cdn.example.com/image.jpg',
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

jest.mock('@/features/create-job/hooks/use-generation-credits', () => ({
  useGenerationCredits: () => ({
    credits: { balance: 1234, videoCreditPerSecond: 100 },
    isLoadingCredits: false,
    creditsError: null,
    refreshCredits: jest.fn(),
  }),
}));

const waitForOptions = { timeout: 15_000 };
jest.setTimeout(20_000);

describe('CreateJobScreen submit + ack', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    (emitFunnelTelemetry as jest.Mock).mockClear();
    (emitCreateJobDraftTelemetry as jest.Mock).mockClear();
  });

  it('submitting triggers POST and renders accepted acknowledgment', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonFetchResponse({ data: { jobId: 'job-123', status: 'queued' }, error: null }, 201),
      );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    expect(screen.getByTestId('create-job.credits.badge')).toBeTruthy();
    expect(String(screen.getByText('Generate (6,000 credits)').props.children)).toContain(
      'Generate',
    );

    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-status.timeline.root')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/generation-jobs');
    const headers = new Headers((options as RequestInit).headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`);

    const payload = JSON.parse((options as RequestInit).body as string);
    expect(payload.qualityTier).toBe(1);
    expect(payload.video.durationSec).toBe(60);
    expect(payload.image.widthPx).toBe(3000);
    expect(emitFunnelTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        funnelStage: 'submit_result',
        submissionOutcomeClass: 'accepted',
        terminalJobStatusClass: 'queued',
      }),
    );
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

  it('renders policy-blocked state with stable testIDs when server returns POLICY_VIOLATION', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonFetchResponse({
        data: null,
        error: {
          code: 'POLICY_VIOLATION',
          message: 'This submission uses a storage location that is not allowed.',
          retryable: false,
          traceId: 'trace-policy',
          details: { policyCode: 'STORAGE_URI_BLOCKED' },
        },
      }, 201),
    );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.policy-blocked.container')).toBeTruthy();
    }, waitForOptions);

    expect(String(screen.getByTestId('create-job.policy-blocked.message').props.children)).toContain(
      'not allowed',
    );
    expect(String(screen.getByTestId('create-job.policy-blocked.trace').props.children)).toContain(
      'trace-policy',
    );
    expect(String(screen.getByTestId('create-job.policy-blocked.code').props.children)).toContain(
      'STORAGE_URI_BLOCKED',
    );
    expect(screen.queryByTestId('create-job.submit.ack.rejected')).toBeNull();
  });

  it('renders abuse-restricted state with dedicated copy (not rate-limit countdown)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonFetchResponse({
        data: null,
        error: {
          code: 'ABUSE_RESTRICTION_ACTIVE',
          message: 'This account is currently restricted from this action.',
          retryable: false,
          traceId: 'trace-abuse',
        },
      }, 201),
    );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.abuse-restricted.container')).toBeTruthy();
    }, waitForOptions);

    expect(String(screen.getByTestId('create-job.abuse-restricted.message').props.children)).toContain(
      'restricted',
    );
    expect(String(screen.getByTestId('create-job.abuse-restricted.trace').props.children)).toContain(
      'trace-abuse',
    );
    expect(screen.queryByTestId('create-job.submit.ack.rate-limited')).toBeNull();
  });

  it('renders deterministic insufficient-credit details and rate context', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonFetchResponse({
        data: null,
        error: {
          code: 'INSUFFICIENT_CREDIT',
          message: 'Not enough credits to generate this video.',
          retryable: false,
          traceId: 'trace-credit',
          details: {
            balance: 100,
            required: 241,
            shortfall: 141,
            videoCreditPerSecond: 100,
          },
        },
      }, 201),
    );
    (global as any).fetch = fetchMock;

    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.submit.button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-job.insufficient-credit.container')).toBeTruthy();
    }, waitForOptions);
    expect(screen.queryByTestId('create-job.submit.ack.rejected')).toBeNull();
    expect(String(screen.getByTestId('create-job.insufficient-credit.details').props.children)).toContain(
      'Current:',
    );
    expect(String(screen.getByTestId('create-job.insufficient-credit.rate').props.children)).toContain(
      'Cost rate:',
    );
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
      expect(screen.getByTestId('job-status.timeline.root')).toBeTruthy();
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
      expect(screen.getByTestId('job-status.timeline.root')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(fetchMock.mock.calls[1][0]);
    const body0 = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const body1 = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(body0).toEqual(body1);
  });

  it('auto-acknowledges disclosure and proceeds with submit flow after Generate tap', async () => {
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
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, waitForOptions);

    await waitFor(() => {
      expect(screen.getByTestId('job-status.timeline.root')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.queryByTestId('create-job.disclosure-gate.container')).toBeNull();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/v1/synthetic-media-disclosure/acknowledge');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/v1/generation-jobs');
    expect(emitFunnelTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        funnelStage: 'disclosure_presented',
        submissionOutcomeClass: 'disclosure_required',
      }),
    );
    expect(emitFunnelTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        funnelStage: 'disclosure_acknowledged',
        eventName: 'disclosure_acknowledged',
      }),
    );
  });
});

