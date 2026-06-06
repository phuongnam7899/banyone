import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UserCreditsStore } from '../jobs/user-credits.store';
import { BillingDevController } from './billing-dev.controller';

describe('BillingDevController', () => {
  it('grants weekly credits for the authenticated user', async () => {
    const credit = jest
      .fn()
      .mockResolvedValue({ balanceBefore: 0, balanceAfter: 7000 });
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingDevController],
      providers: [
        {
          provide: UserCreditsStore,
          useValue: { credit },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = moduleRef.get(BillingDevController);
    const user: BanyoneAuthUser = {
      uid: 'firebase-uid-1',
      isModerator: false,
      isSupport: false,
    };

    const res = await controller.grantSubscriptionCredits(user, {
      productId: 'weekly',
    });

    expect(res).toEqual({
      data: { grantedCredits: 7000, newBalance: 7000 },
      error: null,
    });
    expect(credit).toHaveBeenCalledWith('firebase-uid-1', 7000);
  });

  it('rejects invalid product id', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BillingDevController],
      providers: [
        {
          provide: UserCreditsStore,
          useValue: { credit: jest.fn() },
        },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = moduleRef.get(BillingDevController);
    const user: BanyoneAuthUser = {
      uid: 'u1',
      isModerator: false,
      isSupport: false,
    };

    await expect(
      controller.grantSubscriptionCredits(user, { productId: 'platinum' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
