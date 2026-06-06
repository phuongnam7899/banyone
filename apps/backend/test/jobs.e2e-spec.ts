import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BANYONE_TEST_FIREBASE_ID_TOKEN,
  DEFAULT_QUALITY_TIER,
  JOB_COST_SIGNAL_LOG_KEY,
  JOB_COST_SIGNAL_SCHEMA_VERSION,
  JOB_LIFECYCLE_METRICS_LOG_KEY,
  JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
  QUALITY_TIER_COMPARISON_SCHEMA_VERSION,
} from '@banyone/contracts';

import { AppModule } from '../src/app.module';
import { JobsService } from '../src/modules/jobs/jobs.service';
import { JOB_COST_MODEL_VERSION_V1 } from '../src/telemetry/job-cost-signal';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
jest.setTimeout(20_000);

const e2eAuthHeaders = {
  Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
};
const e2eModeratorAuthHeaders = {
  Authorization: 'Bearer test-valid-token-moderator',
};
const e2eSupportAuthHeaders = {
  Authorization: 'Bearer test-valid-token-support',
};

const validGenerationJobBody = () => ({
  video: {
    uri: 'file:///video.mp4',
    durationSec: 60,
    widthPx: 1920,
    heightPx: 1080,
    mimeType: 'video/mp4',
  },
  image: {
    uri: 'file:///image.jpg',
    widthPx: 2000,
    heightPx: 2000,
    mimeType: 'image/jpeg',
  },
});

describe('JobsController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let dataDir: string;
  let notifDataDir: string;
  let disclosureDataDir: string;
  let moderationDataDir: string;
  let abuseDataDir: string;
  let supportDataDir: string;

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-e2e-'));
    notifDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-notif-e2e-'));
    disclosureDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-disclosure-e2e-'),
    );
    moderationDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-moderation-e2e-'),
    );
    abuseDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-abuse-e2e-'));
    supportDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-support-e2e-'),
    );
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = notifDataDir;
    process.env.BANYONE_DISCLOSURE_DATA_DIR = disclosureDataDir;
    process.env.BANYONE_MODERATION_DATA_DIR = moderationDataDir;
    process.env.BANYONE_ABUSE_DATA_DIR = abuseDataDir;
    process.env.BANYONE_SUPPORT_DATA_DIR = supportDataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';
    process.env.BANYONE_MODERATOR_UIDS = 'test-moderator-uid';
    process.env.BANYONE_SUPPORT_UIDS = 'test-support-uid';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    delete process.env.BANYONE_JOBS_DATA_DIR;
    delete process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    delete process.env.BANYONE_AUTH_VERIFIER;
    delete process.env.BANYONE_AUTH_TEST_UID;
    delete process.env.BANYONE_DISCLOSURE_DATA_DIR;
    delete process.env.BANYONE_MODERATION_DATA_DIR;
    delete process.env.BANYONE_ABUSE_DATA_DIR;
    delete process.env.BANYONE_SUPPORT_DATA_DIR;
    delete process.env.BANYONE_ABUSE_THRESHOLD_MAX_JOBS;
    delete process.env.BANYONE_ABUSE_THRESHOLD_WINDOW_MS;
    delete process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS;
    delete process.env.BANYONE_MODERATOR_UIDS;
    delete process.env.BANYONE_SUPPORT_UIDS;
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(notifDataDir, { recursive: true, force: true });
    fs.rmSync(disclosureDataDir, { recursive: true, force: true });
    fs.rmSync(moderationDataDir, { recursive: true, force: true });
    fs.rmSync(abuseDataDir, { recursive: true, force: true });
    fs.rmSync(supportDataDir, { recursive: true, force: true });
  });

  it('GET /v1/synthetic-media-disclosure returns initial not-accepted status for new users', async () => {
    await request(app!.getHttpServer())
      .get('/v1/synthetic-media-disclosure')
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          data: {
            accepted: false,
            currentVersion: 'v1',
            acceptance: null,
          },
          error: null,
        });
      });
  });

  it('POST /v1/generation-jobs returns DISCLOSURE_REQUIRED when disclosure has not been acknowledged', async () => {
    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-disclosure-blocked')
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'DISCLOSURE_REQUIRED',
          message:
            'Synthetic media disclosure acknowledgment is required before your first generation.',
          retryable: false,
          details: {
            currentVersion: 'v1',
            action: 'acknowledge_disclosure',
          },
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/synthetic-media-disclosure/acknowledge validates version and records acceptance', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'not-v1' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'DISCLOSURE_VERSION_INVALID',
          message: 'Disclosure version must equal v1.',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });

    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.accepted).toBe(true);
        expect(res.body.data.currentVersion).toBe('v1');
        expect(res.body.data.acceptance).toMatchObject({
          version: 'v1',
          acceptedAt: expect.any(String),
        });
      });

    await request(app!.getHttpServer())
      .get('/v1/synthetic-media-disclosure')
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.accepted).toBe(true);
        expect(res.body.data.currentVersion).toBe('v1');
        expect(res.body.data.acceptance).toMatchObject({
          version: 'v1',
          acceptedAt: expect.any(String),
        });
      });
  });

  it('POST /v1/generation-jobs returns 200 and queued envelope when inputs are valid and disclosure is acknowledged', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-key-1')
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({
          data: {
            jobId: expect.any(String),
            status: 'queued',
          },
          error: null,
        });
      });
  });

  it('POST /v1/generation-jobs returns error when idempotency header is missing', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'IDEMPOTENCY_KEY_INVALID',
          message: 'Missing or invalid idempotency key.',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/generation-jobs returns INPUT_INVALID when validation fails', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const body = validGenerationJobBody();
    body.video.durationSec = 999;

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-key-invalid-input')
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'INPUT_INVALID',
          message: 'Input validation failed.',
          retryable: false,
        });
        expect(res.body.error.details).toMatchObject({
          violationSummary: expect.any(Object),
          violations: expect.arrayContaining([
            expect.objectContaining({
              code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
              slot: 'video',
            }),
          ]),
        });
      });
  });

  it('POST /v1/generation-jobs returns INPUT_INVALID (not POLICY_VIOLATION) when validation fails even if URI matches policy blocklist', async () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = '__e2e_block__';
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const body = validGenerationJobBody();
    body.video.durationSec = 999;
    body.image.uri = 'file:///library/__e2e_block__/photo.jpg';

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-key-invalid-before-policy')
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'INPUT_INVALID',
          retryable: false,
        });
        expect(res.body.error?.code).not.toBe('POLICY_VIOLATION');
      });
  });

  it('POST /v1/generation-jobs returns POLICY_VIOLATION when uri matches blocklist after disclosure and validation', async () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = '__e2e_block__';
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const body = validGenerationJobBody();
    body.image.uri = 'file:///library/__e2e_block__/photo.jpg';

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-policy-e2e')
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'POLICY_VIOLATION',
          retryable: false,
          details: { policyCode: 'STORAGE_URI_BLOCKED' },
        });
        expect(res.body.error.message).toEqual(expect.any(String));
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/generation-jobs allows a new attempt with the same idempotency key after POLICY_VIOLATION (no idempotency row on block)', async () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = '__e2e_block__';
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const blockedBody = validGenerationJobBody();
    blockedBody.image.uri = 'file:///library/__e2e_block__/photo.jpg';
    const idemKey = 'idem-policy-then-success';

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', idemKey)
      .send(blockedBody)
      .expect(201)
      .expect((res) => {
        expect(res.body.error?.code).toBe('POLICY_VIOLATION');
      });

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', idemKey)
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId: expect.any(String),
          status: 'queued',
        });
      });
  });

  it('POST /v1/generation-jobs is idempotent for the same key', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const key = 'idem-key-repeat';
    const body = validGenerationJobBody();

    const first = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', key)
      .send(body)
      .expect(201);

    const second = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', key)
      .send(body)
      .expect(201);

    expect(first.body.data?.jobId).toEqual(second.body.data?.jobId);
    expect(first.body.data?.status).toBe('queued');
  });

  it('GET /v1/generation-jobs/:id returns canonical status envelope with updatedAt + ETA', async () => {
    const jobsService = app!.get(JobsService);
    const jobId = 'e2e-queued-1';
    const nowMs = Date.now();

    jobsService.__testSeedJob({
      jobId,
      status: 'queued',
      queuedAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.jobId).toBe(jobId);
        expect(res.body.data.status).toBe('queued');
        expect(res.body.data.updatedAt).toEqual(expect.any(String));
        expect(res.body.data.etaSeconds).toEqual(expect.any(Number));
      });
  });

  it('GET /v1/generation-jobs/:id/preview returns deterministic preview contract for ready jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-preview-9';
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}/preview`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId,
          status: 'ready',
          mimeType: 'video/mp4',
          previewUri: `https://cdn.banyone.local/generated/${jobId}.mp4`,
        });
      });
  });

  it('GET /v1/generation-jobs/:id/preview returns deterministic PREVIEW_LOAD_FAILED envelope', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-preview-fail-1'; // last hex digit 1 => preview failure fixture
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}/preview`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'PREVIEW_LOAD_FAILED',
          message: 'Preview failed to load. Please retry.',
          retryable: true,
          details: { stage: 'failed-preview' },
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/generation-jobs/:id/export returns deterministic export contract for ready jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-export-8';
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/export`)
      .set(e2eAuthHeaders)
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId,
          status: 'ready',
          mimeType: 'video/mp4',
          exportUri: `file:///tmp/banyone/${jobId}.mp4`,
        });
      });
  });

  it('POST /v1/generation-jobs/:id/export returns deterministic EXPORT_PREPARATION_FAILED envelope', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-export-fail-2'; // last hex digit 2 => export failure fixture
    jobsService.__testSeedJob({
      jobId,
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/export`)
      .set(e2eAuthHeaders)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'EXPORT_PREPARATION_FAILED',
          message: 'Unable to prepare export file. Please retry.',
          retryable: true,
          details: { outputStatePreserved: true },
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('preview/export endpoints keep lifecycle invariant and return JOB_NOT_READY for processing jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-not-ready-a';

    jobsService.__testSeedJob({
      jobId,
      status: 'processing',
      processingAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}/preview`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'JOB_NOT_READY',
          retryable: true,
        });
      });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/export`)
      .set(e2eAuthHeaders)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'JOB_NOT_READY',
          retryable: true,
        });
      });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.status).toBe('processing');
      });
  });

  it('GET /v1/generation-jobs/:id does not skip queued -> ready in a single read', async () => {
    const jobsService = app!.get(JobsService);
    const jobId = 'e2e-skip-1';
    const nowMs = Date.now();

    jobsService.__testSeedJob({
      jobId,
      status: 'queued',
      queuedAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.status).toBe('processing');
      });
  });

  it('GET /v1/generation-jobs/:id returns deterministic retry metadata for retryable failed states', async () => {
    const jobsService = app!.get(JobsService);
    const jobId = 'e2e-failed-retry-0'; // last hex digit 0 => retryable failed
    const nowMs = Date.now();

    jobsService.__testSeedJob({
      jobId,
      status: 'processing',
      processingAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.status).toBe('failed');
        expect(res.body.data.failure.retryable).toBe(true);
        expect(res.body.data.failure.reasonCode).toBe(
          'PROCESSING_FAILED_RETRYABLE',
        );
        expect(res.body.data.failure.nextAction).toBe('retry');
      });
  });

  it('keeps in-app lifecycle status authoritative when all push lifecycle preferences are disabled', async () => {
    await request(app!.getHttpServer())
      .put('/v1/notification-preferences')
      .set(e2eAuthHeaders)
      .send({
        lifecycle: {
          jobQueued: false,
          jobReady: false,
          jobFailed: false,
        },
      })
      .expect(200);

    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-status-truth-2';
    jobsService.__testSeedJob({
      jobId,
      status: 'processing',
      processingAtMs: nowMs - 100_000,
      updatedAtMs: nowMs - 100_000,
    });

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(['ready', 'failed']).toContain(res.body.data.status);
      });

    await request(app!.getHttpServer())
      .get('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        const items = res.body.data.items as Array<{ jobId: string }>;
        expect(items.some((item) => item.jobId === jobId)).toBe(true);
      });
  });

  it('GET unknown route returns 404', () => {
    return request(app!.getHttpServer())
      .get('/v1/generation-jobs-unknown')
      .set(e2eAuthHeaders)
      .expect(404);
  });

  it('POST /v1/generation-jobs/:jobId/reports accepts report for owned ready jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-report-ready-1';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({
        reasonCategory: 'SPAM',
        details: 'spam watermark',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId,
          reporterUserId: 'test-user-uid',
          reasonCategory: 'SPAM',
          reportId: expect.any(String),
          createdAt: expect.any(String),
          traceId: expect.any(String),
        });
      });
  });

  it('POST /v1/generation-jobs/:jobId/reports returns JOB_NOT_FOUND for non-owned jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-report-other-user';
    jobsService.__testSeedJob({
      jobId,
      userId: 'different-user',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({
        reasonCategory: 'OTHER',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'JOB_NOT_FOUND',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/generation-jobs/:jobId/reports returns JOB_NOT_READY for non-ready jobs', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-report-processing';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      status: 'processing',
      processingAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({
        reasonCategory: 'HATE',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'JOB_NOT_READY',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/generation-jobs/:jobId/reports returns OUTPUT_REPORT_INVALID for malformed payloads', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-report-invalid-body';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'OUTPUT_REPORT_INVALID',
          retryable: false,
        });
        expect(res.body.error.message).toEqual(expect.any(String));
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });

    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({ reasonCategory: 'NOT_A_REAL_CATEGORY' })
      .expect(201)
      .expect((res) => {
        expect(res.body.error?.code).toBe('OUTPUT_REPORT_INVALID');
      });

    const longDetails = 'd'.repeat(1001);
    await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({ reasonCategory: 'SPAM', details: longDetails })
      .expect(201)
      .expect((res) => {
        expect(res.body.error?.code).toBe('OUTPUT_REPORT_INVALID');
      });
  });

  it('moderator-only routes return MODERATION_FORBIDDEN for non-moderators', async () => {
    await request(app!.getHttpServer())
      .get('/v1/moderation/output-reports')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'MODERATION_FORBIDDEN',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .get('/v1/moderation/output-reports/any-report-id')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.error?.code).toBe('MODERATION_FORBIDDEN');
      });

    await request(app!.getHttpServer())
      .post('/v1/moderation/output-reports/any-report-id/actions')
      .set(e2eAuthHeaders)
      .send({ actionType: 'DISMISS' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error?.code).toBe('MODERATION_FORBIDDEN');
      });
  });

  it('support diagnostics endpoint returns SUPPORT_DIAGNOSTICS_FORBIDDEN for non-support users', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/job-diagnostics?jobId=any-job-id')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support recovery playbooks endpoint returns SUPPORT_DIAGNOSTICS_FORBIDDEN for non-support users', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/recovery-playbooks?failureCategory=validation')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support diagnostics endpoint returns normalized diagnostics payload for support callers', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-support-diagnostics-retryable';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      traceId: 'trace-support-job-1',
      status: 'failed',
      failedAtMs: nowMs,
      updatedAtMs: nowMs,
      failure: {
        retryable: true,
        reasonCode: 'PROCESSING_FAILED_RETRYABLE',
        nextAction: 'retry',
        message: 'Processing failed. You can retry this job.',
      },
    });

    await request(app!.getHttpServer())
      .get(`/v1/support/job-diagnostics?jobId=${jobId}`)
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId,
          ownerUserId: 'test-user-uid',
          status: 'failed',
          traceId: 'trace-support-job-1',
          failureCategory: 'processing-retryable',
          failedAt: expect.any(String),
          updatedAt: expect.any(String),
          failure: {
            retryable: true,
            reasonCode: 'PROCESSING_FAILED_RETRYABLE',
            nextAction: 'retry',
          },
        });
      });
  });

  it('support diagnostics endpoint returns deterministic not-found envelope', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/job-diagnostics?jobId=does-not-exist')
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support diagnostics endpoint returns invalid-query envelope when jobId is missing', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/job-diagnostics')
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_INVALID_QUERY',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support diagnostics endpoint allows moderator callers (same guard as support)', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-support-diagnostics-moderator';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      traceId: 'trace-mod-job-1',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .get(`/v1/support/job-diagnostics?jobId=${jobId}`)
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          jobId,
          ownerUserId: 'test-user-uid',
          status: 'ready',
          traceId: 'trace-mod-job-1',
          failureCategory: 'unknown',
        });
      });
  });

  it('support recovery playbooks endpoint returns playbook payload for support callers', async () => {
    await request(app!.getHttpServer())
      .get(
        '/v1/support/recovery-playbooks?failureCategory=processing-retryable&reasonCode=PROCESSING_FAILED_RETRYABLE',
      )
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          requestedCategory: 'processing-retryable',
          requestedReasonCode: 'PROCESSING_FAILED_RETRYABLE',
          usedFallback: false,
        });
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0]).toMatchObject({
          id: 'processing-retryable-known',
          failureCategory: 'processing-retryable',
          retryGuidance: 'retry',
        });
      });
  });

  it('support recovery playbooks endpoint returns unknown-category fallback playbook for support callers', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/recovery-playbooks?failureCategory=unknown')
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          requestedCategory: 'unknown',
          usedFallback: false,
        });
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0]).toMatchObject({
          id: 'unknown-fallback',
          failureCategory: 'unknown',
        });
        expect(res.body.data.items[0].title).toEqual(expect.any(String));
        expect(res.body.data.items[0].nextSteps.length).toBeGreaterThan(0);
      });
  });

  it('support recovery playbooks endpoint returns invalid-query envelope for unknown failureCategory value', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/recovery-playbooks?failureCategory=not-a-category')
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support recovery playbooks endpoint allows moderator callers (same guard as support)', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/recovery-playbooks?failureCategory=validation')
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          requestedCategory: 'validation',
          usedFallback: false,
        });
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].failureCategory).toBe('validation');
      });
  });

  it('support quality-tier comparison endpoint returns aggregate rows for support callers', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'e2e-quality-tier-comparison-ready',
      userId: 'test-user-uid',
      status: 'ready',
      qualityTier: 4,
      queuedAtMs: nowMs - 1_000,
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    jobsService.__testSeedJob({
      jobId: 'e2e-quality-tier-comparison-failed',
      userId: 'test-user-uid',
      status: 'failed',
      qualityTier: 4,
      failedAtMs: nowMs,
      updatedAtMs: nowMs,
      failure: {
        retryable: false,
        reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
        nextAction: 'contact_support',
        message: 'Processing failed and cannot be retried.',
      },
    });

    await request(app!.getHttpServer())
      .get('/v1/support/quality-tier-comparison')
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.schemaVersion).toBe(
          QUALITY_TIER_COMPARISON_SCHEMA_VERSION,
        );
        expect(res.body.data.rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              qualityTier: 4,
              terminalJobCount: 2,
              completedJobCount: 1,
              completionRate: 0.5,
            }),
          ]),
        );
      });
  });

  it('support quality-tier comparison endpoint returns SUPPORT_DIAGNOSTICS_FORBIDDEN for non-support users', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/quality-tier-comparison')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('support quality-tier comparison endpoint allows moderator callers (same guard as support)', async () => {
    await request(app!.getHttpServer())
      .get('/v1/support/quality-tier-comparison')
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.schemaVersion).toBe(
          QUALITY_TIER_COMPARISON_SCHEMA_VERSION,
        );
        expect(Array.isArray(res.body.data.rows)).toBe(true);
        expect(res.body.data.metricSources?.joinKeys).toEqual([
          'jobId',
          'qualityTier',
        ]);
      });
  });

  it('support escalation endpoints return forbidden for non-support users', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-support-escalation-forbidden-job';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      traceId: 'trace-escalation-forbidden-job',
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
    const created = await request(app!.getHttpServer())
      .post('/v1/support/escalations')
      .set(e2eSupportAuthHeaders)
      .send({
        jobId,
        userImpactSummary:
          'Customer is blocked and requires urgent support-to-engineering escalation.',
      })
      .expect(201);
    const escalationId = created.body.data.escalationId as string;

    await request(app!.getHttpServer())
      .post('/v1/support/escalations')
      .set(e2eAuthHeaders)
      .send({
        jobId: 'job-any',
        userImpactSummary:
          'Customer is blocked and cannot continue with their workflow now.',
      })
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .get('/v1/support/escalations?jobId=job-any')
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });

    await request(app!.getHttpServer())
      .get(`/v1/support/escalations/${escalationId}`)
      .set(e2eAuthHeaders)
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .patch(`/v1/support/escalations/${escalationId}`)
      .set(e2eAuthHeaders)
      .send({
        status: 'resolved',
        resolutionNotes: 'Should not be accepted for non-support users.',
      })
      .expect(403)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_DIAGNOSTICS_FORBIDDEN',
          retryable: false,
        });
      });
  });

  it('support caller can create, list, get, and update escalation', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-support-escalation-job';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      traceId: 'trace-escalation-job-1',
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

    const created = await request(app!.getHttpServer())
      .post('/v1/support/escalations')
      .set(e2eSupportAuthHeaders)
      .send({
        jobId,
        userImpactSummary:
          'Enterprise customer launch is blocked and needs urgent engineering support.',
        recoveryPlaybookId: 'processing-non-retryable-default',
      })
      .expect(201);

    expect(created.body.error).toBeNull();
    expect(created.body.data).toMatchObject({
      jobId,
      actorUserId: 'test-support-uid',
      status: 'open',
      userImpactSummary:
        'Enterprise customer launch is blocked and needs urgent engineering support.',
      diagnosticsSnapshot: {
        jobId,
        traceId: 'trace-escalation-job-1',
        failureCategory: 'processing-non-retryable',
        recoveryPlaybookId: 'processing-non-retryable-default',
      },
    });
    const escalationId = created.body.data.escalationId as string;

    // Escalation snapshot is point-in-time and must not be rewritten by later job changes.
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      traceId: 'trace-escalation-job-updated',
      status: 'ready',
      readyAtMs: nowMs + 500,
      updatedAtMs: nowMs + 500,
    });

    await request(app!.getHttpServer())
      .get(`/v1/support/escalations/${escalationId}`)
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.escalationId).toBe(escalationId);
        expect(res.body.data.status).toBe('open');
        expect(res.body.data.diagnosticsSnapshot.traceId).toBe(
          'trace-escalation-job-1',
        );
        expect(res.body.data.diagnosticsSnapshot.failureCategory).toBe(
          'processing-non-retryable',
        );
      });

    await request(app!.getHttpServer())
      .get(`/v1/support/escalations?jobId=${jobId}&status=open`)
      .set(e2eSupportAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].escalationId).toBe(escalationId);
      });

    await request(app!.getHttpServer())
      .patch(`/v1/support/escalations/${escalationId}`)
      .set(e2eSupportAuthHeaders)
      .send({
        status: 'resolved',
        resolutionNotes: 'Issue mitigated after infra rollback.',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data).toMatchObject({
          escalationId,
          status: 'resolved',
          resolutionNotes: 'Issue mitigated after infra rollback.',
        });
      });
  });

  it('support escalation create returns deterministic errors for invalid payload and unknown job', async () => {
    await request(app!.getHttpServer())
      .post('/v1/support/escalations')
      .set(e2eSupportAuthHeaders)
      .send({ jobId: '   ', userImpactSummary: 'too short' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_ESCALATION_INVALID_BODY',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .post('/v1/support/escalations')
      .set(e2eSupportAuthHeaders)
      .send({
        jobId: 'missing-job',
        userImpactSummary:
          'A valid summary that still references a non-existent diagnostics record.',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'SUPPORT_ESCALATION_JOB_NOT_FOUND',
          retryable: false,
        });
      });
  });

  it('moderator can list detail and action moderation reports end-to-end', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const jobId = 'e2e-moderation-report-flow';
    jobsService.__testSeedJob({
      jobId,
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const reportCreate = await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${jobId}/reports`)
      .set(e2eAuthHeaders)
      .send({
        reasonCategory: 'HARASSMENT',
        details: 'threatening language',
      })
      .expect(201);
    const reportId = reportCreate.body.data.reportId as string;

    await request(app!.getHttpServer())
      .get('/v1/moderation/output-reports?page=1&pageSize=10')
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.items[0]).toMatchObject({
          reportId,
          jobId,
          reporterUserId: 'test-user-uid',
          reasonCategory: 'HARASSMENT',
          job: {
            status: 'ready',
            userId: 'test-user-uid',
          },
        });
      });

    await request(app!.getHttpServer())
      .get(`/v1/moderation/output-reports/${reportId}`)
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.actions).toEqual([]);
      });

    await request(app!.getHttpServer())
      .post(`/v1/moderation/output-reports/${reportId}/actions`)
      .set(e2eModeratorAuthHeaders)
      .send({
        actionType: 'ESCALATE',
        notes: 'escalating to trust team',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.action).toMatchObject({
          reportId,
          jobId,
          actorUserId: 'test-moderator-uid',
          actionType: 'ESCALATE',
        });
      });

    await request(app!.getHttpServer())
      .get(`/v1/moderation/output-reports/${reportId}`)
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.actions).toHaveLength(1);
        expect(res.body.data.actions[0]).toMatchObject({
          reportId,
          actionType: 'ESCALATE',
        });
      });
  });

  it('moderation queue lists reports newest-first', async () => {
    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    const olderJobId = 'e2e-queue-order-older';
    const newerJobId = 'e2e-queue-order-newer';
    jobsService.__testSeedJob({
      jobId: olderJobId,
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    jobsService.__testSeedJob({
      jobId: newerJobId,
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const first = await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${olderJobId}/reports`)
      .set(e2eAuthHeaders)
      .send({ reasonCategory: 'SPAM' })
      .expect(201);
    const second = await request(app!.getHttpServer())
      .post(`/v1/generation-jobs/${newerJobId}/reports`)
      .set(e2eAuthHeaders)
      .send({ reasonCategory: 'HATE' })
      .expect(201);

    const olderReportId = first.body.data.reportId as string;
    const newerReportId = second.body.data.reportId as string;

    await request(app!.getHttpServer())
      .get('/v1/moderation/output-reports?page=1&pageSize=10')
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        const items = res.body.data.items as Array<{ reportId: string }>;
        const idxNewer = items.findIndex((i) => i.reportId === newerReportId);
        const idxOlder = items.findIndex((i) => i.reportId === olderReportId);
        expect(idxNewer).toBeLessThan(idxOlder);
      });
  });

  it('moderator detail/action returns MODERATION_REPORT_NOT_FOUND for missing report', async () => {
    await request(app!.getHttpServer())
      .get('/v1/moderation/output-reports/not-real')
      .set(e2eModeratorAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'MODERATION_REPORT_NOT_FOUND',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .post('/v1/moderation/output-reports/not-real/actions')
      .set(e2eModeratorAuthHeaders)
      .send({ actionType: 'DISMISS' })
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'MODERATION_REPORT_NOT_FOUND',
          retryable: false,
        });
      });
  });

  it('moderator can apply + clear abuse restriction and restricted users are blocked for create/export', async () => {
    await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions')
      .set(e2eModeratorAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'abuse triage',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.restriction).toMatchObject({
          subjectType: 'account',
          subjectId: 'test-user-uid',
          source: 'manual',
        });
      });

    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-abuse-create-blocked')
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'ABUSE_RESTRICTION_ACTIVE',
          retryable: false,
        });
      });

    const jobsService = app!.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'e2e-abuse-export-blocked',
      userId: 'test-user-uid',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs/e2e-abuse-export-blocked/export')
      .set(e2eAuthHeaders)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'ABUSE_RESTRICTION_ACTIVE',
          retryable: false,
        });
      });

    await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions/clear')
      .set(e2eModeratorAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'cleared after review',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.restriction.clearedBy).toBe('test-moderator-uid');
      });
  });

  it('abuse restriction check runs before policy screening and blocks without policy code', async () => {
    await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions')
      .set(e2eModeratorAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'ordering test',
      })
      .expect(201);

    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = '__e2e_block__';
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const body = validGenerationJobBody();
    body.image.uri = 'file:///library/__e2e_block__/photo.jpg';

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-abuse-before-policy')
      .send(body)
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error.code).toBe('ABUSE_RESTRICTION_ACTIVE');
        expect(res.body.error.code).not.toBe('POLICY_VIOLATION');
      });
  });

  it('non-moderator cannot mutate abuse restrictions', async () => {
    await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions')
      .set(e2eAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'abuse triage',
      })
      .expect(403)
      .expect((res) => {
        expect(res.body.error?.code).toBe('MODERATION_FORBIDDEN');
      });
  });

  it('abuse restriction operations append audit records', async () => {
    const apply = await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions')
      .set(e2eModeratorAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'audit apply',
      })
      .expect(201);

    await request(app!.getHttpServer())
      .post('/v1/moderation/abuse-restrictions/clear')
      .set(e2eModeratorAuthHeaders)
      .send({
        subjectType: 'account',
        subjectId: 'test-user-uid',
        reason: 'audit clear',
      })
      .expect(201);

    const storePath = path.join(abuseDataDir, 'abuse-restrictions.json');
    const persisted = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as {
      audits?: Array<{ action: string; restriction_id: string }>;
    };
    expect(Array.isArray(persisted.audits)).toBe(true);
    const audits = persisted.audits ?? [];
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(audits.some((audit) => audit.action === 'apply')).toBe(true);
    expect(audits.some((audit) => audit.action === 'clear')).toBe(true);
    expect(audits[0]?.restriction_id).toEqual(
      apply.body.data.restriction.restrictionId,
    );
  });

  it('automated threshold creates restriction when configured limit is crossed', async () => {
    process.env.BANYONE_ABUSE_THRESHOLD_MAX_JOBS = '1';
    process.env.BANYONE_ABUSE_THRESHOLD_WINDOW_MS = '60000';
    await app?.close();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-auto-1')
      .send(validGenerationJobBody())
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-auto-2')
      .send(validGenerationJobBody())
      .expect(201)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error.code).toBe('ABUSE_RESTRICTION_ACTIVE');
      });
  });

  it('POST /v1/generation-jobs persists qualityTier and GET returns it while queued', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const create = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-quality-tier-story-52')
      .send({ ...validGenerationJobBody(), qualityTier: 3 })
      .expect(201);

    expect(create.body.error).toBeNull();
    const jobId = create.body.data.jobId as string;

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.jobId).toBe(jobId);
        expect(res.body.data.qualityTier).toBe(3);
      });
  });

  it('POST /v1/generation-jobs defaults qualityTier when omitted', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const create = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-quality-tier-default-52')
      .send(validGenerationJobBody())
      .expect(201);

    expect(create.body.error).toBeNull();
    const jobId = create.body.data.jobId as string;

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${jobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.error).toBeNull();
        expect(res.body.data.qualityTier).toBe(DEFAULT_QUALITY_TIER);
      });
  });

  it('POST /v1/generation-jobs normalizes out-of-range qualityTier', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const low = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-quality-tier-low-52')
      .send({ ...validGenerationJobBody(), qualityTier: 0 })
      .expect(201);
    expect(low.body.error).toBeNull();
    const lowJobId = low.body.data.jobId as string;

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${lowJobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.qualityTier).toBe(1);
      });

    const high = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-quality-tier-high-52')
      .send({ ...validGenerationJobBody(), qualityTier: 500 })
      .expect(201);
    expect(high.body.error).toBeNull();
    const highJobId = high.body.data.jobId as string;

    await request(app!.getHttpServer())
      .get(`/v1/generation-jobs/${highJobId}`)
      .set(e2eAuthHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.qualityTier).toBe(99);
      });
  });

  it('GET /v1/generation-jobs/:id returns timeToPreviewMs and emits telemetry.job.lifecycle.metrics.v1 on ready terminal', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const jobsService = app!.get(JobsService);
      const jobId = 'e2e-lifecycle-metrics-ready2';
      const nowMs = Date.now();
      const queuedAtMs = nowMs - 50_000;
      jobsService.__testSeedJob({
        jobId,
        status: 'processing',
        qualityTier: 2,
        queuedAtMs,
        processingAtMs: nowMs - 100_000,
        updatedAtMs: nowMs - 100_000,
      });

      const res = await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200);

      expect(res.body.error).toBeNull();
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.qualityTier).toBe(2);
      expect(typeof res.body.data.timeToPreviewMs).toBe('number');
      expect(res.body.data.timeToPreviewMs).toBeGreaterThan(49_000);
      expect(res.body.data.timeToPreviewMs).toBeLessThan(120_000);

      const metricsCall = consoleSpy.mock.calls.find(
        (call) => call[0] === JOB_LIFECYCLE_METRICS_LOG_KEY,
      );
      expect(metricsCall).toBeDefined();
      expect(metricsCall![1]).toMatchObject({
        schemaVersion: JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
        jobId,
        terminalStatus: 'ready',
        qualityTier: 2,
        timeToPreviewMs: res.body.data.timeToPreviewMs,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('GET /v1/generation-jobs/:id emits lifecycle metrics with null timeToPreviewMs on failed terminal', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const jobsService = app!.get(JobsService);
      const jobId = 'e2e-lifecycle-metrics-fail0';
      const nowMs = Date.now();
      const queuedAtMs = nowMs - 50_000;
      jobsService.__testSeedJob({
        jobId,
        status: 'processing',
        qualityTier: 4,
        queuedAtMs,
        processingAtMs: nowMs - 100_000,
        updatedAtMs: nowMs - 100_000,
      });

      await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200)
        .expect((res) => {
          expect(res.body.error).toBeNull();
          expect(res.body.data.status).toBe('failed');
          expect(res.body.data.qualityTier).toBe(4);
          expect(res.body.data.timeToPreviewMs).toBeUndefined();
        });

      const metricsCall = consoleSpy.mock.calls.find(
        (call) => call[0] === JOB_LIFECYCLE_METRICS_LOG_KEY,
      );
      expect(metricsCall).toBeDefined();
      expect(metricsCall![1]).toMatchObject({
        schemaVersion: JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
        jobId,
        terminalStatus: 'failed',
        qualityTier: 4,
        timeToPreviewMs: null,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('GET /v1/generation-jobs/:id persists one terminal cost snapshot and emits cost signal once', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const jobsService = app!.get(JobsService);
      const jobId = 'e2e-cost-signal-ready2';
      const nowMs = Date.now();
      jobsService.__testSeedJob({
        jobId,
        status: 'processing',
        qualityTier: 2,
        queuedAtMs: nowMs - 75_000,
        processingAtMs: nowMs - 100_000,
        updatedAtMs: nowMs - 100_000,
      });

      await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200)
        .expect((res) => {
          expect(res.body.error).toBeNull();
          expect(res.body.data.status).toBe('ready');
          expect(res.body.data).not.toHaveProperty('jobCostSignalV1');
          expect(res.body.data).not.toHaveProperty('estimatedCost');
        });

      await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200)
        .expect((res) => {
          expect(res.body.error).toBeNull();
          expect(res.body.data.status).toBe('ready');
          expect(res.body.data).not.toHaveProperty('jobCostSignalV1');
        });

      const storePath = path.join(dataDir, 'jobs-store.json');
      const persisted = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as {
        jobs: Record<
          string,
          {
            jobCostSignalV1?: {
              schemaVersion: number;
              terminalStatus: string;
              qualityTier: number;
              estimatedCost: { amount: number; currencyCode: string };
              costModelVersion: string;
            };
          }
        >;
      };

      expect(persisted.jobs[jobId]?.jobCostSignalV1).toMatchObject({
        schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
        terminalStatus: 'ready',
        qualityTier: 2,
        estimatedCost: {
          amount: expect.any(Number),
          currencyCode: 'USD',
        },
        costModelVersion: JOB_COST_MODEL_VERSION_V1,
      });

      const costCalls = consoleSpy.mock.calls.filter(
        (call) => call[0] === JOB_COST_SIGNAL_LOG_KEY,
      );
      expect(costCalls).toHaveLength(1);
      expect(costCalls[0]?.[1]).toMatchObject({
        schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
        jobId,
        terminalStatus: 'ready',
        qualityTier: 2,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('GET /v1/generation-jobs/:id persists failed-terminal cost snapshot and emits cost signal once', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const jobsService = app!.get(JobsService);
      const jobId = 'e2e-cost-signal-fail0';
      const nowMs = Date.now();
      jobsService.__testSeedJob({
        jobId,
        status: 'processing',
        qualityTier: 5,
        queuedAtMs: nowMs - 75_000,
        processingAtMs: nowMs - 100_000,
        updatedAtMs: nowMs - 100_000,
      });

      await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200)
        .expect((res) => {
          expect(res.body.error).toBeNull();
          expect(res.body.data.status).toBe('failed');
          expect(res.body.data).not.toHaveProperty('jobCostSignalV1');
        });

      await request(app!.getHttpServer())
        .get(`/v1/generation-jobs/${jobId}`)
        .set(e2eAuthHeaders)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('failed');
        });

      const storePath = path.join(dataDir, 'jobs-store.json');
      const persisted = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as {
        jobs: Record<
          string,
          {
            jobCostSignalV1?: {
              schemaVersion: number;
              terminalStatus: string;
              qualityTier: number;
              estimatedCost: { amount: number; currencyCode: string };
              costModelVersion: string;
            };
          }
        >;
      };

      expect(persisted.jobs[jobId]?.jobCostSignalV1).toMatchObject({
        schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
        terminalStatus: 'failed',
        qualityTier: 5,
        estimatedCost: {
          amount: expect.any(Number),
          currencyCode: 'USD',
        },
        costModelVersion: JOB_COST_MODEL_VERSION_V1,
      });

      const costCalls = consoleSpy.mock.calls.filter(
        (call) => call[0] === JOB_COST_SIGNAL_LOG_KEY,
      );
      expect(costCalls).toHaveLength(1);
      expect(costCalls[0]?.[1]).toMatchObject({
        schemaVersion: JOB_COST_SIGNAL_SCHEMA_VERSION,
        jobId,
        terminalStatus: 'failed',
        qualityTier: 5,
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('POST /v1/generation-jobs returns 500 when service throws unexpectedly', async () => {
    await request(app!.getHttpServer())
      .post('/v1/synthetic-media-disclosure/acknowledge')
      .set(e2eAuthHeaders)
      .send({ version: 'v1' })
      .expect(200);

    const jobsService = app!.get(JobsService);
    const createSpy = jest
      .spyOn(jobsService, 'createGenerationJob')
      .mockRejectedValueOnce(new Error('simulated internal failure'));

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set(e2eAuthHeaders)
      .set('x-banyone-idempotency-key', 'idem-key-service-throw')
      .send(validGenerationJobBody())
      .expect(500);

    createSpy.mockRestore();
  });
});
