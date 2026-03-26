import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState, Text, View } from 'react-native';

import { useJobStatusPolling } from './use-job-status-polling';

function Harness({ jobId }: { jobId: string }) {
  const { status, freshnessSamplesMs } = useJobStatusPolling(jobId, null);

  return (
    <View>
      <Text testID="job-status.stage">{status?.status ?? 'none'}</Text>
      <Text testID="job-status.freshness.last">
        {freshnessSamplesMs.length > 0 ? String(freshnessSamplesMs[freshnessSamplesMs.length - 1]) : 'none'}
      </Text>
      <Text testID="job-status.freshness.all">
        {freshnessSamplesMs.length > 0 ? freshnessSamplesMs.join(',') : 'none'}
      </Text>
    </View>
  );
}

describe('useJobStatusPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates stage based on backend polling responses (and tracks freshness samples)', async () => {
    const t0 = Date.now();

    (global as any).fetch = jest.fn()
      // mount refresh
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-1',
            status: 'queued',
            updatedAt: new Date(t0).toISOString(),
            etaSeconds: 1,
          },
          error: null,
        }),
      })
      // interval #1 (after 500ms)
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-1',
            status: 'processing',
            updatedAt: new Date(t0 + 500).toISOString(),
            etaSeconds: 1,
          },
          error: null,
        }),
      })
      // interval #2 (after another 500ms)
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-1',
            status: 'ready',
            updatedAt: new Date(t0 + 1000).toISOString(),
          },
          error: null,
        }),
      });

    // Provide active by default so the hook performs an immediate mount refresh.
    (AppState as any).currentState = 'active';

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb) => {
      return { remove: jest.fn() } as any;
    });

    render(<Harness jobId="job-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-status.stage').props.children).toBe('queued');
    });

    jest.advanceTimersByTime(500);

    await waitFor(() => {
      expect(screen.getByTestId('job-status.stage').props.children).toBe('processing');
    });

    const lastFreshness = screen.getByTestId('job-status.freshness.last').props.children;
    const allRaw = screen.getByTestId('job-status.freshness.all').props.children;
    if (allRaw !== 'none') {
      const samples = String(allRaw)
        .split(',')
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (samples.length > 0) {
        const p95Index = Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1);
        const p95 = samples[p95Index];
        expect(p95).toBeLessThan(2000);
      }
    } else if (lastFreshness !== 'none') {
      const freshnessMs = Number(lastFreshness);
      expect(freshnessMs).toBeLessThan(2000);
    }
  });

  it('pauses polling in background and refetches immediately on foreground', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          jobId: 'job-1',
          status: 'queued',
          updatedAt: new Date().toISOString(),
          etaSeconds: 1,
        },
        error: null,
      }),
    });

    let changeCb: ((state: string) => void) | null = null;
    (AppState as any).currentState = 'active';
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb) => {
      changeCb = cb as any;
      return { remove: jest.fn() } as any;
    });

    render(<Harness jobId="job-1" />);

    // Initial mount fetch.
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(1));

    jest.advanceTimersByTime(500);
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));

    // Background: should stop interval refreshes.
    await act(async () => {
      changeCb && changeCb('background');
    });
    jest.advanceTimersByTime(1500);
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(2));

    // Foreground: should refetch immediately.
    await act(async () => {
      changeCb && changeCb('active');
    });
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(3));
  });
});

