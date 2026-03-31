import { Module } from '@nestjs/common';

import { FirebaseAdminFcmSendAdapter } from '../../adapters/fcm/firebase-admin-fcm-send.adapter';
import { FCM_SEND_PORT } from '../../adapters/fcm/fcm-send.port';
import { NoopFcmSendAdapter } from '../../adapters/fcm/noop-fcm-send.adapter';
import { AuthModule } from '../auth/auth.module';

import { JobLifecyclePushService } from './job-lifecycle-push.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferencesStore } from './notification-preferences.store';
import { PushNotificationDedupeStore } from './push-notification-dedupe.store';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensStore } from './push-tokens.store';

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController, NotificationPreferencesController],
  providers: [
    PushTokensStore,
    NotificationPreferencesStore,
    PushNotificationDedupeStore,
    {
      provide: FCM_SEND_PORT,
      useFactory: () => {
        if (process.env.NODE_ENV === 'test') {
          return new NoopFcmSendAdapter();
        }
        return new FirebaseAdminFcmSendAdapter();
      },
    },
    JobLifecyclePushService,
  ],
  exports: [JobLifecyclePushService],
})
export class NotificationsModule {}
