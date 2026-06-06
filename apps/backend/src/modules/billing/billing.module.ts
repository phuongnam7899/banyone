import { Module } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module';
import { BillingController } from './billing.controller';
import { BillingDevController } from './billing-dev.controller';
import { BillingService } from './billing.service';
import { RevenueCatEventDedupeStore } from './revenuecat-event-dedupe.store';
import { RevenueCatWebhookValidator } from './revenuecat-webhook.validator';

function isDevSubscriptionCreditsGrantEnabled(): boolean {
  const v = process.env.BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

const devBillingControllers = isDevSubscriptionCreditsGrantEnabled()
  ? [BillingDevController]
  : [];

@Module({
  imports: [JobsModule],
  controllers: [BillingController, ...devBillingControllers],
  providers: [
    BillingService,
    RevenueCatEventDedupeStore,
    RevenueCatWebhookValidator,
  ],
  exports: [BillingService],
})
export class BillingModule {}
