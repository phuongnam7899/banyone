import {
  JOB_COST_SIGNAL_LOG_KEY,
  JOB_COST_SIGNAL_SCHEMA_VERSION,
} from '@banyone/contracts';
import type {
  JobCostSignalPayloadV1,
  JobLifecycleTerminalStatusForMetrics,
} from '@banyone/contracts';

/**
 * Bump this when deterministic coefficients change.
 * Keep contract schemaVersion stable unless payload shape changes.
 */
export const JOB_COST_MODEL_VERSION_V1 = 'stub-tier-v1';

export function computeJobCostSignalV1(params: {
  jobId: string;
  qualityTier: number;
  terminalStatus: JobLifecycleTerminalStatusForMetrics;
  inferenceProviderKey?: string;
}): JobCostSignalPayloadV1 {
  const tier = clampQualityTier(params.qualityTier);
  const baseUsd = 0.02 + tier * 0.01;
  const terminalMultiplier = params.terminalStatus === 'ready' ? 1 : 0.4;
  const amount = roundUsd(baseUsd * terminalMultiplier);

  return {
    schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
    jobId: params.jobId,
    qualityTier: tier,
    terminalStatus: params.terminalStatus,
    estimatedCost: {
      amount,
      currencyCode: 'USD',
    },
    costModelVersion: JOB_COST_MODEL_VERSION_V1,
    ...(params.inferenceProviderKey
      ? { inferenceProviderKey: params.inferenceProviderKey }
      : {}),
  };
}

export function emitJobCostSignalV1Log(payload: JobCostSignalPayloadV1): void {
  console.info(JOB_COST_SIGNAL_LOG_KEY, payload);
}

function clampQualityTier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const n = Math.floor(value);
  if (n < 1) return 1;
  if (n > 99) return 99;
  return n;
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
