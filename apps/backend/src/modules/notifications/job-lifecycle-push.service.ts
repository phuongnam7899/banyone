import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  buildJobLifecyclePushDataFields,
  jobLifecyclePushDataToFcmData,
  type JobLifecycleNotificationKind,
} from '@banyone/contracts';

import {
  FCM_SEND_PORT,
  type FcmSendPort,
} from '../../adapters/fcm/fcm-send.port';

import {
  PushNotificationDedupeStore,
  lifecyclePushDedupeKey,
} from './push-notification-dedupe.store';
import { NotificationPreferencesStore } from './notification-preferences.store';
import { PushTokensStore } from './push-tokens.store';

@Injectable()
export class JobLifecyclePushService {
  private readonly logger = new Logger(JobLifecyclePushService.name);

  constructor(
    @Inject(FCM_SEND_PORT) private readonly fcm: FcmSendPort,
    private readonly tokens: PushTokensStore,
    private readonly preferences: NotificationPreferencesStore,
    private readonly dedupe: PushNotificationDedupeStore,
  ) {}

  /**
   * Fire-and-forget: never throws; push failures must not affect job lifecycle.
   */
  notifyJobQueued(userId: string, jobId: string): void {
    void this.sendKind(userId, jobId, 'job_queued', {
      title: 'Job accepted',
      body: 'Your generation job is queued. We will notify you when it is ready.',
    });
  }

  notifyJobReady(userId: string, jobId: string): void {
    void this.sendKind(userId, jobId, 'job_ready', {
      title: 'Your video is ready',
      body: 'Open Banyone to view and export your result.',
    });
  }

  notifyJobFailed(
    userId: string,
    jobId: string,
    failure: {
      retryable: boolean;
      reasonCode: string;
      nextAction: string;
      message: string;
    },
  ): void {
    const retryHint =
      failure.retryable && failure.nextAction === 'retry'
        ? ' You can retry from the job status screen.'
        : '';
    void this.sendKind(userId, jobId, 'job_failed', {
      title: 'Processing failed',
      body: `${failure.message}${retryHint}`,
    });
  }

  private async sendKind(
    userId: string,
    jobId: string,
    kind: JobLifecycleNotificationKind,
    copy: { title: string; body: string },
  ): Promise<void> {
    try {
      if (!this.shouldSendKind(userId, kind)) return;

      const key = lifecyclePushDedupeKey({ userId, jobId, kind });
      const first = this.dedupe.tryMarkSent(key);
      if (!first) return;

      const tokens = this.tokens.getTokensForUser(userId);
      if (tokens.length === 0) return;

      const dataFields = buildJobLifecyclePushDataFields({ jobId, kind });
      const data = jobLifecyclePushDataToFcmData(dataFields);

      await Promise.all(
        tokens.map((token) =>
          this.fcm.sendToDevice({
            token,
            title: copy.title,
            body: copy.body,
            data,
          }),
        ),
      );
    } catch (err) {
      this.logger.warn('Lifecycle push dispatch failed (ignored)', {
        jobId,
        kind,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private shouldSendKind(
    userId: string,
    kind: JobLifecycleNotificationKind,
  ): boolean {
    const lifecycle = this.preferences.getForUser(userId).lifecycle;
    if (kind === 'job_queued') return lifecycle.jobQueued;
    if (kind === 'job_ready') return lifecycle.jobReady;
    return lifecycle.jobFailed;
  }
}
