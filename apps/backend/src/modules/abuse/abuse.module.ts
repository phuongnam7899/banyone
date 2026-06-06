import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';
import { AuthModule } from '../auth/auth.module';
import { AbuseController } from './abuse.controller';
import { AbuseRestrictionStore } from './abuse-restriction.store';
import { AbuseService } from './abuse.service';

@Module({
  imports: [
    AuthModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const { ttlMs, limit } = resolveBanyoneThrottleConfig();
        return { throttlers: [{ name: 'default', ttl: ttlMs, limit }] };
      },
    }),
  ],
  controllers: [AbuseController],
  providers: [AbuseService, AbuseRestrictionStore],
  exports: [AbuseService],
})
export class AbuseModule {}
