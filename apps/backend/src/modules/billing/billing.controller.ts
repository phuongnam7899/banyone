import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { BillingService } from './billing.service';
import { RevenueCatWebhookValidator } from './revenuecat-webhook.validator';

@SkipThrottle({ default: true })
@Controller('v1/billing/revenuecat')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly validator: RevenueCatWebhookValidator,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: unknown,
  ): Promise<{
    data: {
      processed: boolean;
      ignored?: boolean;
      duplicate?: boolean;
      eventId?: string;
      reason?: string;
    };
    error: null;
  }> {
    if (!this.validator.isAuthorized(authorization)) {
      throw new HttpException(
        {
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid RevenueCat webhook authorization.',
            retryable: false,
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const outcome = await this.billingService.processWebhookPayload(payload);
    if (outcome.kind === 'processed') {
      this.logger.log(
        `Granted ${outcome.grantedCredits} credits to ${outcome.userId}; new balance ${outcome.newBalance}.`,
      );
      return { data: { processed: true }, error: null };
    }
    if (outcome.kind === 'duplicate') {
      return {
        data: {
          processed: false,
          duplicate: true,
          eventId: outcome.eventId,
        },
        error: null,
      };
    }
    return {
      data: {
        processed: false,
        ignored: true,
        eventId: outcome.eventId,
        reason: outcome.reason,
      },
      error: null,
    };
  }
}
