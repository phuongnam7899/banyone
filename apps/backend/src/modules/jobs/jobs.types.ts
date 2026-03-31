export type GenerationJobStatus = 'queued' | 'processing' | 'ready' | 'failed';

export type GenerationJobFailureMetadata = {
  retryable: boolean;
  reasonCode: string;
  nextAction: string;
  message: string;
};

export type GenerationJobSuccessEnvelope = {
  data: {
    jobId: string;
    status: GenerationJobStatus;
  };
  error: null;
};

export type GenerationJobErrorEnvelope = {
  data: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};

export type GenerationJobEnvelope =
  | GenerationJobSuccessEnvelope
  | GenerationJobErrorEnvelope;

export type GenerationJobStatusPayload = {
  jobId: string;
  status: GenerationJobStatus;
  /**
   * ISO 8601 UTC timestamp indicating last server update time for this job's lifecycle state.
   */
  updatedAt: string;
  /**
   * Optional bounded ETA for user-facing timeline copy.
   * Only provided for non-final states.
   */
  etaSeconds?: number;
  failure?: GenerationJobFailureMetadata;
};

export type GenerationJobStatusSuccessEnvelope = {
  data: GenerationJobStatusPayload;
  error: null;
};

export type GenerationJobStatusEnvelope =
  | GenerationJobStatusSuccessEnvelope
  | GenerationJobErrorEnvelope;

export type GenerationJobHistoryListItem = {
  jobId: string;
  status: GenerationJobStatus;
  updatedAt: string;
};

export type GenerationJobHistoryListPayload = {
  items: GenerationJobHistoryListItem[];
};

export type GenerationJobHistoryDetailPayload = {
  jobId: string;
  status: GenerationJobStatus;
  updatedAt: string;
  queuedAt?: string;
  processingAt?: string;
  readyAt?: string;
  failedAt?: string;
  failure?: GenerationJobFailureMetadata;
};

export type GenerationJobHistoryListEnvelope =
  | {
      data: GenerationJobHistoryListPayload;
      error: null;
      meta?: Record<string, unknown>;
    }
  | GenerationJobErrorEnvelope;

export type GenerationJobHistoryDetailEnvelope =
  | {
      data: GenerationJobHistoryDetailPayload;
      error: null;
      meta?: Record<string, unknown>;
    }
  | GenerationJobErrorEnvelope;

export type GenerationJobPreviewPayload = {
  jobId: string;
  status: 'ready';
  updatedAt: string;
  previewUri: string;
  mimeType: 'video/mp4';
};

export type GenerationJobPreviewEnvelope =
  | { data: GenerationJobPreviewPayload; error: null }
  | GenerationJobErrorEnvelope;

export type GenerationJobExportPayload = {
  jobId: string;
  status: 'ready';
  updatedAt: string;
  exportUri: string;
  mimeType: 'video/mp4';
};

export type GenerationJobExportEnvelope =
  | { data: GenerationJobExportPayload; error: null }
  | GenerationJobErrorEnvelope;

export type GenerationJobInputViolationDetail = {
  code: string;
  message: string;
  fixAction: string;
  slot: 'video' | 'image';
};

export type GenerationJobValidationErrorDetails = {
  violationSummary: {
    videoStatus: 'pending' | 'valid' | 'invalid-with-fix';
    imageStatus: 'pending' | 'valid' | 'invalid-with-fix';
  };
  violations: GenerationJobInputViolationDetail[];
};
