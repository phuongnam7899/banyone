import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import type { BanyoneAuthUser } from './banyone-user.types';
import { BANYONE_USER_KEY } from './banyone-user.types';

@Injectable()
export class BanyoneUserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    const user = req[BANYONE_USER_KEY] as BanyoneAuthUser | undefined;
    if (user?.uid) return user.uid;
    return super.getTracker(req);
  }
}
