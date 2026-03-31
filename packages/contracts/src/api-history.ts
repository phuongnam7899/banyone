export type GenerationJobStatus = 'queued' | 'processing' | 'ready' | 'failed';

export type GenerationJobFailureMetadata = {
  retryable: boolean;
  reasonCode: string;
  nextAction: string;
  message: string;
};

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
  | { data: GenerationJobHistoryListPayload; error: null; meta?: Record<string, unknown> }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        details?: unknown;
        traceId: string;
      };
      meta?: Record<string, unknown>;
    };

export type GenerationJobHistoryDetailEnvelope =
  | { data: GenerationJobHistoryDetailPayload; error: null; meta?: Record<string, unknown> }
  | {
      data: null;
      error: {
        code: string;
        message: string;
        retryable: boolean;
        details?: unknown;
        traceId: string;
      };
      meta?: Record<string, unknown>;
    };
