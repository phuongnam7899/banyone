/* eslint-disable @typescript-eslint/no-unsafe-argument -- supertest */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import * as os from 'os';
import { mkdtempSync, rmSync } from 'fs';

import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';

import { ThrottlerEnvelopeExceptionFilter } from '../auth/throttler-envelope.filter';
import { NotificationsModule } from './notifications.module';
import { PushTokensStore } from './push-tokens.store';

describe('PushTokensController', () => {
  let app: INestApplication;
  let dataDir: string;
  const authHeader = {
    Authorization: `Bearer ${BANYONE_TEST_FIREBASE_ID_TOKEN}`,
  };

  beforeEach(async () => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-push-ctx-'));
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = dataDir;
    process.env.BANYONE_AUTH_VERIFIER = 'test';
    process.env.BANYONE_AUTH_TEST_UID = 'test-user-uid';

    const moduleRef = await Test.createTestingModule({
      imports: [NotificationsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ThrottlerEnvelopeExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    rmSync(dataDir, { recursive: true, force: true });
    delete process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    delete process.env.BANYONE_AUTH_VERIFIER;
    delete process.env.BANYONE_AUTH_TEST_UID;
  });

  it('POST /v1/push-tokens rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/v1/push-tokens')
      .send({ fcmToken: 'tok' })
      .expect(401);
  });

  it('POST /v1/push-tokens registers token for user', async () => {
    await request(app.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeader)
      .send({ fcmToken: 'my-fcm-token' })
      .expect(200);

    const store = app.get(PushTokensStore);
    expect(store.getTokensForUser('test-user-uid')).toEqual(['my-fcm-token']);
  });

  it('POST /v1/push-tokens returns envelope error for invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeader)
      .send({})
      .expect(200);

    const body = res.body as {
      data: unknown;
      error: { code?: string };
    };
    expect(body.data).toBeNull();
    expect(body.error?.code).toBe('PUSH_TOKEN_INVALID');
  });

  it('DELETE /v1/push-tokens clears tokens for user', async () => {
    await request(app.getHttpServer())
      .post('/v1/push-tokens')
      .set(authHeader)
      .send({ fcmToken: 'x' })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/v1/push-tokens')
      .set(authHeader)
      .send({})
      .expect(200);

    const store = app.get(PushTokensStore);
    expect(store.getTokensForUser('test-user-uid')).toEqual([]);
  });
});
