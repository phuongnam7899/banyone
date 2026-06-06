export const OUTPUT_REPORT_REASON_CATEGORIES = [
  'HARASSMENT',
  'HATE',
  'SEXUAL_CONTENT',
  'VIOLENCE',
  'ILLEGAL',
  'COPYRIGHT',
  'SPAM',
  'OTHER',
] as const;

export type OutputReportReasonCategory =
  (typeof OUTPUT_REPORT_REASON_CATEGORIES)[number];

export const OUTPUT_REPORT_INVALID_ERROR_CODE = 'OUTPUT_REPORT_INVALID' as const;
export const OUTPUT_REPORT_JOB_NOT_FOUND_ERROR_CODE = 'JOB_NOT_FOUND' as const;
export const OUTPUT_REPORT_JOB_NOT_READY_ERROR_CODE = 'JOB_NOT_READY' as const;

export type OutputReportErrorCode =
  | typeof OUTPUT_REPORT_INVALID_ERROR_CODE
  | typeof OUTPUT_REPORT_JOB_NOT_FOUND_ERROR_CODE
  | typeof OUTPUT_REPORT_JOB_NOT_READY_ERROR_CODE;

export type CreateOutputReportRequest = {
  reasonCategory: OutputReportReasonCategory;
  details?: string;
};

export type CreateOutputReportResponse = {
  reportId: string;
  jobId: string;
  reporterUserId: string;
  reasonCategory: OutputReportReasonCategory;
  createdAt: string;
  traceId: string;
};

export type OutputReportEnvelope =
  | { data: CreateOutputReportResponse; error: null }
  | {
      data: null;
      error: {
        code: OutputReportErrorCode | string;
        message: string;
        retryable: boolean;
        details?: unknown;
        traceId: string;
      };
    };

const KNOWN_OUTPUT_REPORT_REASON_CATEGORIES: ReadonlySet<string> = new Set(
  OUTPUT_REPORT_REASON_CATEGORIES,
);

export function isOutputReportReasonCategory(
  value: unknown,
): value is OutputReportReasonCategory {
  return (
    typeof value === 'string' &&
    KNOWN_OUTPUT_REPORT_REASON_CATEGORIES.has(value)
  );
}
