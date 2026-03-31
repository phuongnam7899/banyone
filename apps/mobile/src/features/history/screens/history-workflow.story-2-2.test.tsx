import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { HistoryDetailScreen } from './history-detail-screen';
import { HistoryListScreen } from './history-list-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const waitForOptions = { timeout: 15_000 };
jest.setTimeout(20_000);

describe('Story 2.2 history list/detail authenticated API workflow', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockPush.mockReset();
  });

  it('list load sends GET /v1/generation-jobs with Bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          items: [
            {
              jobId: 'job-hist-1',
              status: 'ready',
              updatedAt: '2026-03-30T12:00:00.000Z',
            },
          ],
        },
        error: null,
        meta: {},
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;

    render(<HistoryListScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('history.list.item.job-hist-1')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/generation-jobs$/);
    expect((init as RequestInit).method ?? 'GET').toBe('GET');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`);
  });

  it('navigating open detail uses route with job id', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          items: [
            {
              jobId: 'job-route-1',
              status: 'queued',
              updatedAt: '2026-03-30T00:00:00.000Z',
            },
          ],
        },
        error: null,
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;

    render(<HistoryListScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('history.list.open-detail.button.job-route-1')).toBeTruthy();
    }, waitForOptions);

    fireEvent.press(screen.getByTestId('history.list.open-detail.button.job-route-1'));
    expect(mockPush).toHaveBeenCalledWith('/history-detail/job-route-1');
  });

  it('detail load sends GET /v1/generation-jobs/:id with Bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          jobId: 'job-detail-1',
          status: 'processing',
          updatedAt: '2026-03-30T01:00:00.000Z',
          queuedAt: '2026-03-30T00:59:00.000Z',
          processingAt: '2026-03-30T01:00:00.000Z',
        },
        error: null,
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;

    render(<HistoryDetailScreen jobId="job-detail-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('history.detail.screen')).toBeTruthy();
    }, waitForOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/generation-jobs/job-detail-1');
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`);
  });

  it('detail shows error surface when API returns JOB_NOT_FOUND envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: null,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Generation job not found.',
          retryable: false,
          traceId: 'trace-job-not-found',
        },
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as typeof fetch;

    render(<HistoryDetailScreen jobId="missing-job" />);

    await waitFor(() => {
      expect(screen.getByTestId('history.detail.error')).toBeTruthy();
    }, waitForOptions);

    expect(screen.getByText('JOB_NOT_FOUND')).toBeTruthy();
  });
});
