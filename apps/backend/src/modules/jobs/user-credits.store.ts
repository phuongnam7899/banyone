import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';

import { resolveBanyoneCreditConfig } from '../../banyone-credits.config';
import { FIRESTORE } from '../../infra/firestore.module';

type PersistedUserCredits = {
  balance: number;
  updatedAtMs: number;
};

const USER_CREDITS_COLLECTION = 'user_credits';

@Injectable()
export class UserCreditsStore {
  private readonly config = resolveBanyoneCreditConfig();

  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async getBalance(userId: string): Promise<number> {
    const parsed = await this.getDoc(userId);
    return parsed?.balance ?? this.config.defaultUserCredits;
  }

  async hasEnough(
    userId: string,
    required: number,
  ): Promise<{ balance: number; ok: boolean }> {
    const normalizedRequired = Math.max(0, Math.ceil(required));
    const balance = await this.getBalance(userId);
    return { balance, ok: balance >= normalizedRequired };
  }

  async debit(
    userId: string,
    amount: number,
  ): Promise<{ balanceBefore: number; balanceAfter: number }> {
    const normalizedAmount = Math.max(0, Math.ceil(amount));
    if (normalizedAmount === 0) {
      const balance = await this.getBalance(userId);
      return { balanceBefore: balance, balanceAfter: balance };
    }

    return this.firestore.runTransaction(async (tx) => {
      const docRef = this.firestore
        .collection(USER_CREDITS_COLLECTION)
        .doc(userId);
      const snapshot = await tx.get(docRef);
      const existing = parsePersistedUserCredits(snapshot.data());
      const balanceBefore = existing?.balance ?? this.config.defaultUserCredits;
      if (balanceBefore < normalizedAmount) {
        throw new Error('INSUFFICIENT_CREDIT_BALANCE');
      }

      const balanceAfter = balanceBefore - normalizedAmount;
      tx.set(docRef, { balance: balanceAfter, updatedAtMs: Date.now() });
      return { balanceBefore, balanceAfter };
    });
  }

  async credit(
    userId: string,
    amount: number,
  ): Promise<{ balanceBefore: number; balanceAfter: number }> {
    const normalizedAmount = Math.max(0, Math.ceil(amount));
    if (normalizedAmount === 0) {
      const balance = await this.getBalance(userId);
      return { balanceBefore: balance, balanceAfter: balance };
    }

    return this.firestore.runTransaction(async (tx) => {
      const docRef = this.firestore
        .collection(USER_CREDITS_COLLECTION)
        .doc(userId);
      const snapshot = await tx.get(docRef);
      const existing = parsePersistedUserCredits(snapshot.data());
      const balanceBefore = existing?.balance ?? this.config.defaultUserCredits;
      const balanceAfter = balanceBefore + normalizedAmount;
      tx.set(docRef, { balance: balanceAfter, updatedAtMs: Date.now() });
      return { balanceBefore, balanceAfter };
    });
  }

  getVideoCreditPerSecond(): number {
    return this.config.videoCreditPerSecond;
  }

  private async getDoc(userId: string): Promise<PersistedUserCredits | null> {
    const snapshot = await this.firestore
      .collection(USER_CREDITS_COLLECTION)
      .doc(userId)
      .get();
    return parsePersistedUserCredits(snapshot.data());
  }
}

function parsePersistedUserCredits(
  value: unknown,
): PersistedUserCredits | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as {
    balance?: unknown;
    updatedAtMs?: unknown;
  };
  if (
    typeof candidate.balance !== 'number' ||
    !Number.isFinite(candidate.balance) ||
    candidate.balance < 0
  ) {
    return null;
  }
  const updatedAtMs =
    typeof candidate.updatedAtMs === 'number' &&
    Number.isFinite(candidate.updatedAtMs) &&
    candidate.updatedAtMs > 0
      ? Math.floor(candidate.updatedAtMs)
      : Date.now();
  return {
    balance: Math.floor(candidate.balance),
    updatedAtMs,
  };
}
