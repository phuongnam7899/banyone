import type { JobLifecycleMetricsPayloadV1 } from '@banyone/contracts';
import { JOB_LIFECYCLE_METRICS_LOG_KEY } from '@banyone/contracts';

export function emitJobLifecycleMetricsV1Log(
  payload: JobLifecycleMetricsPayloadV1,
): void {
  console.info(JOB_LIFECYCLE_METRICS_LOG_KEY, payload);
}
