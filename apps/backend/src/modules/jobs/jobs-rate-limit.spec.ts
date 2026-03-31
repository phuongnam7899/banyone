/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest with Nest INestApplication#getHttpServer() */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import * as os from 'os';
import { mkdtempSync, rmSync } from 'fs';

import {
  API_RATE_LIMIT_ERROR_CODE,
  BANYONE_TEST_FIREBASE_ID_TOKEN,
} from '@banyone/contracts';

import { ThrottlerEnvelopeExceptionFilter } from '../auth/throttler-envelope.filter';
import { JobsModule } from './jobs.module';
import { JobsService } from './jobs.service';

describe('JobsController rate limits (expensive POST routes)', () => {
  let app: INestApplication;
  let dataDir: string;
  const authHeader = {
    Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
  };

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

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-rl-'));
    process.env.BANYONE_JOBS_DATA_DIR = dataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';
    process.env.BANYONE_THROTTLE_LIMIT = '1';
    process.env.BANYONE_THROTTLE_TTL_MS = '60000';

    const moduleRef = await Test.createTestingModule({
      imports: [JobsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
    await app.init();
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
    delete process.env.BANYONE_AUTH_VERIFIER;
    delete process.env.BANYONE_AUTH_TEST_UID;
    delete process.env.BANYONE_THROTTLE_LIMIT;
    delete process.env.BANYONE_THROTTLE_TTL_MS;
  });

  it('POST /v1/generation-jobs returns 429 with canonical envelope when over limit', async () => {
    await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', 'idem-rl-1')
      .send(validBody)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs')
      .set(authHeader)
      .set('x-banyone-idempotency-key', 'idem-rl-2')
      .send(validBody)
      .expect(429);

    expect(String(res.headers['retry-after'] ?? '')).toMatch(/^\d+$/);
    const body = res.body as {
      data: null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        traceId: string;
        details: { scope: string; retryAfterSec: number };
      };
    };
    expect(body.data).toBeNull();
    expect(body.error.code).toBe(API_RATE_LIMIT_ERROR_CODE);
    expect(body.error.retryable).toBe(true);
    expect(body.error.traceId).toEqual(expect.any(String));
    expect(body.error.details.scope).toBe('account');
    expect(body.error.details.retryAfterSec).toEqual(expect.any(Number));
  });

  it('POST /v1/generation-jobs/:id/export returns 429 with canonical envelope when over limit', async () => {
    const jobsService = app.get(JobsService);
    const nowMs = Date.now();
    jobsService.__testSeedJob({
      jobId: 'job-rl-export-one',
      status: 'ready',
      readyAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    await request(app.getHttpServer())
      .post('/v1/generation-jobs/job-rl-export-one/export')
      .set(authHeader)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/generation-jobs/job-rl-export-one/export')
      .set(authHeader)
      .expect(429);

    expect(String(res.headers['retry-after'] ?? '')).toMatch(/^\d+$/);
    const exportBody = res.body as {
      data: null;
      error: { code: string; retryable: boolean };
    };
    expect(exportBody.error.code).toBe(API_RATE_LIMIT_ERROR_CODE);
    expect(exportBody.error.retryable).toBe(true);
  });
});
