import {
  SupportService,
  mapFailureCategoryFromReasonCode,
} from './support.service';

describe('SupportService', () => {
  const createService = (params?: {
    diagnosticsSnapshot?: unknown;
    storeOverrides?: Partial<{
      create: jest.Mock;
      getById: jest.Mock;
      list: jest.Mock;
      updateStatus: jest.Mock;
    }>;
  }) => {
    const jobs = {
      getJobDiagnosticsSnapshot: jest
        .fn()
        .mockReturnValue(params?.diagnosticsSnapshot ?? null),
      listJobsForQualityTierComparison: jest.fn().mockReturnValue([]),
    };
    const billing = {
      getSupportBillingDiagnostics: jest.fn().mockResolvedValue({
        userId: 'user-1',
        subscriptionState: 'active',
        activeProductId: 'monthly',
        grantHistory: [],
      }),
    };
    const store = {
      create: jest.fn(),
      getById: jest.fn().mockReturnValue(null),
      list: jest.fn().mockReturnValue([]),
      updateStatus: jest.fn().mockReturnValue(null),
      ...(params?.storeOverrides ?? {}),
    };
    const service = new SupportService(
      jobs as never,
      billing as never,
      store as never,
    );
    return { service, jobs, billing, store };
  };

  it('maps known reason codes to deterministic failure categories', () => {
    expect(mapFailureCategoryFromReasonCode('INPUT_INVALID')).toBe(
      'validation',
    );
    expect(mapFailureCategoryFromReasonCode('POLICY_VIOLATION')).toBe('policy');
    expect(
      mapFailureCategoryFromReasonCode('PROCESSING_FAILED_RETRYABLE'),
    ).toBe('processing-retryable');
    expect(
      mapFailureCategoryFromReasonCode('PROCESSING_FAILED_NON_RETRYABLE'),
    ).toBe('processing-non-retryable');
    expect(mapFailureCategoryFromReasonCode('ABUSE_RESTRICTION_ACTIVE')).toBe(
      'abuse-restriction',
    );
    expect(mapFailureCategoryFromReasonCode('SOME_UNKNOWN_CODE')).toBe(
      'unknown',
    );
    expect(mapFailureCategoryFromReasonCode(undefined)).toBe('unknown');
  });

  it('returns invalid query envelope when jobId is missing', async () => {
    const { service } = createService();

    const envelope = await service.getJobDiagnostics({});
    expect(envelope.data).toBeNull();
    expect(envelope.error).toMatchObject({
      code: 'SUPPORT_DIAGNOSTICS_INVALID_QUERY',
      retryable: false,
    });
  });

  it('returns invalid query envelope when billing diagnostics query is missing userId', async () => {
    const { service } = createService();

    const envelope = await service.getBillingDiagnostics({});
    expect(envelope.data).toBeNull();
    expect(envelope.error).toMatchObject({
      code: 'SUPPORT_DIAGNOSTICS_INVALID_QUERY',
      retryable: false,
    });
  });

  it('returns support billing diagnostics payload for a user account', async () => {
    const { service, billing } = createService();
    billing.getSupportBillingDiagnostics.mockResolvedValue({
      userId: 'user-123',
      subscriptionState: 'active',
      activeProductId: 'monthly',
      grantHistory: [
        {
          eventId: 'evt-1',
          eventType: 'RENEWAL',
          productId: 'monthly',
          grantedCredits: 30000,
          processedAt: '2026-05-31T10:00:00.000Z',
        },
      ],
    });

    const envelope = await service.getBillingDiagnostics({
      userId: 'user-123',
      limit: '25',
    });
    if (envelope.error !== null) {
      throw new Error('Expected success billing diagnostics payload');
    }

    expect(billing.getSupportBillingDiagnostics).toHaveBeenCalledWith(
      'user-123',
      25,
    );
    expect(envelope.data).toEqual({
      userId: 'user-123',
      subscriptionState: 'active',
      activeProductId: 'monthly',
      grantHistory: [
        {
          eventId: 'evt-1',
          eventType: 'RENEWAL',
          productId: 'monthly',
          grantedCredits: 30000,
          processedAt: '2026-05-31T10:00:00.000Z',
        },
      ],
    });
  });

  it('returns support diagnostics payload for existing jobs', async () => {
    const { service } = createService({
      diagnosticsSnapshot: {
        jobId: 'job-1',
        userId: 'user-1',
        status: 'failed',
        traceId: 'trace-1',
        updatedAt: '2026-04-05T00:00:00.000Z',
        failedAt: '2026-04-05T00:00:00.000Z',
        failure: {
          retryable: true,
          reasonCode: 'PROCESSING_FAILED_RETRYABLE',
          nextAction: 'retry',
        },
      },
    });

    const envelope = await service.getJobDiagnostics({ jobId: 'job-1' });
    if (envelope.error !== null) {
      throw new Error('Expected success diagnostics payload');
    }

    expect(envelope.data).toEqual({
      jobId: 'job-1',
      ownerUserId: 'user-1',
      status: 'failed',
      traceId: 'trace-1',
      updatedAt: '2026-04-05T00:00:00.000Z',
      failedAt: '2026-04-05T00:00:00.000Z',
      failureCategory: 'processing-retryable',
      failure: {
        retryable: true,
        reasonCode: 'PROCESSING_FAILED_RETRYABLE',
        nextAction: 'retry',
      },
    });
  });

  it('returns all base recovery playbooks when no category is provided', () => {
    const { service } = createService();

    const envelope = service.getRecoveryPlaybooks({});
    if (envelope.error !== null) {
      throw new Error('Expected success recovery playbooks payload');
    }

    expect(envelope.data.requestedCategory).toBe('all');
    expect(envelope.data.items).toHaveLength(6);
    expect(envelope.data.items.every((item) => item.nextSteps.length > 0)).toBe(
      true,
    );
    expect(envelope.data.usedFallback).toBe(false);
  });

  it('returns quality-tier comparison aggregates for support reporting', async () => {
    const { service, jobs } = createService();
    jobs.listJobsForQualityTierComparison.mockReturnValue([
      {
        jobId: 'j1',
        status: 'ready',
        qualityTier: 3,
        queuedAtMs: 100,
        readyAtMs: 300,
        jobCostSignalV1: {
          schemaVersion: 1,
          jobId: 'j1',
          qualityTier: 3,
          terminalStatus: 'ready',
          estimatedCost: { amount: 0.12, currencyCode: 'USD' },
          costModelVersion: 'm1',
        },
      },
      {
        jobId: 'j2',
        status: 'failed',
        qualityTier: 3,
      },
    ]);

    const envelope = await service.getQualityTierComparison();
    expect(envelope.error).toBeNull();
    if (envelope.data === null) throw new Error('expected quality tier comparison data');
    expect(envelope.data.rows).toEqual([
      expect.objectContaining({
        qualityTier: 3,
        terminalJobCount: 2,
        completedJobCount: 1,
        completionRate: 0.5,
      }),
    ]);
    expect(jobs.listJobsForQualityTierComparison).toHaveBeenCalledTimes(1);
  });

  it('returns reason-code specific recovery playbook when available', () => {
    const { service } = createService();

    const envelope = service.getRecoveryPlaybooks({
      failureCategory: 'processing-retryable',
      reasonCode: 'PROCESSING_FAILED_RETRYABLE',
    });
    if (envelope.error !== null) {
      throw new Error('Expected success recovery playbooks payload');
    }

    expect(envelope.data.items).toHaveLength(1);
    expect(envelope.data.items[0]).toMatchObject({
      id: 'processing-retryable-known',
      failureCategory: 'processing-retryable',
      reasonCode: 'PROCESSING_FAILED_RETRYABLE',
      retryGuidance: 'retry',
    });
    expect(envelope.data.usedFallback).toBe(false);
  });

  it('falls back to category default when reason code is unknown', () => {
    const { service } = createService();

    const envelope = service.getRecoveryPlaybooks({
      failureCategory: 'processing-retryable',
      reasonCode: 'SOME_UNKNOWN_REASON',
    });
    if (envelope.error !== null) {
      throw new Error('Expected success recovery playbooks payload');
    }

    expect(envelope.data.items).toHaveLength(1);
    expect(envelope.data.items[0]).toMatchObject({
      id: 'processing-retryable-default',
      failureCategory: 'processing-retryable',
    });
    expect(envelope.data.usedFallback).toBe(true);
  });

  it('returns invalid-query envelope for unknown recovery playbook category', () => {
    const { service } = createService();

    const envelope = service.getRecoveryPlaybooks({
      failureCategory: 'not-a-category',
    });
    expect(envelope.data).toBeNull();
    expect(envelope.error).toMatchObject({
      code: 'SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY',
      retryable: false,
    });
  });

  it('creates escalation with immutable diagnostics snapshot', async () => {
    const persisted = {
      escalationId: 'esc-1',
      jobId: 'job-1',
      createdAt: '2026-04-05T00:00:00.000Z',
      traceId: 'trace-e1',
      actorUserId: 'support-1',
      userImpactSummary:
        'Customer launch event is blocked while generation keeps failing.',
      diagnosticsSnapshot: {
        jobId: 'job-1',
        status: 'failed',
        ownerUserId: 'user-1',
        updatedAt: '2026-04-05T00:00:00.000Z',
        traceId: 'trace-job-1',
        failureCategory: 'processing-retryable',
        failure: {
          retryable: true,
          reasonCode: 'PROCESSING_FAILED_RETRYABLE',
          nextAction: 'retry',
        },
        recoveryPlaybookId: 'processing-retryable-default',
      },
      status: 'open',
      statusUpdatedAt: '2026-04-05T00:00:00.000Z',
    };
    const { service, store } = createService({
      diagnosticsSnapshot: {
        jobId: 'job-1',
        userId: 'user-1',
        status: 'failed',
        traceId: 'trace-job-1',
        updatedAt: '2026-04-05T00:00:00.000Z',
        failure: {
          retryable: true,
          reasonCode: 'PROCESSING_FAILED_RETRYABLE',
          nextAction: 'retry',
        },
      },
      storeOverrides: {
        create: jest.fn().mockReturnValue(persisted),
      },
    });

    const envelope = await service.createEscalation({
      actorUserId: 'support-1',
      body: {
        jobId: 'job-1',
        userImpactSummary:
          'Customer launch event is blocked while generation keeps failing.',
        recoveryPlaybookId: 'processing-retryable-default',
      },
    });

    expect(envelope.error).toBeNull();
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'support-1',
        jobId: 'job-1',
        status: 'open',
      }),
    );
    expect(envelope.data).toMatchObject({
      diagnosticsSnapshot: {
        failureCategory: 'processing-retryable',
        recoveryPlaybookId: 'processing-retryable-default',
      },
    });
  });

  it('returns job-not-found error when escalation creation job does not exist', async () => {
    const { service } = createService();
    const envelope = await service.createEscalation({
      actorUserId: 'support-1',
      body: {
        jobId: 'missing-job',
        userImpactSummary:
          'Customer cannot proceed and needs immediate engineering help.',
      },
    });
    expect(envelope.data).toBeNull();
    expect(envelope.error).toMatchObject({
      code: 'SUPPORT_ESCALATION_JOB_NOT_FOUND',
      retryable: false,
    });
  });

  it('updates escalation status and supports list filtering', async () => {
    const updated = {
      escalationId: 'esc-1',
      jobId: 'job-1',
      createdAt: '2026-04-05T00:00:00.000Z',
      traceId: 'trace-e1',
      actorUserId: 'support-1',
      userImpactSummary:
        'Customer launch event is blocked while generation keeps failing.',
      diagnosticsSnapshot: {
        jobId: 'job-1',
        status: 'failed',
        ownerUserId: 'user-1',
        updatedAt: '2026-04-05T00:00:00.000Z',
        traceId: 'trace-job-1',
        failureCategory: 'processing-retryable',
      },
      status: 'resolved',
      statusUpdatedAt: '2026-04-05T01:00:00.000Z',
      resolutionNotes: 'Issue resolved after backend queue restart.',
    };
    const { service, store } = createService({
      storeOverrides: {
        updateStatus: jest.fn().mockReturnValue(updated),
        list: jest.fn().mockReturnValue([updated]),
      },
    });

    const patch = await service.updateEscalationStatus({
      escalationId: 'esc-1',
      body: {
        status: 'resolved',
        resolutionNotes: 'Issue resolved after backend queue restart.',
      },
    });
    expect(patch.error).toBeNull();
    expect(patch.data).toMatchObject({
      escalationId: 'esc-1',
      status: 'resolved',
    });

    const list = await service.listEscalations({
      jobId: 'job-1',
      status: 'resolved',
      limit: '10',
    });
    expect(list.error).toBeNull();
    expect(store.list).toHaveBeenCalledWith({
      jobId: 'job-1',
      status: 'resolved',
      limit: 10,
    });
  });
});
