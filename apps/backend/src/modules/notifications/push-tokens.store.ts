import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../../infra/firestore.module';

/**
 * MVP: JSON file under `BANYONE_NOTIFICATIONS_DATA_DIR` (or `.banyone-notifications-data`).
 * Migration: replace with Firestore (or other shared store) behind the same upsert/remove/get API
 * without changing `PushTokensController` contracts.
 */

@Injectable()
export class PushTokensStore {
  private readonly cache = new Map<string, string[]>();
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  private parseTokens(value: unknown): string[] {
    if (typeof value !== 'object' || value === null) return [];
    const tokens = (value as { tokens?: unknown }).tokens;
    if (!Array.isArray(tokens)) return [];
    return [...new Set(tokens.filter((t): t is string => typeof t === 'string'))];
  }

  upsertToken(userId: string, fcmToken: string): void {
    const token = fcmToken.trim();
    if (!token) return;
    const existing = this.cache.get(userId) ?? [];
    const next = existing.includes(token) ? existing : [...existing, token];
    this.cache.set(userId, next);
    void this.firestore.collection('push_tokens').doc(userId).set({ userId, tokens: next }, { merge: true });
  }

  /**
   * Removes one token for user, or all tokens when `fcmToken` omitted (sign-out).
   */
  removeToken(userId: string, fcmToken?: string): void {
    const list = this.cache.get(userId) ?? [];
    if (!list?.length) return;
    if (!fcmToken || !fcmToken.trim()) {
      this.cache.delete(userId);
      void this.firestore.collection('push_tokens').doc(userId).delete();
      return;
    }
    const token = fcmToken.trim();
    const next = list.filter((t) => t !== token);
    if (next.length === 0) {
      this.cache.delete(userId);
      void this.firestore.collection('push_tokens').doc(userId).delete();
      return;
    }
    this.cache.set(userId, next);
    void this.firestore.collection('push_tokens').doc(userId).set({ userId, tokens: next }, { merge: true });
  }

  getTokensForUser(userId: string): string[] {
    return [...(this.cache.get(userId) ?? [])];
  }
}
