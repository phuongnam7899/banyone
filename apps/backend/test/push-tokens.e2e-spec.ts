import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  BANYONE_TEST_FIREBASE_ID_TOKEN,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@banyone/contracts';

import { AppModule } from '../src/app.module';
import { PushTokensStore } from '../src/modules/notifications/push-tokens.store';

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

describe('Push tokens (e2e) — Story 2.4 lifecycle push', () => {
  let app: INestApplication<App> | undefined;
  let jobsDataDir: string;
  let notifDataDir: string;

  const authHeaders = {
    Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
  };

  beforeEach(async () => {
    jobsDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banyone-jobs-e2e-'));
    notifDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'banyone-notif-push-e2e-'),
    );
    process.env.BANYONE_JOBS_DATA_DIR = jobsDataDir;
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = notifDataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'e2e-push-user';

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
    fs.rmSync(jobsDataDir, { recursive: true, force: true });
    fs.rmSync(notifDataDir, { recursive: true, force: true });
  });

  it('POST /v1/push-tokens returns 401 without Authorization', () => {
    return request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .send({ fcmToken: 'tok' })
      .expect(401)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'UNAUTHENTICATED',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('POST /v1/push-tokens returns 401 for invalid bearer token (test verifier)', () => {
    return request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set('Authorization', 'Bearer not-the-test-token')
      .send({ fcmToken: 'tok' })
      .expect(401)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'INVALID_ID_TOKEN',
          retryable: false,
        });
      });
  });

  it('POST /v1/push-tokens returns success envelope and persists trimmed token', async () => {
    await request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeaders)
      .send({ fcmToken: '  e2e-fcm-token  ' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ data: { ok: true }, error: null });
      });

    const store = app!.get(PushTokensStore);
    expect(store.getTokensForUser('e2e-push-user')).toEqual(['e2e-fcm-token']);
  });

  it('POST /v1/push-tokens returns PUSH_TOKEN_INVALID envelope when fcmToken missing', () => {
    return request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeaders)
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'PUSH_TOKEN_INVALID',
          message: 'Request body must include a non-empty fcmToken string.',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });

  it('DELETE /v1/push-tokens with empty body clears all tokens for the user', async () => {
    await request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeaders)
      .send({ fcmToken: 't1' })
      .expect(200);

    await request(app!.getHttpServer())
      .delete('/v1/push-tokens')
      .set(authHeaders)
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ data: { ok: true }, error: null });
      });

    expect(app!.get(PushTokensStore).getTokensForUser('e2e-push-user')).toEqual(
      [],
    );
  });

  it('DELETE /v1/push-tokens with fcmToken removes only that registration', async () => {
    await request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeaders)
      .send({ fcmToken: 'keep-me' })
      .expect(200);
    await request(app!.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeaders)
      .send({ fcmToken: 'remove-me' })
      .expect(200);

    await request(app!.getHttpServer())
      .delete('/v1/push-tokens')
      .set(authHeaders)
      .send({ fcmToken: 'remove-me' })
      .expect(200);

    expect(app!.get(PushTokensStore).getTokensForUser('e2e-push-user')).toEqual(
      ['keep-me'],
    );
  });

  it('GET /v1/notification-preferences returns defaults for user with no saved row', async () => {
    await request(app!.getHttpServer())
      .get('/v1/notification-preferences')
      .set(authHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          data: { preferences: DEFAULT_NOTIFICATION_PREFERENCES },
          error: null,
        });
      });
  });

  it('PUT /v1/notification-preferences persists settings and GET returns saved values', async () => {
    const next = {
      lifecycle: { jobQueued: false, jobReady: true, jobFailed: false },
    };

    await request(app!.getHttpServer())
      .put('/v1/notification-preferences')
      .set(authHeaders)
      .send(next)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          data: { preferences: next },
          error: null,
        });
      });

    await request(app!.getHttpServer())
      .get('/v1/notification-preferences')
      .set(authHeaders)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          data: { preferences: next },
          error: null,
        });
      });
  });

  it('PUT /v1/notification-preferences validates payload and returns canonical error envelope', async () => {
    await request(app!.getHttpServer())
      .put('/v1/notification-preferences')
      .set(authHeaders)
      .send({ lifecycle: { jobQueued: true } })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.error).toMatchObject({
          code: 'NOTIFICATION_PREFERENCES_INVALID',
          retryable: false,
        });
        expect(res.body.error.traceId).toEqual(expect.any(String));
      });
  });
});
