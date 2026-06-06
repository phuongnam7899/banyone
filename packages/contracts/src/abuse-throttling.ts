export const ABUSE_RESTRICTION_ACTIVE_ERROR_CODE = 'ABUSE_RESTRICTION_ACTIVE' as const;
export const ABUSE_RESTRICTION_INVALID_ERROR_CODE =
  'ABUSE_RESTRICTION_INVALID' as const;

export const ABUSE_SUBJECT_TYPES = ['account', 'device'] as const;
export type AbuseSubjectType = (typeof ABUSE_SUBJECT_TYPES)[number];

export const ABUSE_RESTRICTION_SOURCES = ['manual', 'automated'] as const;
export type AbuseRestrictionSource = (typeof ABUSE_RESTRICTION_SOURCES)[number];

export type AbuseRestrictionErrorCode =
  | typeof ABUSE_RESTRICTION_ACTIVE_ERROR_CODE
  | typeof ABUSE_RESTRICTION_INVALID_ERROR_CODE;

export type AbuseRestrictionDetails = {
  restrictionId: string;
  subjectType: AbuseSubjectType;
  subjectId: string;
  reason: string;
  source: AbuseRestrictionSource;
  expiresAt?: string;
};

export type AbuseRestrictionRecord = {
  restrictionId: string;
  subjectType: AbuseSubjectType;
  subjectId: string;
  reason: string;
  source: AbuseRestrictionSource;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  expiresAt?: string;
  clearedAt?: string;
  clearedBy?: string;
};

export type AbuseAuditAction = 'apply' | 'clear' | 'update';

export type AbuseRestrictionAuditRecord = {
  recordId: string;
  restrictionId: string;
  subjectType: AbuseSubjectType;
  subjectId: string;
  action: AbuseAuditAction;
  actorUserId: string;
  createdAt: string;
  traceId: string;
  reason: string;
  source: AbuseRestrictionSource;
  expiresAt?: string;
};

export type ApplyAbuseRestrictionRequest = {
  subjectType: AbuseSubjectType;
  subjectId: string;
  reason: string;
  expiresAt?: string;
};

export type ClearAbuseRestrictionRequest = {
  subjectType: AbuseSubjectType;
  subjectId: string;
  reason?: string;
};

export type GetAbuseRestrictionQuery = {
  subjectType: AbuseSubjectType;
  subjectId: string;
};

export type AbuseRestrictionPayload = {
  restriction: AbuseRestrictionRecord | null;
};

type AbuseApiErrorEnvelope = {
  data: null;
  error: {
    code: AbuseRestrictionErrorCode | string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type AbuseRestrictionEnvelope =
  | { data: AbuseRestrictionPayload; error: null }
  | AbuseApiErrorEnvelope;

export type AbuseRestrictionMutationEnvelope =
  | { data: { restriction: AbuseRestrictionRecord }; error: null }
  | AbuseApiErrorEnvelope;

const KNOWN_ABUSE_SUBJECT_TYPES: ReadonlySet<string> = new Set(ABUSE_SUBJECT_TYPES);

export function isAbuseSubjectType(value: unknown): value is AbuseSubjectType {
  return typeof value === 'string' && KNOWN_ABUSE_SUBJECT_TYPES.has(value);
}
