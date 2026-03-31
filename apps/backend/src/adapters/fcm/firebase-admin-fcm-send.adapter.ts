import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { getOrInitializeFirebaseAdminApp } from '../../infra/firebase-admin-app';

import type { FcmOutMessage, FcmSendPort } from './fcm-send.port';

@Injectable()
export class FirebaseAdminFcmSendAdapter implements FcmSendPort {
  private readonly logger = new Logger(FirebaseAdminFcmSendAdapter.name);

  async sendToDevice(message: FcmOutMessage): Promise<void> {
    try {
      let app: admin.app.App;
      try {
        app = getOrInitializeFirebaseAdminApp();
      } catch (initErr) {
        this.logger.warn(
          'FCM skipped: Firebase Admin not configured for messaging',
          {
            err: initErr instanceof Error ? initErr.message : String(initErr),
          },
        );
        return;
      }
      await admin.messaging(app).send({
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        'FCM send failed (assistive push; lifecycle remains canonical)',
        {
          err: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }
}
