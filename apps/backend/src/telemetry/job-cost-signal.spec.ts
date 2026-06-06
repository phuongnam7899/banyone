import {
  JOB_COST_SIGNAL_LOG_KEY,
  JOB_COST_SIGNAL_SCHEMA_VERSION,
} from '@banyone/contracts';

import {
  JOB_COST_MODEL_VERSION_V1,
  computeJobCostSignalV1,
  emitJobCostSignalV1Log,
} from './job-cost-signal';

describe('job-cost-signal', () => {
  it('computeJobCostSignalV1 returns deterministic payload for ready terminal', () => {
    const payload = computeJobCostSignalV1({
      jobId: 'job-cost-ready-1',
      qualityTier: 3,
      terminalStatus: 'ready',
    });

    expect(payload).toEqual({
      schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
      jobId: 'job-cost-ready-1',
      qualityTier: 3,
      terminalStatus: 'ready',
      estimatedCost: {
        amount: 0.05,
        currencyCode: 'USD',
      },
      costModelVersion: JOB_COST_MODEL_VERSION_V1,
    });
  });

  it('computeJobCostSignalV1 scales failed terminals with lower estimate', () => {
    const readyPayload = computeJobCostSignalV1({
      jobId: 'job-cost-compare-1',
      qualityTier: 4,
      terminalStatus: 'ready',
    });
    const failedPayload = computeJobCostSignalV1({
      jobId: 'job-cost-compare-1',
      qualityTier: 4,
      terminalStatus: 'failed',
    });

    expect(failedPayload.estimatedCost.amount).toBeLessThan(
      readyPayload.estimatedCost.amount,
    );
    expect(failedPayload.estimatedCost.currencyCode).toBe('USD');
  });

  it('emitJobCostSignalV1Log writes stable key and payload', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const payload = computeJobCostSignalV1({
      jobId: 'job-cost-log-1',
      qualityTier: 2,
      terminalStatus: 'ready',
    });

    emitJobCostSignalV1Log(payload);

    expect(spy).toHaveBeenCalledWith(
      JOB_COST_SIGNAL_LOG_KEY,
      expect.objectContaining({
        schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
        jobId: 'job-cost-log-1',
        qualityTier: 2,
        terminalStatus: 'ready',
        costModelVersion: JOB_COST_MODEL_VERSION_V1,
      }),
    );
    spy.mockRestore();
  });
});
