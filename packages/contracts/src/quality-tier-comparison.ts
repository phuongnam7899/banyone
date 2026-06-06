import type { JobCostSignalPayloadV1 } from './job-cost-signals.js';
import type {
  JobLifecycleMetricsPayloadV1,
  JobLifecycleTerminalStatusForMetrics,
} from './job-experience-metrics.js';

export const QUALITY_TIER_COMPARISON_SCHEMA_VERSION = 1 as const;

/** Structured analytics log key for aggregate tier comparisons. */
export const QUALITY_TIER_COMPARISON_LOG_KEY =
  'telemetry.analytics.quality.tier.comparison.v1' as const;

export type QualityTierComparisonTimeToPreviewSummary = {
  sampleCount: number;
  /**
   * Uses the same definition as `computeTimeToPreviewMs`:
   * only `ready` terminal jobs with both queued and ready timestamps contribute samples.
   */
  medianMs: number | null;
};

export type QualityTierComparisonCostSummary = {
  /**
   * Number of terminal jobs where `jobCostSignalV1` exists on the persisted job record.
   */
  sampleCount: number;
  /** Mean USD estimate from `JobCostSignalPayloadV1.estimatedCost.amount`. */
  meanEstimatedUsd: number | null;
};

export type QualityTierComparisonRowV1 = {
  /** Primary dimension for FR28 comparability. */
  qualityTier: number;
  /** Terminal jobs (`ready` or `failed`) in this tier. */
  terminalJobCount: number;
  /** Terminal jobs with `ready` status in this tier. */
  completedJobCount: number;
  /** `completedJobCount / terminalJobCount`; `0` when denominator is zero. */
  completionRate: number;
  timeToPreview: QualityTierComparisonTimeToPreviewSummary;
  cost: QualityTierComparisonCostSummary;
};

export type QualityTierComparisonMetricSourcesV1 = {
  /**
   * Authoritative joins:
   * - `jobId` links per-job lifecycle/cost/funnel records
   * - `qualityTier` is the reporting bucketing dimension
   */
  joinKeys: readonly ['jobId', 'qualityTier'];
  lifecycleMetricLogKey: string;
  costMetricLogKey: string;
  /** Funnel-family telemetry key namespace for conversion metrics by tier. */
  funnelMetricKeyPrefix: 'telemetry.funnel.v';
  lifecycleTerminalStatuses: readonly JobLifecycleTerminalStatusForMetrics[];
  lifecyclePayloadShape: Pick<
    JobLifecycleMetricsPayloadV1,
    'jobId' | 'qualityTier' | 'terminalStatus' | 'timeToPreviewMs'
  >;
  costPayloadShape: Pick<
    JobCostSignalPayloadV1,
    'jobId' | 'qualityTier' | 'terminalStatus' | 'estimatedCost'
  >;
};

export type QualityTierComparisonPayloadV1 = {
  schemaVersion: typeof QUALITY_TIER_COMPARISON_SCHEMA_VERSION;
  generatedAt: string;
  rows: QualityTierComparisonRowV1[];
  /**
   * Reporting DTO only (aggregate output); does not replace per-job lifecycle/cost payloads.
   */
  metricSources: QualityTierComparisonMetricSourcesV1;
};

export type QualityTierComparisonEnvelope =
  | {
      data: QualityTierComparisonPayloadV1;
      error: null;
    }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        traceId: string;
      };
    };
