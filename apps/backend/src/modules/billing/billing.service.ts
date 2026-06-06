import { Injectable, Logger } from '@nestjs/common';

import { UserCreditsStore } from '../jobs/user-credits.store';
import {
  isGrantableEventType,
  normalizeWebhookProductId,
  resolveCreditGrantForProduct,
  type BanyoneBillingProductId,
} from './credit-grant-policy';
import { RevenueCatEventDedupeStore } from './revenuecat-event-dedupe.store';

export type RevenueCatWebhookProcessingOutcome =
  | {
      kind: 'processed';
      userId: string;
      grantedCredits: number;
      newBalance: number;
    }
  | { kind: 'duplicate'; eventId: string }
  | { kind: 'ignored'; eventId: string; reason: string };

export type BillingGrantHistoryItem = {
  eventId: string;
  eventType: string;
  productId: string | null;
  grantedCredits: number;
  processedAt: string;
};

export type SupportBillingDiagnostics = {
  userId: string;
  subscriptionState: 'active' | 'inactive' | 'unknown';
  activeProductId: string | null;
  grantHistory: BillingGrantHistoryItem[];
};

type ParsedEvent = {
  eventId: string;
  eventType: string;
  appUserId: string | null;
  productId: BanyoneBillingProductId | null;
  rawProductId: string | null;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly userCreditsStore: UserCreditsStore,
    private readonly dedupeStore: RevenueCatEventDedupeStore,
  ) {}

  async processWebhookPayload(
    payload: unknown,
  ): Promise<RevenueCatWebhookProcessingOutcome> {
    const parsed = parseWebhookEvent(payload);
    if (!parsed) {
      this.logger.warn('Received RevenueCat webhook with unparsable payload.');
      return { kind: 'ignored', eventId: 'unknown', reason: 'INVALID_PAYLOAD' };
    }

    if (!isGrantableEventType(parsed.eventType)) {
      return {
        kind: 'ignored',
        eventId: parsed.eventId,
        reason: `EVENT_TYPE_NOT_GRANTABLE:${parsed.eventType}`,
      };
    }

    if (!parsed.productId || !parsed.appUserId) {
      this.logger.warn(
        `RevenueCat webhook ${parsed.eventId} missing product/user mapping (productId=${parsed.rawProductId ?? 'null'}).`,
      );
      return {
        kind: 'ignored',
        eventId: parsed.eventId,
        reason: 'UNKNOWN_PRODUCT_OR_USER',
      };
    }

    const reserved = await this.dedupeStore.tryReserveEvent(parsed.eventId);
    if (!reserved) {
      return { kind: 'duplicate', eventId: parsed.eventId };
    }

    try {
      const credits = resolveCreditGrantForProduct(parsed.productId);
      const { balanceAfter } = await this.userCreditsStore.credit(
        parsed.appUserId,
        credits,
      );

      await this.dedupeStore.recordProcessed({
        eventId: parsed.eventId,
        eventType: parsed.eventType.toUpperCase(),
        productId: parsed.productId,
        userId: parsed.appUserId,
        grantedCredits: credits,
        processedAtMs: Date.now(),
      });

      return {
        kind: 'processed',
        userId: parsed.appUserId,
        grantedCredits: credits,
        newBalance: balanceAfter,
      };
    } catch (error) {
      await this.dedupeStore.releaseReservation(parsed.eventId);
      this.logger.error(
        `Failed processing RevenueCat event ${parsed.eventId}; reservation released for retry.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getSupportBillingDiagnostics(
    userId: string,
    limit: number,
  ): Promise<SupportBillingDiagnostics> {
    const events = await this.dedupeStore.listProcessedEventsForUser(userId, limit);
    const grantHistory = events.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      productId: event.productId,
      grantedCredits: event.grantedCredits,
      processedAt: new Date(event.processedAtMs).toISOString(),
    }));

    const activeProductId = grantHistory[0]?.productId ?? null;
    const subscriptionState: SupportBillingDiagnostics['subscriptionState'] =
      grantHistory.length > 0
        ? activeProductId
          ? 'active'
          : 'unknown'
        : 'inactive';

    return {
      userId,
      subscriptionState,
      activeProductId,
      grantHistory,
    };
  }
}

function parseWebhookEvent(payload: unknown): ParsedEvent | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const event = (payload as { event?: unknown }).event;
  if (typeof event !== 'object' || event === null) return null;

  const e = event as {
    id?: unknown;
    type?: unknown;
    app_user_id?: unknown;
    original_app_user_id?: unknown;
    product_id?: unknown;
  };

  if (typeof e.id !== 'string' || typeof e.type !== 'string') return null;

  const appUserId =
    typeof e.app_user_id === 'string' && e.app_user_id.trim().length > 0
      ? e.app_user_id.trim()
      : typeof e.original_app_user_id === 'string' &&
          e.original_app_user_id.trim().length > 0
        ? e.original_app_user_id.trim()
        : null;

  const rawProductId =
    typeof e.product_id === 'string' && e.product_id.trim().length > 0
      ? e.product_id.trim()
      : null;

  const productId = normalizeWebhookProductId(rawProductId);

  return {
    eventId: e.id,
    eventType: e.type,
    appUserId,
    productId,
    rawProductId,
  };
}
