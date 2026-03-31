import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

/**
 * MVP: JSON file under `BANYONE_NOTIFICATIONS_DATA_DIR` (or `.banyone-notifications-data`).
 * Migration: replace with Firestore (or other shared store) behind the same upsert/remove/get API
 * without changing `PushTokensController` contracts.
 */

type PersistedPushTokensStore = {
  version: 1;
  /** userId -> distinct FCM registration tokens */
  tokensByUserId: Record<string, string[]>;
};

export class PushTokensStore {
  private readonly storeDir: string;
  private readonly storeFilePath: string;
  private store: PersistedPushTokensStore;

  constructor() {
    const configuredDir = process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    this.storeDir =
      configuredDir ?? path.join(process.cwd(), '.banyone-notifications-data');
    this.storeFilePath = path.join(this.storeDir, 'push-tokens.json');
    mkdirSync(this.storeDir, { recursive: true });
    this.store = this.loadStore();
  }

  private loadStore(): PersistedPushTokensStore {
    if (!existsSync(this.storeFilePath)) {
      return { version: 1, tokensByUserId: {} };
    }
    try {
      const raw = readFileSync(this.storeFilePath, { encoding: 'utf-8' });
      const parsed = JSON.parse(raw) as unknown;
      return this.normalize(parsed);
    } catch {
      return { version: 1, tokensByUserId: {} };
    }
  }

  private normalize(parsed: unknown): PersistedPushTokensStore {
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('tokensByUserId' in parsed)
    ) {
      return { version: 1, tokensByUserId: {} };
    }
    const o = parsed as { tokensByUserId?: unknown };
    if (
      typeof o.tokensByUserId !== 'object' ||
      o.tokensByUserId === null ||
      Array.isArray(o.tokensByUserId)
    ) {
      return { version: 1, tokensByUserId: {} };
    }
    const out: Record<string, string[]> = {};
    for (const [userId, tokensUnknown] of Object.entries(o.tokensByUserId)) {
      if (!Array.isArray(tokensUnknown)) continue;
      const tokens = tokensUnknown.filter(
        (t): t is string => typeof t === 'string' && t.trim().length > 0,
      );
      const uniq = [...new Set(tokens)];
      if (uniq.length > 0) out[userId] = uniq;
    }
    return { version: 1, tokensByUserId: out };
  }

  private saveStore(): void {
    writeFileSync(
      this.storeFilePath,
      `${JSON.stringify(this.store, null, 2)}\n`,
      { encoding: 'utf-8' },
    );
  }

  upsertToken(userId: string, fcmToken: string): void {
    const token = fcmToken.trim();
    if (!token) return;
    const existing = this.store.tokensByUserId[userId] ?? [];
    if (!existing.includes(token)) {
      this.store.tokensByUserId[userId] = [...existing, token];
    }
    this.saveStore();
  }

  /**
   * Removes one token for user, or all tokens when `fcmToken` omitted (sign-out).
   */
  removeToken(userId: string, fcmToken?: string): void {
    const list = this.store.tokensByUserId[userId];
    if (!list?.length) return;
    if (!fcmToken || !fcmToken.trim()) {
      delete this.store.tokensByUserId[userId];
      this.saveStore();
      return;
    }
    const token = fcmToken.trim();
    const next = list.filter((t) => t !== token);
    if (next.length === 0) {
      delete this.store.tokensByUserId[userId];
    } else {
      this.store.tokensByUserId[userId] = next;
    }
    this.saveStore();
  }

  getTokensForUser(userId: string): string[] {
    return [...(this.store.tokensByUserId[userId] ?? [])];
  }
}
