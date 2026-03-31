import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

import {
  API_RATE_LIMIT_ERROR_CODE,
  type ApiRateLimitErrorDetails,
} from '@banyone/contracts';

import { resolveBanyoneThrottleConfig } from '../../banyone-throttle.config';

@Catch(ThrottlerException)
export class ThrottlerEnvelopeExceptionFilter implements ExceptionFilter {
  catch(_exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const { ttlMs, limit } = resolveBanyoneThrottleConfig();
    const retryAfterSec = Math.max(1, Math.ceil(ttlMs / 1000));
    const traceId = randomUUID();

    const details: ApiRateLimitErrorDetails = {
      scope: 'account',
      retryAfterSec,
      windowMs: ttlMs,
      limit,
      cause: 'Account-scoped request limit reached for this window.',
    };

    res
      .status(429)
      .setHeader('Retry-After', String(retryAfterSec))
      .json({
        data: null,
        error: {
          code: API_RATE_LIMIT_ERROR_CODE,
          message:
            'Too many requests for your account. Please wait and try again.',
          retryable: true,
          traceId,
          details,
        },
      });
  }
}
