import { BillingService } from './billing.service';
import { RevenueCatEventDedupeStore } from './revenuecat-event-dedupe.store';
import { UserCreditsStore } from '../jobs/user-credits.store';

type CreditsStoreStub = Pick<UserCreditsStore, 'credit'>;
type DedupeStoreStub = Pick<
  RevenueCatEventDedupeStore,
  | 'tryReserveEvent'
  | 'recordProcessed'
  | 'releaseReservation'
  | 'listProcessedEventsForUser'
>;

function buildBillingService(overrides: {
  credits?: CreditsStoreStub;
  dedupe?: DedupeStoreStub;
}) {
  const credits: CreditsStoreStub = overrides.credits ?? {
    credit: jest.fn().mockResolvedValue({ balanceBefore: 0, balanceAfter: 0 }),
  };
  const dedupe: DedupeStoreStub = overrides.dedupe ?? {
    tryReserveEvent: jest.fn().mockResolvedValue(true),
    recordProcessed: jest.fn().mockResolvedValue(undefined),
    releaseReservation: jest.fn().mockResolvedValue(undefined),
    listProcessedEventsForUser: jest.fn().mockResolvedValue([]),
  };
  const service = new BillingService(
    credits as UserCreditsStore,
    dedupe as RevenueCatEventDedupeStore,
  );
  return { service, credits, dedupe };
}

function buildEventPayload(
  overrides: Partial<{
    id: string;
    type: string;
    app_user_id: string;
    product_id: string;
  }> = {},
) {
  return {
    event: {
      id: overrides.id ?? 'evt-1',
      type: overrides.type ?? 'INITIAL_PURCHASE',
      app_user_id: overrides.app_user_id ?? 'user-1',
      product_id: overrides.product_id ?? 'monthly',
    },
  };
}

describe('BillingService', () => {
  it('grants 7000 credits when webhook product_id is a store-style SKU', async () => {
    const credit = jest
      .fn()
      .mockResolvedValue({ balanceBefore: 0, balanceAfter: 7000 });
    const { service } = buildBillingService({
      credits: { credit },
    });

    const outcome = await service.processWebhookPayload(
      buildEventPayload({ product_id: 'com.banyone.weekly' }),
    );

    expect(outcome).toEqual({
      kind: 'processed',
      userId: 'user-1',
      grantedCredits: 7000,
      newBalance: 7000,
    });
    expect(credit).toHaveBeenCalledWith('user-1', 7000);
  });

  it('grants 7000 credits on weekly initial purchase', async () => {
    const credit = jest
      .fn()
      .mockResolvedValue({ balanceBefore: 0, balanceAfter: 7000 });
    const { service } = buildBillingService({
      credits: { credit },
    });

    const outcome = await service.processWebhookPayload(
      buildEventPayload({ product_id: 'weekly' }),
    );

    expect(outcome).toEqual({
      kind: 'processed',
      userId: 'user-1',
      grantedCredits: 7000,
      newBalance: 7000,
    });
    expect(credit).toHaveBeenCalledWith('user-1', 7000);
  });

  it('grants 30000 credits on monthly renewal', async () => {
    const credit = jest
      .fn()
      .mockResolvedValue({ balanceBefore: 0, balanceAfter: 30000 });
    const { service } = buildBillingService({ credits: { credit } });

    await service.processWebhookPayload(
      buildEventPayload({ type: 'RENEWAL', product_id: 'monthly' }),
    );

    expect(credit).toHaveBeenCalledWith('user-1', 30000);
  });

  it('grants 365000 credits on yearly renewal', async () => {
    const credit = jest
      .fn()
      .mockResolvedValue({ balanceBefore: 0, balanceAfter: 365000 });
    const { service } = buildBillingService({ credits: { credit } });

    await service.processWebhookPayload(
      buildEventPayload({ type: 'RENEWAL', product_id: 'yearly' }),
    );

    expect(credit).toHaveBeenCalledWith('user-1', 365000);
  });

  it('returns duplicate without granting when event already processed', async () => {
    const credit = jest.fn();
    const tryReserveEvent = jest.fn().mockResolvedValue(false);
    const { service } = buildBillingService({
      credits: { credit },
      dedupe: {
        tryReserveEvent,
        recordProcessed: jest.fn(),
        releaseReservation: jest.fn(),
        listProcessedEventsForUser: jest.fn(),
      },
    });

    const outcome = await service.processWebhookPayload(buildEventPayload());

    expect(outcome).toEqual({ kind: 'duplicate', eventId: 'evt-1' });
    expect(credit).not.toHaveBeenCalled();
  });

  it('ignores cancellation events without crediting', async () => {
    const credit = jest.fn();
    const { service } = buildBillingService({ credits: { credit } });

    const outcome = await service.processWebhookPayload(
      buildEventPayload({ type: 'CANCELLATION' }),
    );

    expect(outcome.kind).toBe('ignored');
    expect(credit).not.toHaveBeenCalled();
  });

  it('ignores events with unknown product id', async () => {
    const credit = jest.fn();
    const { service } = buildBillingService({ credits: { credit } });

    const outcome = await service.processWebhookPayload(
      buildEventPayload({ product_id: 'platinum' }),
    );

    expect(outcome.kind).toBe('ignored');
    expect(credit).not.toHaveBeenCalled();
  });

  it('ignores events with missing app user id', async () => {
    const credit = jest.fn();
    const { service } = buildBillingService({ credits: { credit } });

    const outcome = await service.processWebhookPayload({
      event: {
        id: 'evt-2',
        type: 'INITIAL_PURCHASE',
        product_id: 'monthly',
      },
    });

    expect(outcome.kind).toBe('ignored');
    expect(credit).not.toHaveBeenCalled();
  });

  it('ignores malformed payloads', async () => {
    const credit = jest.fn();
    const { service } = buildBillingService({ credits: { credit } });

    const outcome = await service.processWebhookPayload(null);

    expect(outcome.kind).toBe('ignored');
    expect(credit).not.toHaveBeenCalled();
  });

  it('releases reservation when credit grant fails so webhook can retry', async () => {
    const credit = jest.fn().mockRejectedValue(new Error('credit-write-failed'));
    const releaseReservation = jest.fn().mockResolvedValue(undefined);
    const { service } = buildBillingService({
      credits: { credit },
      dedupe: {
        tryReserveEvent: jest.fn().mockResolvedValue(true),
        recordProcessed: jest.fn().mockResolvedValue(undefined),
        releaseReservation,
        listProcessedEventsForUser: jest.fn(),
      },
    });

    await expect(service.processWebhookPayload(buildEventPayload())).rejects.toThrow(
      'credit-write-failed',
    );
    expect(releaseReservation).toHaveBeenCalledWith('evt-1');
  });

  it('releases reservation when processed marker write fails', async () => {
    const releaseReservation = jest.fn().mockResolvedValue(undefined);
    const { service } = buildBillingService({
      credits: {
        credit: jest.fn().mockResolvedValue({ balanceBefore: 0, balanceAfter: 7000 }),
      },
      dedupe: {
        tryReserveEvent: jest.fn().mockResolvedValue(true),
        recordProcessed: jest.fn().mockRejectedValue(new Error('dedupe-write-failed')),
        releaseReservation,
        listProcessedEventsForUser: jest.fn(),
      },
    });

    await expect(service.processWebhookPayload(buildEventPayload())).rejects.toThrow(
      'dedupe-write-failed',
    );
    expect(releaseReservation).toHaveBeenCalledWith('evt-1');
  });

  it('returns support-safe billing diagnostics history for a user', async () => {
    const listProcessedEventsForUser = jest.fn().mockResolvedValue([
      {
        eventId: 'evt-1',
        eventType: 'RENEWAL',
        productId: 'monthly',
        userId: 'user-9',
        grantedCredits: 30000,
        processedAtMs: 1717153200000,
      },
    ]);
    const { service } = buildBillingService({
      dedupe: {
        tryReserveEvent: jest.fn(),
        recordProcessed: jest.fn(),
        releaseReservation: jest.fn(),
        listProcessedEventsForUser,
      },
    });

    const diagnostics = await service.getSupportBillingDiagnostics('user-9', 25);

    expect(listProcessedEventsForUser).toHaveBeenCalledWith('user-9', 25);
    expect(diagnostics).toEqual({
      userId: 'user-9',
      subscriptionState: 'active',
      activeProductId: 'monthly',
      grantHistory: [
        {
          eventId: 'evt-1',
          eventType: 'RENEWAL',
          productId: 'monthly',
          grantedCredits: 30000,
          processedAt: '2024-05-31T11:00:00.000Z',
        },
      ],
    });
  });
});
