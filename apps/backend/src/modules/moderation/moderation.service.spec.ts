import {
  MODERATION_INVALID_ACTION_ERROR_CODE,
  MODERATION_REPORT_NOT_FOUND_ERROR_CODE,
  OUTPUT_REPORT_INVALID_ERROR_CODE,
  type CreateOutputReportResponse,
} from '@banyone/contracts';

import { JobsService } from '../jobs/jobs.service';
import { ModerationActionStore } from './moderation-action.store';
import { ModerationService } from './moderation.service';
import { OutputReportStore } from './output-report.store';

describe('ModerationService', () => {
  const makeStore = (): jest.Mocked<
    Pick<OutputReportStore, 'create' | 'list' | 'getById'>
  > => ({
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
  });

  const makeJobs = (): jest.Mocked<
    Pick<
      JobsService,
      'getOutputReportEligibility' | 'getJobSnapshotForModeration'
    >
  > => ({
    getOutputReportEligibility: jest.fn(),
    getJobSnapshotForModeration: jest.fn(),
  });

  const makeActions = (): jest.Mocked<
    Pick<ModerationActionStore, 'append' | 'listByReportId'>
  > => ({
    append: jest.fn(),
    listByReportId: jest.fn(),
  });

  it('returns OUTPUT_REPORT_INVALID for malformed payload', () => {
    const store = makeStore();
    const jobs = makeJobs();
    const actions = makeActions();
    const service = new ModerationService(
      store as unknown as OutputReportStore,
      actions as unknown as ModerationActionStore,
      jobs as unknown as JobsService,
    );

    const result = service.createOutputReport({
      userId: 'u1',
      jobId: 'j1',
      body: { reasonCategory: 'NOT_A_REAL_REASON' },
    });

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: OUTPUT_REPORT_INVALID_ERROR_CODE,
      retryable: false,
    });
    expect(jobs.getOutputReportEligibility).not.toHaveBeenCalled();
  });

  it('maps not-owned/not-found checks to canonical JOB_NOT_FOUND', () => {
    const store = makeStore();
    const jobs = makeJobs();
    const actions = makeActions();
    jobs.getOutputReportEligibility.mockReturnValue({
      ok: false,
      code: 'JOB_NOT_FOUND',
      message: 'Generation job not found.',
      retryable: false,
    });
    const service = new ModerationService(
      store as unknown as OutputReportStore,
      actions as unknown as ModerationActionStore,
      jobs as unknown as JobsService,
    );

    const result = service.createOutputReport({
      userId: 'u1',
      jobId: 'j-missing',
      body: { reasonCategory: 'OTHER' },
    });

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: 'JOB_NOT_FOUND',
      retryable: false,
    });
  });

  it('creates report and returns canonical success envelope', () => {
    const store = makeStore();
    const jobs = makeJobs();
    const actions = makeActions();
    jobs.getOutputReportEligibility.mockReturnValue({ ok: true });
    const storedResponse: CreateOutputReportResponse = {
      reportId: 'r1',
      jobId: 'j1',
      reporterUserId: 'u1',
      reasonCategory: 'HARASSMENT',
      createdAt: new Date().toISOString(),
      traceId: 'trace-1',
    };
    store.create.mockReturnValue(storedResponse);
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const service = new ModerationService(
      store as unknown as OutputReportStore,
      actions as unknown as ModerationActionStore,
      jobs as unknown as JobsService,
    );

    const result = service.createOutputReport({
      userId: 'u1',
      jobId: 'j1',
      body: { reasonCategory: 'HARASSMENT', details: 'abusive output' },
    });

    expect(result).toEqual({ data: storedResponse, error: null });
    expect(store.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'j1',
        reporterUserId: 'u1',
        reasonCategory: 'HARASSMENT',
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      'telemetry.moderation.outputReport.submitted.v1',
      expect.any(Object),
    );
    const payload = infoSpy.mock.calls[0]?.[1] as unknown;
    expect(payload).toMatchObject({
      jobId: 'j1',
      reasonCategory: 'HARASSMENT',
    });
    expect(
      typeof (payload as { reportId?: unknown } | undefined)?.reportId,
    ).toBe('string');

    infoSpy.mockRestore();
  });

  it('returns report not found for missing moderation detail', () => {
    const store = makeStore();
    const jobs = makeJobs();
    const actions = makeActions();
    store.getById.mockReturnValue(null);
    const service = new ModerationService(
      store as unknown as OutputReportStore,
      actions as unknown as ModerationActionStore,
      jobs as unknown as JobsService,
    );

    const result = service.getModerationQueueDetail('missing');
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: MODERATION_REPORT_NOT_FOUND_ERROR_CODE,
    });
  });

  it('returns invalid action error for malformed moderation action payload', () => {
    const store = makeStore();
    const jobs = makeJobs();
    const actions = makeActions();
    store.getById.mockReturnValue({
      reportId: 'report-1',
      jobId: 'job-1',
      reporterUserId: 'u1',
      reasonCategory: 'SPAM',
      createdAt: '2026-04-05T12:00:00.000Z',
      traceId: 'trace-1',
    });

    const service = new ModerationService(
      store as unknown as OutputReportStore,
      actions as unknown as ModerationActionStore,
      jobs as unknown as JobsService,
    );

    const result = service.createModerationAction({
      actorUserId: 'mod-1',
      reportId: 'report-1',
      body: { actionType: 'NOT_REAL' },
    });
    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: MODERATION_INVALID_ACTION_ERROR_CODE,
      retryable: false,
    });
  });
});
