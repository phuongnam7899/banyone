import type { GenerationJobStatus } from './api-history.js';

export const SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES = [
  'validation',
  'policy',
  'processing-retryable',
  'processing-non-retryable',
  'abuse-restriction',
  'unknown',
] as const;

export type SupportDiagnosticsFailureCategory =
  (typeof SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES)[number];

export const SUPPORT_DIAGNOSTICS_FORBIDDEN_ERROR_CODE =
  'SUPPORT_DIAGNOSTICS_FORBIDDEN' as const;
export const SUPPORT_DIAGNOSTICS_INVALID_QUERY_ERROR_CODE =
  'SUPPORT_DIAGNOSTICS_INVALID_QUERY' as const;
export const SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND_ERROR_CODE =
  'SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND' as const;

export type SupportDiagnosticsErrorCode =
  | typeof SUPPORT_DIAGNOSTICS_FORBIDDEN_ERROR_CODE
  | typeof SUPPORT_DIAGNOSTICS_INVALID_QUERY_ERROR_CODE
  | typeof SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND_ERROR_CODE;

export type SupportJobDiagnosticsQuery = {
  jobId: string;
};

export type SupportJobDiagnosticsPayload = {
  jobId: string;
  status: GenerationJobStatus;
  ownerUserId: string;
  updatedAt: string;
  traceId: string;
  failureCategory: SupportDiagnosticsFailureCategory;
  queuedAt?: string;
  processingAt?: string;
  readyAt?: string;
  failedAt?: string;
  failure?: {
    retryable: boolean;
    reasonCode: string;
    nextAction: string;
  };
};

type SupportDiagnosticsApiErrorEnvelope = {
  data: null;
  error: {
    code: SupportDiagnosticsErrorCode | string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type SupportJobDiagnosticsEnvelope =
  | { data: SupportJobDiagnosticsPayload; error: null }
  | SupportDiagnosticsApiErrorEnvelope;

export const SUPPORT_BILLING_DIAGNOSTICS_SUBSCRIPTION_STATES = [
  'active',
  'inactive',
  'unknown',
] as const;

export type SupportBillingDiagnosticsSubscriptionState =
  (typeof SUPPORT_BILLING_DIAGNOSTICS_SUBSCRIPTION_STATES)[number];

export type SupportBillingGrantHistoryItem = {
  eventId: string;
  eventType: string;
  productId: string | null;
  grantedCredits: number;
  processedAt: string;
};

export type SupportBillingDiagnosticsPayload = {
  userId: string;
  subscriptionState: SupportBillingDiagnosticsSubscriptionState;
  activeProductId: string | null;
  grantHistory: SupportBillingGrantHistoryItem[];
};

export type SupportBillingDiagnosticsEnvelope =
  | { data: SupportBillingDiagnosticsPayload; error: null }
  | SupportDiagnosticsApiErrorEnvelope;

const KNOWN_SUPPORT_FAILURE_CATEGORIES: ReadonlySet<string> = new Set(
  SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES,
);

export function isSupportDiagnosticsFailureCategory(
  value: unknown,
): value is SupportDiagnosticsFailureCategory {
  return (
    typeof value === 'string' && KNOWN_SUPPORT_FAILURE_CATEGORIES.has(value)
  );
}
