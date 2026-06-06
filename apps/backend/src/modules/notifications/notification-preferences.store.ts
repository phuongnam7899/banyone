import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@banyone/contracts';

import { FIRESTORE } from '../../infra/firestore.module';

@Injectable()
export class NotificationPreferencesStore {
  private readonly cache = new Map<string, NotificationPreferences>();
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  getForUser(userId: string): NotificationPreferences {
    const prefs = this.cache.get(userId);
    if (!prefs) return DEFAULT_NOTIFICATION_PREFERENCES;
    return prefs;
  }

  updateForUser(
    userId: string,
    next: NotificationPreferences,
  ): NotificationPreferences {
    const normalized = normalizePreferences(next);
    this.cache.set(userId, normalized);
    void this.firestore
      .collection('notification_preferences')
      .doc(userId)
      .set(normalized);
    return normalized;
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
