import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';
import { FirestoreModule } from '../../infra/firestore.module';
import { AbuseModule } from '../abuse/abuse.module';
import { AuthModule } from '../auth/auth.module';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { DisclosureModule } from '../disclosure/disclosure.module';
import { JobPolicyModule } from '../job-policy/job-policy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobMediaAssetsService } from './job-media-assets.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ReplicateGenerationProvider } from './replicate-generation.provider';
import { UserCreditsStore } from './user-credits.store';

@Module({
  imports: [
    FirestoreModule,
    AbuseModule,
    AuthModule,
    DisclosureModule,
    JobPolicyModule,
    NotificationsModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { ttlMs, limit } = resolveBanyoneThrottleConfig();
        return { throttlers: [{ name: 'default', ttl: ttlMs, limit }] };
      },
    }),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    BanyoneUserThrottlerGuard,
    ReplicateGenerationProvider,
    JobMediaAssetsService,
    UserCreditsStore,
  ],
  exports: [JobsService, UserCreditsStore],
})
export class JobsModule {}
