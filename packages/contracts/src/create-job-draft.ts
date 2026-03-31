export const CREATE_JOB_DRAFT_SCHEMA_VERSION = 1 as const;

/** Serializable create-job selection snapshot (mobile draft persistence). */
export type CreateJobDraftSelectionV1 = {
  videoUri: string | null;
  videoLabel: string | null;
  videoDurationSec: number | null;
  videoWidthPx: number | null;
  videoHeightPx: number | null;
  videoMimeType: string | null;

  imageUri: string | null;
  imageLabel: string | null;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  imageMimeType: string | null;
};

export type CreateJobDraftV1 = {
  schemaVersion: typeof CREATE_JOB_DRAFT_SCHEMA_VERSION;
  savedAt: string;
  selection: CreateJobDraftSelectionV1;
  /** Present while a submit attempt may still be deduplicated server-side after transport failure. */
  pendingIdempotencyKey: string | null;
};

export function isCreateJobDraftV1(value: unknown): value is CreateJobDraftV1 {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== CREATE_JOB_DRAFT_SCHEMA_VERSION) return false;
  if (typeof v.savedAt !== 'string') return false;
  if (typeof v.selection !== 'object' || v.selection === null) return false;
  if (v.pendingIdempotencyKey != null && typeof v.pendingIdempotencyKey !== 'string') return false;
  return true;
}
