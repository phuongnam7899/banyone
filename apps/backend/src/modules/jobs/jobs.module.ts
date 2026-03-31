import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';
import { AuthModule } from '../auth/auth.module';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { DisclosureModule } from '../disclosure/disclosure.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    AuthModule,
    DisclosureModule,
    NotificationsModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { ttlMs, limit } = resolveBanyoneThrottleConfig();
        return { throttlers: [{ name: 'default', ttl: ttlMs, limit }] };
      },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService, BanyoneUserThrottlerGuard],
})
export class JobsModule {}
