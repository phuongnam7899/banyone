import type { JobLifecycleTerminalStatusForMetrics } from './job-experience-metrics.js';

/**
 * Story 5.3 — Per-job cost signal contracts.
 *
 * This payload represents a COGS-style estimated cost in USD for one terminalized job.
 * Emission boundary is terminal lifecycle transition (`ready` | `failed`), with at most one
 * authoritative server signal per job terminalization.
 */
export const JOB_COST_SIGNAL_SCHEMA_VERSION = 1 as const;

/** Structured backend log key for cost signals (grep-friendly). */
export const JOB_COST_SIGNAL_LOG_KEY = 'telemetry.job.cost.signal.v1' as const;

/** MVP currency support. */
export const JOB_COST_SIGNAL_CURRENCY_CODES = ['USD'] as const;

export type JobCostSignalCurrencyCode =
  (typeof JOB_COST_SIGNAL_CURRENCY_CODES)[number];

export type JobCostSignalPayloadV1 = {
  schemaVersion: typeof JOB_COST_SIGNAL_SCHEMA_VERSION;
  jobId: string;
  qualityTier: number;
  terminalStatus: JobLifecycleTerminalStatusForMetrics;
  estimatedCost: {
    amount: number;
    currencyCode: JobCostSignalCurrencyCode;
  };
  costModelVersion: string;
  inferenceProviderKey?: string;
};
