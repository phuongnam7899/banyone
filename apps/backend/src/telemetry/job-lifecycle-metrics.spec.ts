import {
  computeTimeToPreviewMs,
  JOB_LIFECYCLE_METRICS_LOG_KEY,
  JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
} from '@banyone/contracts';

import { emitJobLifecycleMetricsV1Log } from './job-lifecycle-metrics';

describe('job-lifecycle-metrics', () => {
  it('computeTimeToPreviewMs returns null for failed terminal (no latency sample)', () => {
    expect(
      computeTimeToPreviewMs({
        queuedAtMs: 100,
        readyAtMs: 500,
        terminalStatus: 'failed',
      }),
    ).toBeNull();
  });

  it('computeTimeToPreviewMs returns delta for ready when timestamps exist', () => {
    expect(
      computeTimeToPreviewMs({
        queuedAtMs: 100,
        readyAtMs: 500,
        terminalStatus: 'ready',
      }),
    ).toBe(400);
  });

  it('emitJobLifecycleMetricsV1Log writes stable key and payload', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    emitJobLifecycleMetricsV1Log({
      schemaVersion: JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
      jobId: 'job-metrics-1',
      terminalStatus: 'ready',
      qualityTier: 1,
      timeToPreviewMs: 400,
    });
    expect(spy).toHaveBeenCalledWith(
      JOB_LIFECYCLE_METRICS_LOG_KEY,
      expect.objectContaining({
        jobId: 'job-metrics-1',
        timeToPreviewMs: 400,
        terminalStatus: 'ready',
      }),
    );
    spy.mockRestore();
  });
});
