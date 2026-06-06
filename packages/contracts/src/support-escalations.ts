import type { SupportJobDiagnosticsPayload } from './support-diagnostics.js';

export const SUPPORT_ESCALATION_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'cancelled',
] as const;

export type SupportEscalationStatus =
  (typeof SUPPORT_ESCALATION_STATUSES)[number];

export const SUPPORT_ESCALATION_FORBIDDEN_ERROR_CODE =
  'SUPPORT_ESCALATION_FORBIDDEN' as const;
export const SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE =
  'SUPPORT_ESCALATION_INVALID_BODY' as const;
export const SUPPORT_ESCALATION_NOT_FOUND_ERROR_CODE =
  'SUPPORT_ESCALATION_NOT_FOUND' as const;
export const SUPPORT_ESCALATION_JOB_NOT_FOUND_ERROR_CODE =
  'SUPPORT_ESCALATION_JOB_NOT_FOUND' as const;

export type SupportEscalationErrorCode =
  | typeof SUPPORT_ESCALATION_FORBIDDEN_ERROR_CODE
  | typeof SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE
  | typeof SUPPORT_ESCALATION_NOT_FOUND_ERROR_CODE
  | typeof SUPPORT_ESCALATION_JOB_NOT_FOUND_ERROR_CODE;

export const MIN_SUPPORT_ESCALATION_IMPACT_SUMMARY_LENGTH = 20;

export type SupportEscalationDiagnosticsSnapshot = SupportJobDiagnosticsPayload & {
  recoveryPlaybookId?: string;
};

export type SupportEscalationRecord = {
  escalationId: string;
  jobId: string;
  createdAt: string;
  traceId: string;
  actorUserId: string;
  userImpactSummary: string;
  notes?: string;
  diagnosticsSnapshot: SupportEscalationDiagnosticsSnapshot;
  status: SupportEscalationStatus;
  statusUpdatedAt: string;
  resolutionNotes?: string;
};

export type CreateSupportEscalationRequest = {
  jobId: string;
  userImpactSummary: string;
  notes?: string;
  recoveryPlaybookId?: string;
};

export type UpdateSupportEscalationStatusRequest = {
  status: SupportEscalationStatus;
  resolutionNotes?: string;
};

export type SupportEscalationListQuery = {
  jobId?: string;
  status?: SupportEscalationStatus;
  limit?: number;
};

export type SupportEscalationListPayload = {
  items: SupportEscalationRecord[];
  total: number;
};

type SupportEscalationApiErrorEnvelope = {
  data: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type SupportEscalationEnvelope =
  | { data: SupportEscalationRecord; error: null }
  | SupportEscalationApiErrorEnvelope;

export type SupportEscalationListEnvelope =
  | { data: SupportEscalationListPayload; error: null }
  | SupportEscalationApiErrorEnvelope;

const KNOWN_SUPPORT_ESCALATION_STATUSES: ReadonlySet<string> = new Set(
  SUPPORT_ESCALATION_STATUSES,
);

export function isSupportEscalationStatus(
  value: unknown,
): value is SupportEscalationStatus {
  return (
    typeof value === 'string' && KNOWN_SUPPORT_ESCALATION_STATUSES.has(value)
  );
}
