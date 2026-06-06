import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/current-user.decorator';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UserCreditsStore } from '../jobs/user-credits.store';
import {
  isBanyoneBillingProductId,
  resolveCreditGrantForProduct,
  type BanyoneBillingProductId,
} from './credit-grant-policy';

/**
 * Local development only. Grants subscription credits without a RevenueCat webhook.
 * Enable with BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS=true — never set in production.
 */
@SkipThrottle({ default: true })
@UseGuards(FirebaseAuthGuard)
@Controller('v1/billing/dev')
export class BillingDevController {
  private readonly logger = new Logger(BillingDevController.name);

  constructor(private readonly userCreditsStore: UserCreditsStore) {}

  @Post('grant-subscription-credits')
  @HttpCode(HttpStatus.OK)
  async grantSubscriptionCredits(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): Promise<{
    data: { grantedCredits: number; newBalance: number };
    error: null;
  }> {
    const productId = parseDevGrantProductId(body);
    if (!productId) {
      throw new BadRequestException(
        'body.productId must be weekly, monthly, or yearly.',
      );
    }
    const grantedCredits = resolveCreditGrantForProduct(productId);
    const { balanceAfter } = await this.userCreditsStore.credit(
      user.uid,
      grantedCredits,
    );
    this.logger.warn(
      `DEV grant: +${grantedCredits} credits for uid=${user.uid} productId=${productId} → balance ${balanceAfter}`,
    );
    return {
      data: { grantedCredits, newBalance: balanceAfter },
      error: null,
    };
  }
}

function parseDevGrantProductId(body: unknown): BanyoneBillingProductId | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as { productId?: unknown }).productId;
  return typeof raw === 'string' && isBanyoneBillingProductId(raw) ? raw : null;
}
