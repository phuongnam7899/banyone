import {
  DEFAULT_QUALITY_TIER,
  JOB_COST_SIGNAL_LOG_KEY,
  JOB_LIFECYCLE_METRICS_LOG_KEY,
  QUALITY_TIER_COMPARISON_LOG_KEY,
  QUALITY_TIER_COMPARISON_SCHEMA_VERSION,
  computeTimeToPreviewMs,
  type JobCostSignalPayloadV1,
  type JobLifecycleMetricsPayloadV1,
  type QualityTierComparisonMetricSourcesV1,
  type QualityTierComparisonPayloadV1,
  type QualityTierComparisonRowV1,
} from '@banyone/contracts';

type QualityTierAggregationInput = {
  jobId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  qualityTier?: number;
  queuedAtMs?: number;
  readyAtMs?: number;
  failedAtMs?: number;
  jobCostSignalV1?: JobCostSignalPayloadV1;
};

type TierAccumulator = {
  terminalJobCount: number;
  completedJobCount: number;
  latencySamples: number[];
  costSamplesUsd: number[];
};

const DEFAULT_METRIC_SOURCES: QualityTierComparisonMetricSourcesV1 = {
  joinKeys: ['jobId', 'qualityTier'],
  lifecycleMetricLogKey: JOB_LIFECYCLE_METRICS_LOG_KEY,
  costMetricLogKey: JOB_COST_SIGNAL_LOG_KEY,
  funnelMetricKeyPrefix: 'telemetry.funnel.v',
  lifecycleTerminalStatuses: ['ready', 'failed'],
  lifecyclePayloadShape: {
    jobId: '__shape__',
    qualityTier: 1,
    terminalStatus: 'ready',
    timeToPreviewMs: 1000,
  } satisfies Pick<
    JobLifecycleMetricsPayloadV1,
    'jobId' | 'qualityTier' | 'terminalStatus' | 'timeToPreviewMs'
  >,
  costPayloadShape: {
    jobId: '__shape__',
    qualityTier: 1,
    terminalStatus: 'ready',
    estimatedCost: {
      amount: 0.01,
      currencyCode: 'USD',
    },
  },
};

export function aggregateQualityTierOutcomes(
  rows: QualityTierAggregationInput[],
): QualityTierComparisonPayloadV1 {
  const acc = new Map<number, TierAccumulator>();

  for (const row of rows) {
    if (row.status !== 'ready' && row.status !== 'failed') continue;

    const tier = normalizeQualityTier(row.qualityTier);
    const bucket = getOrCreateBucket(acc, tier);
    bucket.terminalJobCount += 1;

    if (row.status === 'ready') {
      bucket.completedJobCount += 1;
    }

    const latency = computeTimeToPreviewMs({
      queuedAtMs: row.queuedAtMs,
      readyAtMs: row.readyAtMs,
      terminalStatus: row.status,
    });
    if (typeof latency === 'number') {
      bucket.latencySamples.push(latency);
    }

    const cost = row.jobCostSignalV1?.estimatedCost;
    if (cost && cost.currencyCode === 'USD' && Number.isFinite(cost.amount)) {
      bucket.costSamplesUsd.push(cost.amount);
    }
  }

  const comparisonRows = [...acc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([qualityTier, bucket]) =>
      toComparisonRow({
        qualityTier,
        ...bucket,
      }),
    );

  return {
    schemaVersion: QUALITY_TIER_COMPARISON_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    rows: comparisonRows,
    metricSources: DEFAULT_METRIC_SOURCES,
  };
}

export function emitQualityTierComparisonLog(
  payload: QualityTierComparisonPayloadV1,
): void {
  console.info(QUALITY_TIER_COMPARISON_LOG_KEY, payload);
}

function getOrCreateBucket(
  map: Map<number, TierAccumulator>,
  tier: number,
): TierAccumulator {
  const current = map.get(tier);
  if (current) return current;
  const created: TierAccumulator = {
    terminalJobCount: 0,
    completedJobCount: 0,
    latencySamples: [],
    costSamplesUsd: [],
  };
  map.set(tier, created);
  return created;
}

function toComparisonRow(params: {
  qualityTier: number;
  terminalJobCount: number;
  completedJobCount: number;
  latencySamples: number[];
  costSamplesUsd: number[];
}): QualityTierComparisonRowV1 {
  const completionRate =
    params.terminalJobCount === 0
      ? 0
      : params.completedJobCount / params.terminalJobCount;
  return {
    qualityTier: params.qualityTier,
    terminalJobCount: params.terminalJobCount,
    completedJobCount: params.completedJobCount,
    completionRate,
    timeToPreview: {
      sampleCount: params.latencySamples.length,
      medianMs:
        params.latencySamples.length > 0
          ? median(params.latencySamples)
          : null,
    },
    cost: {
      sampleCount: params.costSamplesUsd.length,
      meanEstimatedUsd:
        params.costSamplesUsd.length > 0
          ? mean(params.costSamplesUsd)
          : null,
    },
  };
}

function normalizeQualityTier(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_QUALITY_TIER;
  }
  const floored = Math.floor(value);
  if (floored < 1) return 1;
  if (floored > 99) return 99;
  return floored;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function mean(values: number[]): number {
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}
