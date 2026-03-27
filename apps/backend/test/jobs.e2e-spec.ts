import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JobsService } from '../src/modules/jobs/jobs.service';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

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

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-e2e-'));
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;

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
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('POST /v1/generation-jobs returns 200 and queued envelope when inputs are valid', () => {
    return request(app!.getHttpServer())
      .post('/v1/generation-jobs')
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

  it('POST /v1/generation-jobs returns error when idempotency header is missing', () => {
    return request(app!.getHttpServer())
      .post('/v1/generation-jobs')
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

  it('POST /v1/generation-jobs returns INPUT_INVALID when validation fails', () => {
    const body = validGenerationJobBody();
    body.video.durationSec = 999;

    return request(app!.getHttpServer())
      .post('/v1/generation-jobs')
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
    const key = 'idem-key-repeat';
    const body = validGenerationJobBody();

    const first = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set('x-banyone-idempotency-key', key)
      .send(body)
      .expect(201);

    const second = await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
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

  it('GET unknown route returns 404', () => {
    return request(app!.getHttpServer())
      .get('/v1/generation-jobs-unknown')
      .expect(404);
  });

  it('POST /v1/generation-jobs returns 500 when service throws unexpectedly', async () => {
    const jobsService = app!.get(JobsService);
    const createSpy = jest
      .spyOn(jobsService, 'createGenerationJob')
      .mockRejectedValueOnce(new Error('simulated internal failure'));

    await request(app!.getHttpServer())
      .post('/v1/generation-jobs')
      .set('x-banyone-idempotency-key', 'idem-key-service-throw')
      .send(validGenerationJobBody())
      .expect(500);

    createSpy.mockRestore();
  });
});
