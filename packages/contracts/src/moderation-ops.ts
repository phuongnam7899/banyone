import type { GenerationJobFailureMetadata, GenerationJobStatus } from './api-history.js';
import type { OutputReportReasonCategory } from './output-report.js';

export const MODERATION_ACTION_TYPES = [
  'DISMISS',
  'ESCALATE',
  'RESTRICT_RECOMMENDED',
] as const;

// Story 3.5 explicit behavior: this action is recommendation-only.
// Real enforcement is handled through /v1/moderation/abuse-restrictions endpoints.
export const RESTRICT_RECOMMENDED_BEHAVIOR = 'recommendation_only' as const;

export type ModerationActionType = (typeof MODERATION_ACTION_TYPES)[number];

export const MODERATION_FORBIDDEN_ERROR_CODE = 'MODERATION_FORBIDDEN' as const;
export const MODERATION_REPORT_NOT_FOUND_ERROR_CODE =
  'MODERATION_REPORT_NOT_FOUND' as const;
export const MODERATION_INVALID_ACTION_ERROR_CODE =
  'MODERATION_INVALID_ACTION' as const;

export type ModerationErrorCode =
  | typeof MODERATION_FORBIDDEN_ERROR_CODE
  | typeof MODERATION_REPORT_NOT_FOUND_ERROR_CODE
  | typeof MODERATION_INVALID_ACTION_ERROR_CODE;

export type ModerationQueueListQuery = {
  page?: number;
  pageSize?: number;
  reasonCategory?: OutputReportReasonCategory;
};

export type ModerationJobContext = {
  status: GenerationJobStatus | null;
  userId: string | null;
  updatedAt: string | null;
  queuedAt?: string;
  processingAt?: string;
  readyAt?: string;
  failedAt?: string;
  failure?: GenerationJobFailureMetadata;
};

export type ModerationQueueItem = {
  reportId: string;
  jobId: string;
  reporterUserId: string;
  reasonCategory: OutputReportReasonCategory;
  createdAt: string;
  traceId: string;
  details?: string;
  job: ModerationJobContext;
};

export type ModerationActionRecord = {
  actionId: string;
  reportId: string;
  jobId: string;
  actorUserId: string;
  actionType: ModerationActionType;
  createdAt: string;
  traceId: string;
  notes?: string;
};

export type ModerationQueueListPayload = {
  items: ModerationQueueItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type ModerationQueueDetailPayload = ModerationQueueItem & {
  actions: ModerationActionRecord[];
};

export type CreateModerationActionRequest = {
  actionType: ModerationActionType;
  notes?: string;
};

export type CreateModerationActionPayload = {
  action: ModerationActionRecord;
};

type ApiErrorEnvelope = {
  data: null;
  error: {
    code: ModerationErrorCode | string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type ModerationQueueListEnvelope =
  | { data: ModerationQueueListPayload; error: null }
  | ApiErrorEnvelope;

export type ModerationQueueDetailEnvelope =
  | { data: ModerationQueueDetailPayload; error: null }
  | ApiErrorEnvelope;

export type ModerationActionEnvelope =
  | { data: CreateModerationActionPayload; error: null }
  | ApiErrorEnvelope;

const KNOWN_MODERATION_ACTION_TYPES: ReadonlySet<string> = new Set(
  MODERATION_ACTION_TYPES,
);

export function isModerationActionType(
  value: unknown,
): value is ModerationActionType {
  return (
    typeof value === 'string' && KNOWN_MODERATION_ACTION_TYPES.has(value)
  );
}
