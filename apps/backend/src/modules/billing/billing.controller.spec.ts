import { HttpException, HttpStatus } from '@nestjs/common';

import { BillingController } from './billing.controller';
import type { BillingService } from './billing.service';
import type { RevenueCatWebhookValidator } from './revenuecat-webhook.validator';

type BillingServiceStub = Pick<BillingService, 'processWebhookPayload'>;
type ValidatorStub = Pick<RevenueCatWebhookValidator, 'isAuthorized'>;

function buildController(overrides?: {
  billingService?: BillingServiceStub;
  validator?: ValidatorStub;
}) {
  const billingService: BillingServiceStub = overrides?.billingService ?? {
    processWebhookPayload: jest.fn().mockResolvedValue({
      kind: 'processed',
      userId: 'user-1',
      grantedCredits: 7000,
      newBalance: 7000,
    }),
  };
  const validator: ValidatorStub = overrides?.validator ?? {
    isAuthorized: jest.fn().mockReturnValue(true),
  };

  const controller = new BillingController(
    billingService as BillingService,
    validator as RevenueCatWebhookValidator,
  );

  return { controller, billingService, validator };
}

describe('BillingController', () => {
  it('returns UNAUTHORIZED envelope when webhook auth is invalid', async () => {
    const { controller, validator } = buildController({
      validator: {
        isAuthorized: jest.fn().mockReturnValue(false),
      },
    });

    await expect(
      controller.handleWebhook(undefined, { event: { id: 'evt-1' } }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(validator.isAuthorized).toHaveBeenCalledWith(undefined);

    try {
      await controller.handleWebhook(undefined, { event: { id: 'evt-1' } });
    } catch (error) {
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(exception.getResponse()).toEqual({
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid RevenueCat webhook authorization.',
          retryable: false,
        },
      });
    }
  });

  it('returns processed response shape for successful webhook processing', async () => {
    const processWebhookPayload = jest.fn().mockResolvedValue({
      kind: 'processed',
      userId: 'user-1',
      grantedCredits: 7000,
      newBalance: 7700,
    });
    const { controller } = buildController({
      billingService: { processWebhookPayload },
    });

    const response = await controller.handleWebhook('Bearer test-secret', {
      event: { id: 'evt-processed' },
    });

    expect(processWebhookPayload).toHaveBeenCalledWith({
      event: { id: 'evt-processed' },
    });
    expect(response).toEqual({
      data: { processed: true },
      error: null,
    });
  });

  it('returns duplicate response shape when event is already reserved/processed', async () => {
    const { controller } = buildController({
      billingService: {
        processWebhookPayload: jest.fn().mockResolvedValue({
          kind: 'duplicate',
          eventId: 'evt-dup-1',
        }),
      },
    });

    const response = await controller.handleWebhook('secret', {
      event: { id: 'evt-dup-1' },
    });

    expect(response).toEqual({
      data: {
        processed: false,
        duplicate: true,
        eventId: 'evt-dup-1',
      },
      error: null,
    });
  });

  it('returns ignored response shape for non-grantable events', async () => {
    const { controller } = buildController({
      billingService: {
        processWebhookPayload: jest.fn().mockResolvedValue({
          kind: 'ignored',
          eventId: 'evt-ignored-1',
          reason: 'EVENT_TYPE_NOT_GRANTABLE:CANCELLATION',
        }),
      },
    });

    const response = await controller.handleWebhook('secret', {
      event: { id: 'evt-ignored-1' },
    });

    expect(response).toEqual({
      data: {
        processed: false,
        ignored: true,
        eventId: 'evt-ignored-1',
        reason: 'EVENT_TYPE_NOT_GRANTABLE:CANCELLATION',
      },
      error: null,
    });
  });

  it('propagates service errors so HTTP layer returns 500', async () => {
    const { controller } = buildController({
      billingService: {
        processWebhookPayload: jest
          .fn()
          .mockRejectedValue(new Error('write-failed')),
      },
    });

    await expect(
      controller.handleWebhook('secret', { event: { id: 'evt-fail' } }),
    ).rejects.toThrow('write-failed');
  });
});
