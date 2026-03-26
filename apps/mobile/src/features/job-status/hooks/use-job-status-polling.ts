import React from 'react';
import { AppState, Platform } from 'react-native';

import type { JobFailureMetadata, JobStatusPayload } from '../types/job-status';

const POLL_INTERVAL_MS = 500;
const ENDPOINT_PATH = '/v1/generation-jobs';

function resolveApiBaseUrl(): string {
  // Recommended override for real devices/emulators.
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  // Sensible local dev defaults:
  // - iOS simulator (and web) can reach localhost
  // - Android emulator needs the special loopback alias
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const API_BASE_URL = resolveApiBaseUrl();

function toParsedFailure(failure?: JobFailureMetadata): JobFailureMetadata | undefined {
  if (!failure) return undefined;
  // In case backend adds fields later, keep this stable shape.
  return {
    retryable: Boolean(failure.retryable),
    reasonCode: String(failure.reasonCode ?? ''),
    nextAction: String(failure.nextAction ?? ''),
    message: String(failure.message ?? ''),
  };
}

type BackendStatusResponse =
  | { data: JobStatusPayload; error: null }
  | {
      data: null;
      error: { code: string; message: string; retryable: boolean; details?: unknown; traceId: string };
    };

export function useJobStatusPolling(jobId: string | null, initialStatus?: JobStatusPayload | null) {
  const [status, setStatus] = React.useState<JobStatusPayload | null>(initialStatus ?? null);
  const [isRefreshingStatus, setIsRefreshingStatus] = React.useState(false);
  const [freshnessSamplesMs, setFreshnessSamplesMs] = React.useState<number[]>([]);
  const [freshnessP95Ms, setFreshnessP95Ms] = React.useState<number | null>(null);

  const [appState, setAppState] = React.useState<string>(AppState.currentState ?? 'active');

  const lastStageRef = React.useRef<JobStatusPayload['status'] | null>(null);
  const freshnessSamplesRef = React.useRef<number[]>([]);
  const lastRefreshIdRef = React.useRef(0);

  const refresh = React.useCallback(
    async (reason: 'mount' | 'interval' | 'foreground') => {
      if (!jobId) return;

      const refreshId = ++lastRefreshIdRef.current;
      setIsRefreshingStatus(true);

      const clientRequestedAt = Date.now();
      try {
        const res = await fetch(`${API_BASE_URL}${ENDPOINT_PATH}/${jobId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const json = (await res.json()) as BackendStatusResponse;
        const clientReceivedAt = Date.now();

        if (refreshId !== lastRefreshIdRef.current) return;

        console.info('telemetry.jobs.lifecycle.client.receive.v1', {
          jobId,
          reason,
          clientRequestedAt,
          clientReceivedAt,
          // For test assertions we rely on server-provided updatedAt.
          serverUpdatedAt: json.error === null ? json.data.updatedAt : null,
        });

        if (json.error === null) {
          // Reconcile server truth; never invent statuses locally.
          setStatus({
            ...json.data,
            failure: toParsedFailure(json.data.failure),
          });
        } else {
          // Keep timeline stable: treat errors as non-state changes in MVP.
          console.info('telemetry.jobs.lifecycle.client.status_error.v1', {
            jobId,
            reason,
            code: json.error.code,
            retryable: json.error.retryable,
            traceId: json.error.traceId,
            clientReceivedAt,
          });
        }
      } catch {
        console.info('telemetry.jobs.lifecycle.client.status_network_error.v1', {
          jobId,
          reason,
          clientRequestedAt,
        });
      } finally {
        if (refreshId === lastRefreshIdRef.current) {
          setIsRefreshingStatus(false);
        }
      }
    },
    [jobId],
  );

  React.useEffect(() => {
    // Reset stage when job changes.
    setStatus(initialStatus ?? null);
    lastStageRef.current = null;
  }, [jobId, initialStatus]);

  React.useEffect(() => {
    if (!jobId) return;

    const current = AppState.currentState ?? 'active';
    setAppState(current);

    if (current === 'active') {
      void refresh('mount');
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (nextState === 'active') {
        // Immediate refetch on foreground.
        void refresh('foreground');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [jobId, refresh]);

  React.useEffect(() => {
    if (!jobId) return;
    if (appState !== 'active') return;

    const interval = setInterval(() => {
      void refresh('interval');
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [jobId, refresh, appState]);

  React.useEffect(() => {
    if (!status) return;

    const previousStage = lastStageRef.current;
    const currentStage = status.status;
    const serverUpdatedAtMs = Date.parse(status.updatedAt);
    const renderedAtMs = Date.now();

    if (previousStage && previousStage !== currentStage) {
      console.info('telemetry.jobs.lifecycle.client.transition.v1', {
        jobId,
        from: previousStage,
        to: currentStage,
        transitionUpdatedAt: status.updatedAt,
      });
    }

    if (Number.isFinite(serverUpdatedAtMs)) {
      const freshnessMs = renderedAtMs - serverUpdatedAtMs;
      freshnessSamplesRef.current = [...freshnessSamplesRef.current, freshnessMs].slice(-20);
      setFreshnessSamplesMs(freshnessSamplesRef.current);

      // Render telemetry (state->UI) happens when this effect runs.
      console.info('telemetry.jobs.lifecycle.client.freshness.v1', {
        jobId,
        stage: currentStage,
        freshnessMs,
      });

      const sorted = [...freshnessSamplesRef.current].sort((a, b) => a - b);
      const p95Index = Math.min(
        sorted.length - 1,
        Math.ceil(sorted.length * 0.95) - 1,
      );
      const p95 = sorted[p95Index];
      setFreshnessP95Ms(p95);

      console.info('telemetry.jobs.lifecycle.client.render.v1', {
        jobId,
        stage: currentStage,
        serverUpdatedAt: status.updatedAt,
        clientRenderedAt: renderedAtMs,
        freshnessMs,
        freshnessP95Ms: p95,
      });
    }

    lastStageRef.current = currentStage;
  }, [jobId, status]);

  return { status, isRefreshingStatus, freshnessSamplesMs, freshnessP95Ms };
}

