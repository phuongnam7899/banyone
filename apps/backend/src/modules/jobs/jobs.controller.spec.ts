/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest with Nest INestApplication#getHttpServer() */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import * as os from 'os';
import { mkdtempSync, rmSync } from 'fs';

import {
  BANYONE_TEST_FIREBASE_ID_TOKEN,
  validateJobInputCompliance,
} from '@banyone/contracts';

import { ThrottlerEnvelopeExceptionFilter } from '../auth/throttler-envelope.filter';
import { JobsModule } from './jobs.module';
import { JobsService } from './jobs.service';
import type {
  GenerationJobStatusEnvelope,
  GenerationJobValidationErrorDetails,
} from './jobs.types';

describe('JobsController', () => {
  let app: INestApplication;
  let dataDir: string;
  let notifDataDir: string;
  let disclosureDataDir: string;
  const authHeader = {
    Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
  };

  type SuccessEnvelope = {
    data: {
      jobId: string;
      status: 'queued' | 'processing' | 'ready' | 'failed';
    };
    error: null;
  };

  type ErrorEnvelope = {
    data: null;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      details?: GenerationJobValidationErrorDetails;
      traceId: string;
    };
  };

  type PreviewSuccessEnvelope = {
    data: {
      jobId: string;
      status: 'ready';
      updatedAt: string;
      previewUri: string;
      mimeType: 'video/mp4';
    };
    error: null;
  };

  type ExportSuccessEnvelope = {
    data: {
      jobId: string;
      status: 'ready';
      updatedAt: string;
      exportUri: string;
      mimeType: 'video/mp4';
    };
    error: null;
  };

  type Http401AuthBody = {
    data: null;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      traceId: string;
    };
  };

  type HistoryListEnvelope = {
    data: {
      items: Array<{
        jobId: string;
        status: 'queued' | 'processing' | 'ready' | 'failed';
        updatedAt: string;
      }>;
    };
    error: null;
    meta?: Record<string, unknown>;
  };

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-'));
    notifDataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-notif-jobs-'));
    disclosureDataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-disclosure-jobs-'));
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = notifDataDir;
    process.env.BANYONE_DISCLOSURE_DATA_DIR = disclosureDataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';

    const moduleRef = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
    await app.init();
    await request(app.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(authHeader)
      .send({ version: 'v1' })
      .expect(200);
  });

  afterEach(async () => {
    if (app) await app.close();
    if (process.env.BANYONE_JOBS_DATA_DIR) {
      rmSync(process.env.BANYONE_JOBS_DATA_DIR, {
        recursive: true,
        force: true,
      });
      delete process.env.BANYONE_JOBS_DATA_DIR;
    }
    if (process.env.BANYONE_NOTIFICATIONS_DATA_DIR) {
      rmSync(process.env.BANYONE_NOTIFICATIONS_DATA_DIR, {
        recursive: true,
        force: true,
      });
      delete process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    }
    if (process.env.BANYONE_DISCLOSURE_DATA_DIR) {
      rmSync(process.env.BANYONE_DISCLOSURE_DATA_DIR, {
        recursive: true,
        force: true,
      });
      delete process.env.BANYONE_DISCLOSURE_DATA_DIR;
    }
    delete process.env.BANYONE_AUTH_VERIFIER;
    delete process.env.BANYONE_AUTH_TEST_UID;
  });

  const validBody = {
    video: {
      uri: 'file:///video.mp4',
      durationSec: 60,
      widthPx: 1920,
      heightPx: 1080,
      mimeType: 'video/mp4',
    },
    image: {
      uri: 'file:///image.jpg',
      widthPx: 3000,
      heightPx: 3000,
      mimeType: 'image/jpeg',
    },
  };

  it('POST /v1/generation-jobs returns 401 with contract-shaped body when Authorization is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set('x-banyone-idempotency-key', 'idem-key-auth-missing')
      .send(validBody)
      .expect(401);

    const authBody = res.body as Http401AuthBody;
    expect(authBody.data).toBeNull();
    expect(authBody.error.code).toBe('UNAUTHENTICATED');
    expect(authBody.error.retryable).toBe(false);
    expect(authBody.error.traceId).toEqual(expect.any(String));
  });

  it('POST /v1/generation-jobs returns 401 when Bearer token is invalid (test verifier)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set('Authorization', 'Bearer invalid-token')
      .set('x-banyone-idempotency-key', 'idem-key-auth-bad')
      .send(validBody)
      .expect(401);

    const authBody = res.body as Http401AuthBody;
    expect(authBody.data).toBeNull();
    expect(authBody.error.code).toBe('INVALID_ID_TOKEN');
    expect(authBody.error.retryable).toBe(false);
  });

  it('GET /v1/generation-jobs/:id/preview returns 401 when Authorization is missing', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'job-auth-preview',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const res = await request(app.getHttpServer())
      .get('/v1/generation-jobs/job-auth-preview/preview')
      .expect(401);

    const authBody = res.body as Http401AuthBody;
    expect(authBody.data).toBeNull();
    expect(authBody.error.code).toBe('UNAUTHENTICATED');
    expect(authBody.error.retryable).toBe(false);
    expect(authBody.error.traceId).toEqual(expect.any(String));
  });

  it('POST /v1/generation-jobs returns success envelope + queued status', async () => {
    await request(app.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(authHeader)
      .send({ version: 'v1' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', 'idem-key-1')
      .send(validBody)
      .expect(201);

    const body = res.body as SuccessEnvelope;
    expect(body.error).toBeNull();
    expect(body.data.jobId).toEqual(expect.any(String));
    expect(body.data.status).toBe('queued');
  });

  it('POST /v1/generation-jobs returns DISCLOSURE_REQUIRED before first acknowledgment', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set('Authorization', 'Bearer test-valid-token-user-b')
      .set('x-banyone-idempotency-key', 'idem-key-disclosure-blocked')
      .send(validBody)
      .expect(201);

    const body = res.body as ErrorEnvelope;
    expect(body.data).toBeNull();
    expect(body.error.code).toBe('DISCLOSURE_REQUIRED');
    expect(body.error.retryable).toBe(false);
    expect(body.error.details).toMatchObject({
      currentVersion: 'v1',
      action: 'acknowledge_disclosure',
    });
  });

  it('POST /v1/synthetic-media-disclosure/acknowledge records acceptance for authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(authHeader)
      .send({ version: 'v1' })
      .expect(200);

    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({
      accepted: true,
      currentVersion: 'v1',
      acceptance: { version: 'v1' },
    });
    expect(res.body.data.acceptance.acceptedAt).toEqual(expect.any(String));
  });

  it('POST /v1/generation-jobs returns INPUT_INVALID error envelope with contract-aligned details', async () => {
    const invalidBody = {
      ...validBody,
      video: {
        ...validBody.video,
        durationSec: 121, // over MAX_SOURCE_VIDEO_DURATION_SEC
      },
    };

    const expectedValidation = validateJobInputCompliance({
      video: invalidBody.video,
      image: invalidBody.image,
    });

    const expectedViolations = [
      ...expectedValidation.video.violations.map((v) => ({
        ...v,
        slot: 'video' as const,
      })),
      ...expectedValidation.image.violations.map((v) => ({
        ...v,
        slot: 'image' as const,
      })),
    ];

    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', 'idem-key-2')
      .send(invalidBody)
      .expect(201);

    const body = res.body as ErrorEnvelope;
    expect(body.data).toBeNull();
    expect(body.error.code).toBe('INPUT_INVALID');
    expect(body.error.retryable).toBe(false);
    expect(body.error.traceId).toEqual(expect.any(String));

    // Contract-aligned violation ordering/messages/copy.
    const details = body.error.details as GenerationJobValidationErrorDetails;
    expect(details.violationSummary).toEqual({
      videoStatus: expectedValidation.video.status,
      imageStatus: expectedValidation.image.status,
    });
    expect(details.violations).toEqual(expectedViolations);
  });

  it('is idempotent per x-banyone-idempotency-key (same jobId returned)', async () => {
    const key = 'idem-key-same';

    const first = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', key)
      .send(validBody)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', key)
      .send(validBody)
      .expect(201);

    const firstBody = first.body as SuccessEnvelope;
    const secondBody = second.body as SuccessEnvelope;
    expect(firstBody.data.jobId).toBe(secondBody.data.jobId);
    expect(firstBody.data.status).toBe('queued');
    expect(secondBody.data.status).toBe('queued');
  });

  it('persists idempotency mapping across service instances (server restart behavior)', async () => {
    const key = 'idem-key-restart';

    const first = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', key)
      .send(validBody)
      .expect(201);

    const firstBody = first.body as SuccessEnvelope;
    const jobId = firstBody.data.jobId;

    await app.close();

    const moduleRef2 = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    const app2 = moduleRef2.createNestApplication();
    app2.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';
    await app2.init();

    const second = await request(app2.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', key)
      .send(validBody)
      .expect(201);

    const secondBody = second.body as SuccessEnvelope;
    expect(secondBody.data.jobId).toBe(jobId);
    await app2.close();
  });

  it('does not share idempotency mappings across different authenticated users', async () => {
    const sharedClientKey = 'idem-shared-client-key';
    await request(app.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set('Authorization', 'Bearer test-valid-token-user-b')
      .send({ version: 'v1' })
      .expect(200);

    const userA = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', sharedClientKey)
      .send(validBody)
      .expect(201);

    const userB = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set('Authorization', 'Bearer test-valid-token-user-b')
      .set('x-banyone-idempotency-key', sharedClientKey)
      .send(validBody)
      .expect(201);

    const aBody = userA.body as SuccessEnvelope;
    const bBody = userB.body as SuccessEnvelope;
    expect(aBody.data.jobId).not.toBe(bBody.data.jobId);
  });

  it('GET /v1/generation-jobs/:id returns canonical success envelope with queued stage + ETA', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-queued';

    jobsService.__testSeedJob({
      jobId,
      status: 'queued',
      queuedAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    if (body.error !== null) throw new Error('Expected success envelope');

    expect(body.data.jobId).toBe(jobId);
    expect(body.data.status).toBe('queued');
    expect(body.data.updatedAt).toEqual(expect.any(String));
    expect(body.data.etaSeconds).toEqual(expect.any(Number));
  });

  it('GET /v1/generation-jobs returns 401 when Authorization is missing', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/generation-jobs')
      .expect(401);

    const authBody = res.body as Http401AuthBody;
    expect(authBody.data).toBeNull();
    expect(authBody.error.code).toBe('UNAUTHENTICATED');
    expect(authBody.error.retryable).toBe(false);
  });

  it('GET /v1/generation-jobs/:id returns 401 when Authorization is missing', async () => {
    const jobsService = app.get(JobsService);
    jobsService.__testSeedJob({
      jobId: 'job-detail-auth-required',
      userId: 'test-user-uid',
      status: 'queued',
      queuedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    const res = await request(app.getHttpServer())
      .get('/v1/generation-jobs/job-detail-auth-required')
      .expect(401);

    const authBody = res.body as Http401AuthBody;
    expect(authBody.data).toBeNull();
    expect(authBody.error.code).toBe('UNAUTHENTICATED');
    expect(authBody.error.retryable).toBe(false);
    expect(authBody.error.traceId).toEqual(expect.any(String));
  });

  it('GET /v1/generation-jobs returns user-scoped list with contract-compatible fields', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'history-a',
      userId: 'test-user-uid',
      status: 'processing',
      processingAtMs: nowMs - 100,
      updatedAtMs: nowMs - 100,
    });
    jobsService.__testSeedJob({
      jobId: 'history-b',
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    jobsService.__testSeedJob({
      jobId: 'history-other-user',
      userId: 'other-user',
      status: 'failed',
      failedAtMs: nowMs,
      updatedAtMs: nowMs,
      failure: {
        retryable: false,
        reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
        nextAction: 'contact_support',
        message: 'Processing failed and cannot be retried.',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/v1/generation-jobs')
      .set(authHeader)
      .expect(200);

    const body = res.body as HistoryListEnvelope;
    expect(body.error).toBeNull();
    if (body.error !== null) throw new Error('Expected success envelope');
    expect(body.meta).toBeDefined();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items.map((item) => item.jobId)).toEqual([
      'history-b',
      'history-a',
    ]);

    const first = body.data.items[0];
    expect(first.status).toBe('ready');
    expect(first.updatedAt).toEqual(expect.any(String));
  });

  it('GET /v1/generation-jobs/:id returns JOB_NOT_FOUND for non-owned jobs', async () => {
    const jobsService = app.get(JobsService);
    jobsService.__testSeedJob({
      jobId: 'job-other-owner',
      userId: 'different-user',
      status: 'queued',
      queuedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    const res = await request(app.getHttpServer())
      .get('/v1/generation-jobs/job-other-owner')
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    expect(body.data).toBeNull();
    expect(body.error).toMatchObject({
      code: 'JOB_NOT_FOUND',
      retryable: false,
      message: 'Generation job not found.',
    });
  });

  it('GET /v1/generation-jobs/:id never skips queued -> ready in one call', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-skip';

    // Enough time passed to trigger queued -> processing, but the endpoint
    // should commit at most one transition per read.
    jobsService.__testSeedJob({
      jobId,
      status: 'queued',
      queuedAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    if (body.error !== null) throw new Error('Expected success envelope');
    expect(body.data.status).toBe('processing');
  });

  it('GET /v1/generation-jobs/:id transitions processing -> ready with no failure payload', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-2'; // deterministic mapping => ready

    jobsService.__testSeedJob({
      jobId,
      status: 'processing',
      processingAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    if (body.error !== null) throw new Error('Expected success envelope');
    expect(body.data.status).toBe('ready');
    expect(body.data.failure).toBeUndefined();
  });

  it('GET /v1/generation-jobs/:id transitions processing -> failed with deterministic retry metadata', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-0'; // deterministic mapping => retryable failed

    jobsService.__testSeedJob({
      jobId,
      status: 'processing',
      processingAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    if (body.error !== null) throw new Error('Expected success envelope');
    expect(body.data.status).toBe('failed');
    expect(body.data.failure).toBeDefined();
    expect(body.data.failure?.retryable).toBe(true);
    expect(body.data.failure?.reasonCode).toBe('PROCESSING_FAILED_RETRYABLE');
    expect(body.data.failure?.nextAction).toBe('retry');
    expect(body.data.failure?.message).toEqual(expect.any(String));
  });

  it('GET /v1/generation-jobs/:id returns JOB_NOT_FOUND envelope when missing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/does-not-exist`)
      .set(authHeader)
      .expect(200);

    const body = res.body as GenerationJobStatusEnvelope;
    expect(body.data).toBeNull();
    expect(body.error).toMatchObject({
      code: 'JOB_NOT_FOUND',
      retryable: false,
      message: 'Generation job not found.',
    });
    if (body.error === null) throw new Error('expected error envelope');
    expect(body.error.traceId).toEqual(expect.any(String));
  });

  it('GET /v1/generation-jobs/:id/preview returns preview metadata for ready jobs', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-preview-9';
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}/preview`)
      .set(authHeader)
      .expect(200);

    const body = res.body as PreviewSuccessEnvelope;
    expect(body.error).toBeNull();
    expect(body.data.jobId).toBe(jobId);
    expect(body.data.status).toBe('ready');
    expect(body.data.mimeType).toBe('video/mp4');
    expect(body.data.previewUri).toContain(`${jobId}.mp4`);
  });

  it('POST /v1/generation-jobs/:id/export returns export file metadata for ready jobs', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-export-8';
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const res = await request(app.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/export`)
      .set(authHeader)
      .expect(201);

    const body = res.body as ExportSuccessEnvelope;
    expect(body.error).toBeNull();
    expect(body.data.jobId).toBe(jobId);
    expect(body.data.status).toBe('ready');
    expect(body.data.mimeType).toBe('video/mp4');
    expect(body.data.exportUri).toBe(`file:///tmp/banyone/${jobId}.mp4`);
  });

  it('preview/export endpoints return deterministic retryable errors for seeded failure fixtures', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'job-preview-1',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    jobsService.__testSeedJob({
      jobId: 'job-export-2',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const previewRes = await request(app.getHttpServer())
      .get('/v1/generation-jobs/job-preview-1/preview')
      .set(authHeader)
      .expect(200);
    const previewBody = previewRes.body as ErrorEnvelope;
    expect(previewBody.data).toBeNull();
    expect(previewBody.error).toMatchObject({
      code: 'PREVIEW_LOAD_FAILED',
      retryable: true,
    });

    const exportRes = await request(app.getHttpServer())
      .post('/v1/generation-jobs/job-export-2/export')
      .set(authHeader)
      .expect(201);
    const exportBody = exportRes.body as ErrorEnvelope;
    expect(exportBody.data).toBeNull();
    expect(exportBody.error).toMatchObject({
      code: 'EXPORT_PREPARATION_FAILED',
      retryable: true,
    });
  });

  it('preview/export do not mutate lifecycle state outside queued->processing->ready|failed', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'job-ready-invariant-9';
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}/preview`)
      .set(authHeader)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/export`)
      .set(authHeader)
      .expect(201);

    const statusRes = await request(app.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(authHeader)
      .expect(200);
    const statusBody = statusRes.body as GenerationJobStatusEnvelope;
    if (statusBody.error !== null) throw new Error('Expected success envelope');
    expect(statusBody.data.status).toBe('ready');
  });

  it('reports illegalTransitionCount=0 after allowed lifecycle transitions', async () => {
    const jobsService = app.get(JobsService);
    jobsService.__testSeedJob({
      jobId: 'metric-1',
      status: 'queued',
      queuedAtMs: Date.now() - 100_000,
      updatedAtMs: Date.now() - 100_000,
    });

    await request(app.getHttpServer())
      .get('/v1/generation-jobs/metric-1')
      .set(authHeader)
      .expect(200);

    const report = jobsService.getLifecycleInvariantReport();
    expect(report.illegalTransitionCount).toBe(0);
  });
});
