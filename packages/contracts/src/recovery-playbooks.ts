import type { SupportDiagnosticsFailureCategory } from './support-diagnostics.js';

export const SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY_ERROR_CODE =
  'SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY' as const;

export const SUPPORT_RECOVERY_PLAYBOOK_NOT_FOUND_ERROR_CODE =
  'SUPPORT_RECOVERY_PLAYBOOK_NOT_FOUND' as const;

export type RecoveryPlaybookRetryGuidance =
  | 'retry'
  | 'do-not-retry'
  | 'conditional';

export type RecoveryPlaybook = {
  id: string;
  failureCategory: SupportDiagnosticsFailureCategory;
  title: string;
  summary: string;
  explanation: string;
  retryGuidance: RecoveryPlaybookRetryGuidance;
  reasonCode?: string;
  nextSteps: string[];
};

export type SupportRecoveryPlaybooksQuery = {
  failureCategory?: SupportDiagnosticsFailureCategory;
  reasonCode?: string;
};

export type SupportRecoveryPlaybooksPayload = {
  items: RecoveryPlaybook[];
  requestedCategory: SupportDiagnosticsFailureCategory | 'all';
  requestedReasonCode?: string;
  usedFallback: boolean;
};

export type SupportRecoveryPlaybookErrorCode =
  | typeof SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY_ERROR_CODE
  | typeof SUPPORT_RECOVERY_PLAYBOOK_NOT_FOUND_ERROR_CODE;

type SupportRecoveryPlaybooksApiErrorEnvelope = {
  data: null;
  error: {
    code: SupportRecoveryPlaybookErrorCode;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type SupportRecoveryPlaybooksEnvelope =
  | { data: SupportRecoveryPlaybooksPayload; error: null }
  | SupportRecoveryPlaybooksApiErrorEnvelope;

const RECOVERY_PLAYBOOK_RETRY_GUIDANCE: ReadonlySet<string> = new Set([
  'retry',
  'do-not-retry',
  'conditional',
]);

export function isRecoveryPlaybookRetryGuidance(
  value: unknown,
): value is RecoveryPlaybookRetryGuidance {
  return (
    typeof value === 'string' && RECOVERY_PLAYBOOK_RETRY_GUIDANCE.has(value)
  );
}
