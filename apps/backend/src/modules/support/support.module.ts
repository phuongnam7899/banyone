import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';
import { AuthModule } from '../auth/auth.module';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { BillingModule } from '../billing/billing.module';
import { JobsModule } from '../jobs/jobs.module';
import { SupportEscalationStore } from './support-escalation.store';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    JobsModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { ttlMs, limit } = resolveBanyoneThrottleConfig();
        return { throttlers: [{ name: 'default', ttl: ttlMs, limit }] };
      },
    }),
  ],
  controllers: [SupportController],
  providers: [
    SupportService,
    SupportEscalationStore,
    BanyoneUserThrottlerGuard,
  ],
})
export class SupportModule {}
