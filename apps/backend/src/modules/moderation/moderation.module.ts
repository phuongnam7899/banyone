import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';
import { AuthModule } from '../auth/auth.module';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { JobsModule } from '../jobs/jobs.module';
import { ModerationActionStore } from './moderation-action.store';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { OutputReportStore } from './output-report.store';

@Module({
  imports: [
    AuthModule,
    JobsModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { ttlMs, limit } = resolveBanyoneThrottleConfig();
        return { throttlers: [{ name: 'default', ttl: ttlMs, limit }] };
      },
    }),
  ],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    OutputReportStore,
    ModerationActionStore,
    BanyoneUserThrottlerGuard,
  ],
})
export class ModerationModule {}
