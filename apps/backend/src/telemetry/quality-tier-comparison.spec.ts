import { DEFAULT_QUALITY_TIER } from '@banyone/contracts';

import { aggregateQualityTierOutcomes } from './quality-tier-comparison';

describe('aggregateQualityTierOutcomes', () => {
  it('aggregates completion, latency median, and mean cost per tier', () => {
    const result = aggregateQualityTierOutcomes([
      {
        jobId: 'ready-t2-a',
        status: 'ready',
        qualityTier: 2,
        queuedAtMs: 0,
        readyAtMs: 100,
        jobCostSignalV1: {
          schemaVersion: 1,
          jobId: 'ready-t2-a',
          qualityTier: 2,
          terminalStatus: 'ready',
          estimatedCost: { amount: 0.1, currencyCode: 'USD' },
          costModelVersion: 'm1',
        },
      },
      {
        jobId: 'ready-t2-b',
        status: 'ready',
        qualityTier: 2,
        queuedAtMs: 0,
        readyAtMs: 300,
        jobCostSignalV1: {
          schemaVersion: 1,
          jobId: 'ready-t2-b',
          qualityTier: 2,
          terminalStatus: 'ready',
          estimatedCost: { amount: 0.3, currencyCode: 'USD' },
          costModelVersion: 'm1',
        },
      },
      {
        jobId: 'failed-t2',
        status: 'failed',
        qualityTier: 2,
        failedAtMs: 10,
      },
      {
        jobId: 'ready-legacy',
        status: 'ready',
        queuedAtMs: 0,
        readyAtMs: 50,
      },
      {
        jobId: 'queued-not-terminal',
        status: 'queued',
        qualityTier: 2,
      },
    ]);

    expect(result.rows).toEqual([
      {
        qualityTier: DEFAULT_QUALITY_TIER,
        terminalJobCount: 1,
        completedJobCount: 1,
        completionRate: 1,
        timeToPreview: {
          sampleCount: 1,
          medianMs: 50,
        },
        cost: {
          sampleCount: 0,
          meanEstimatedUsd: null,
        },
      },
      {
        qualityTier: 2,
        terminalJobCount: 3,
        completedJobCount: 2,
        completionRate: 2 / 3,
        timeToPreview: {
          sampleCount: 2,
          medianMs: 200,
        },
        cost: {
          sampleCount: 2,
          meanEstimatedUsd: 0.2,
        },
      },
    ]);
  });

  it('returns empty rows when there are no terminal jobs', () => {
    const result = aggregateQualityTierOutcomes([
      { jobId: 'q1', status: 'queued', qualityTier: 2 },
      { jobId: 'p1', status: 'processing', qualityTier: 2 },
    ]);

    expect(result.rows).toEqual([]);
  });
});
