/**
 * Policy screening errors for job acceptance (Epic 3).
 *
 * Top-level API `error.code` for deterministic policy blocks.
 * Rule-specific outcome lives in `error.details.policyCode`.
 */

export const POLICY_VIOLATION_ERROR_CODE = 'POLICY_VIOLATION' as const;

export type PolicyViolationErrorCode = typeof POLICY_VIOLATION_ERROR_CODE;

/** Documented policy rule outcomes (extend as new rules ship). */
export const JOB_POLICY_CODE_STORAGE_URI_BLOCKED = 'STORAGE_URI_BLOCKED' as const;

export type JobPolicyCode = typeof JOB_POLICY_CODE_STORAGE_URI_BLOCKED;

export type JobPolicyViolationErrorDetails = {
  policyCode: JobPolicyCode;
  /** Stable id when multiple rules share a policyCode; optional for MVP. */
  ruleId?: string;
};

const KNOWN_POLICY_CODES: ReadonlySet<string> = new Set<JobPolicyCode>([
  JOB_POLICY_CODE_STORAGE_URI_BLOCKED,
]);

export function isJobPolicyViolationDetails(
  value: unknown,
): value is JobPolicyViolationErrorDetails {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.policyCode === 'string' &&
    KNOWN_POLICY_CODES.has(o.policyCode) &&
    (o.ruleId === undefined || typeof o.ruleId === 'string')
  );
}
