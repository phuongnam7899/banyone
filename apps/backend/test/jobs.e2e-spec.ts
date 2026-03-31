import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';

import { AppModule } from '../src/app.module';
import { JobsService } from '../src/modules/jobs/jobs.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
jest.setTimeout(20_000);

const e2eAuthHeaders = {
  Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
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

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-e2e-'));
    notifDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-notif-e2e-'));
    disclosureDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-disclosure-e2e-'),
    );
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = notifDataDir;
    process.env.BANYONE_DISCLOSURE_DATA_DIR = disclosureDataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';

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
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(notifDataDir, { recursive: true, force: true });
    fs.rmSync(disclosureDataDir, { recursive: true, force: true });
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
        expect(
          res.body.data.items.some((item: { jobId: string }) => item.jobId === jobId),
        ).toBe(true);
      });
  });

  it('GET unknown route returns 404', () => {
    return request(app!.getHttpServer())
      .get('/v1/generation-jobs-unknown')
      .set(e2eAuthHeaders)
      .expect(404);
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
