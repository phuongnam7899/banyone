import type { NotificationPreferences } from '@banyone/contracts';

import { banyoneAuthenticatedFetch } from '@/infra/api-client/authenticated-fetch';
import { parseBanyoneApiEnvelopeResponse } from '@/infra/api-client/parse-json-envelope';

import { resolveBanyoneBackendBaseUrl } from './push-tokens-api';

export async function fetchNotificationPreferences(
  getIdToken: () => Promise<string | null>,
): Promise<NotificationPreferences> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/notification-preferences`,
    { method: 'GET' },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error('Notification preferences load failed');
  }
  const prefs = (parsed.envelope.data as { preferences?: unknown }).preferences;
  if (!isNotificationPreferences(prefs)) {
    throw new Error('Notification preferences load failed');
  }
  return prefs;
}

export async function updateNotificationPreferences(
  input: NotificationPreferences,
  getIdToken: () => Promise<string | null>,
): Promise<NotificationPreferences> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/notification-preferences`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error('Notification preferences update failed');
  }
  const prefs = (parsed.envelope.data as { preferences?: unknown }).preferences;
  if (!isNotificationPreferences(prefs)) {
    throw new Error('Notification preferences update failed');
  }
  return prefs;
}

function isNotificationPreferences(value: unknown): value is NotificationPreferences {
  if (typeof value !== 'object' || value === null || !('lifecycle' in value)) return false;
  const lifecycle = (value as { lifecycle?: unknown }).lifecycle;
  if (typeof lifecycle !== 'object' || lifecycle === null) return false;
  return (
    typeof (lifecycle as { jobQueued?: unknown }).jobQueued === 'boolean' &&
    typeof (lifecycle as { jobReady?: unknown }).jobReady === 'boolean' &&
    typeof (lifecycle as { jobFailed?: unknown }).jobFailed === 'boolean'
  );
}
