/**
 * Shared lifecycle push notification contracts (backend FCM `data` + mobile deep-link).
 * All FCM data values must be strings on the wire.
 */

export const JOB_LIFECYCLE_NOTIFICATION_KINDS = [
  'job_queued',
  'job_ready',
  'job_failed',
] as const;

export type JobLifecycleNotificationKind =
  (typeof JOB_LIFECYCLE_NOTIFICATION_KINDS)[number];

/** Hint for in-app navigation (Story 2.4 deep link target). */
export type JobLifecycleNotificationScreenHint = 'history_detail';

export type JobLifecyclePushDataFields = {
  jobId: string;
  kind: JobLifecycleNotificationKind;
  /** Screen hint for clients that route on structured fields. */
  screen?: JobLifecycleNotificationScreenHint;
  /**
   * Full app URL using the product scheme (e.g. `mobile:///history-detail/{jobId}`).
   * Clients may parse this with expo-linking or route using `jobId` + `screen`.
   */
  deepLink: string;
};

export const JOB_LIFECYCLE_DEEP_LINK_SCREEN: JobLifecycleNotificationScreenHint =
  'history_detail';

/** URL scheme for deep links (must match `expo.scheme` in mobile app config). */
export const BANYONE_MOBILE_URL_SCHEME = 'mobile';

export function buildJobHistoryDetailDeepLink(jobId: string): string {
  const trimmed = jobId.trim();
  return `${BANYONE_MOBILE_URL_SCHEME}:///history-detail/${encodeURIComponent(trimmed)}`;
}

export function buildJobLifecyclePushDataFields(params: {
  jobId: string;
  kind: JobLifecycleNotificationKind;
}): JobLifecyclePushDataFields {
  return {
    jobId: params.jobId,
    kind: params.kind,
    screen: JOB_LIFECYCLE_DEEP_LINK_SCREEN,
    deepLink: buildJobHistoryDetailDeepLink(params.jobId),
  };
}

/** FCM `data` payload: string record for Cloud Messaging APIs. */
export function jobLifecyclePushDataToFcmData(
  fields: JobLifecyclePushDataFields,
): Record<string, string> {
  const out: Record<string, string> = {
    jobId: fields.jobId,
    kind: fields.kind,
    deepLink: fields.deepLink,
  };
  if (fields.screen !== undefined) {
    out.screen = fields.screen;
  }
  return out;
}

export function isJobLifecycleNotificationKind(
  value: unknown,
): value is JobLifecycleNotificationKind {
  return (
    typeof value === 'string' &&
    (JOB_LIFECYCLE_NOTIFICATION_KINDS as readonly string[]).includes(value)
  );
}

export type NotificationLifecyclePreferences = {
  jobQueued: boolean;
  jobReady: boolean;
  jobFailed: boolean;
};

export type NotificationPreferences = {
  lifecycle: NotificationLifecyclePreferences;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  lifecycle: {
    jobQueued: true,
    jobReady: true,
    jobFailed: true,
  },
};
