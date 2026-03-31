import { Test } from '@nestjs/testing';
import * as path from 'path';
import * as os from 'os';
import { mkdtempSync, rmSync } from 'fs';

import {
  FCM_SEND_PORT,
  type FcmSendPort,
} from '../../adapters/fcm/fcm-send.port';

import { JobLifecyclePushService } from './job-lifecycle-push.service';
import { NotificationPreferencesStore } from './notification-preferences.store';
import { PushNotificationDedupeStore } from './push-notification-dedupe.store';
import { PushTokensStore } from './push-tokens.store';

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((r) => setImmediate(r));
}

/* eslint-disable @typescript-eslint/unbound-method -- service methods invoked on DI-managed instances */
describe('JobLifecyclePushService', () => {
  let dataDir: string;
  let sendToDeviceMock: jest.MockedFunction<FcmSendPort['sendToDevice']>;
  let fcmMock: FcmSendPort;

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), 'banyone-notif-'));
    process.env.BANYONE_NOTIFICATIONS_DATA_DIR = dataDir;
    sendToDeviceMock = jest.fn().mockResolvedValue(undefined);
    fcmMock = { sendToDevice: sendToDeviceMock };
  });

  afterEach(() => {
    delete process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function compileService(): Promise<{
    svc: JobLifecyclePushService;
    tokens: PushTokensStore;
  preferences: NotificationPreferencesStore;
  }> {
    const mod = await Test.createTestingModule({
      providers: [
        PushTokensStore,
        NotificationPreferencesStore,
        PushNotificationDedupeStore,
        { provide: FCM_SEND_PORT, useValue: fcmMock },
        JobLifecyclePushService,
      ],
    }).compile();
    return {
      preferences: mod.get(NotificationPreferencesStore),
      tokens: mod.get(PushTokensStore),
      svc: mod.get(JobLifecyclePushService),
    };
  }

  it('sends job_queued once and includes FCM data fields', async () => {
    const { svc, tokens } = await compileService();
    tokens.upsertToken('u1', 'tok-a');
    svc.notifyJobQueued('u1', 'job-1');
    await flushAsyncWork();
    expect(sendToDeviceMock).toHaveBeenCalledTimes(1);
    const arg = sendToDeviceMock.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      token: 'tok-a',
      data: {
        jobId: 'job-1',
        kind: 'job_queued',
        screen: 'history_detail',
      },
    });
    expect(arg?.data.deepLink).toContain('history-detail');

    svc.notifyJobQueued('u1', 'job-1');
    await flushAsyncWork();
    expect(fcmMock.sendToDevice).toHaveBeenCalledTimes(1);
  });

  it('sends job_ready after queued for same job', async () => {
    const { svc, tokens } = await compileService();
    tokens.upsertToken('u1', 'tok-a');
    svc.notifyJobQueued('u1', 'job-2');
    svc.notifyJobReady('u1', 'job-2');
    await flushAsyncWork();
    expect(sendToDeviceMock).toHaveBeenCalledTimes(2);
  });

  it('includes retry-oriented body for failed job when retryable', async () => {
    const { svc, tokens } = await compileService();
    tokens.upsertToken('u1', 'tok-a');
    svc.notifyJobFailed('u1', 'job-3', {
      retryable: true,
      reasonCode: 'X',
      nextAction: 'retry',
      message: 'Processing failed.',
    });
    await flushAsyncWork();
    const payload = sendToDeviceMock.mock.calls[0]?.[0];
    expect(payload?.body).toContain('retry');
    expect(payload?.data?.kind).toBe('job_failed');
  });

  it('does not send disabled lifecycle kinds for the user', async () => {
    const { svc, tokens, preferences } = await compileService();
    preferences.updateForUser('u1', {
      lifecycle: { jobQueued: false, jobReady: true, jobFailed: false },
    });
    tokens.upsertToken('u1', 'tok-a');
    svc.notifyJobQueued('u1', 'job-4');
    svc.notifyJobReady('u1', 'job-4');
    svc.notifyJobFailed('u1', 'job-4', {
      retryable: false,
      reasonCode: 'X',
      nextAction: 'contact_support',
      message: 'Processing failed.',
    });
    await flushAsyncWork();
    expect(sendToDeviceMock).toHaveBeenCalledTimes(1);
    expect(sendToDeviceMock.mock.calls[0]?.[0].data.kind).toBe('job_ready');
  });
});
