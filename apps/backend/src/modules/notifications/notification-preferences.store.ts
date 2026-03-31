import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@banyone/contracts';

type PersistedNotificationPreferencesStore = {
  version: 1;
  preferencesByUserId: Record<string, NotificationPreferences>;
};

export class NotificationPreferencesStore {
  private readonly storeDir: string;
  private readonly storeFilePath: string;
  private store: PersistedNotificationPreferencesStore;

  constructor() {
    const configuredDir = process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    this.storeDir =
      configuredDir ?? path.join(process.cwd(), '.banyone-notifications-data');
    this.storeFilePath = path.join(this.storeDir, 'notification-preferences.json');
    mkdirSync(this.storeDir, { recursive: true });
    this.store = this.loadStore();
  }

  getForUser(userId: string): NotificationPreferences {
    const prefs = this.store.preferencesByUserId[userId];
    if (!prefs) return DEFAULT_NOTIFICATION_PREFERENCES;
    return prefs;
  }

  updateForUser(
    userId: string,
    next: NotificationPreferences,
  ): NotificationPreferences {
    const normalized = normalizePreferences(next);
    this.store.preferencesByUserId[userId] = normalized;
    this.saveStore();
    return normalized;
  }

  private loadStore(): PersistedNotificationPreferencesStore {
    if (!existsSync(this.storeFilePath)) {
      return { version: 1, preferencesByUserId: {} };
    }
    try {
      const raw = readFileSync(this.storeFilePath, { encoding: 'utf-8' });
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeStore(parsed);
    } catch {
      return { version: 1, preferencesByUserId: {} };
    }
  }

  private normalizeStore(value: unknown): PersistedNotificationPreferencesStore {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('preferencesByUserId' in value)
    ) {
      return { version: 1, preferencesByUserId: {} };
    }

    const source = (value as { preferencesByUserId?: unknown }).preferencesByUserId;
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      return { version: 1, preferencesByUserId: {} };
    }

    const preferencesByUserId: Record<string, NotificationPreferences> = {};
    for (const [userId, rawPrefs] of Object.entries(source)) {
      const normalized = tryParsePreferences(rawPrefs);
      if (normalized) preferencesByUserId[userId] = normalized;
    }

    return { version: 1, preferencesByUserId };
  }

  private saveStore(): void {
    writeFileSync(this.storeFilePath, `${JSON.stringify(this.store, null, 2)}\n`, {
      encoding: 'utf-8',
    });
  }
}

function normalizePreferences(
  input: NotificationPreferences,
): NotificationPreferences {
  return {
    lifecycle: {
      jobQueued: input.lifecycle.jobQueued,
      jobReady: input.lifecycle.jobReady,
      jobFailed: input.lifecycle.jobFailed,
    },
  };
}

function tryParsePreferences(value: unknown): NotificationPreferences | null {
  if (typeof value !== 'object' || value === null || !('lifecycle' in value)) {
    return null;
  }
  const lifecycle = (value as { lifecycle?: unknown }).lifecycle;
  if (typeof lifecycle !== 'object' || lifecycle === null) return null;

  const jobQueued = (lifecycle as { jobQueued?: unknown }).jobQueued;
  const jobReady = (lifecycle as { jobReady?: unknown }).jobReady;
  const jobFailed = (lifecycle as { jobFailed?: unknown }).jobFailed;
  if (
    typeof jobQueued !== 'boolean' ||
    typeof jobReady !== 'boolean' ||
    typeof jobFailed !== 'boolean'
  ) {
    return null;
  }

  return { lifecycle: { jobQueued, jobReady, jobFailed } };
}
