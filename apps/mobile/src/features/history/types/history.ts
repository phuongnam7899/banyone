export type HistoryJobStatus = 'queued' | 'processing' | 'ready' | 'failed';

export type HistoryFailureMetadata = {
  retryable: boolean;
  reasonCode: string;
  nextAction: string;
  message: string;
};

export type HistoryListItem = {
  jobId: string;
  status: HistoryJobStatus;
  updatedAt: string;
};

export type HistoryListResponse =
  | {
      data: { items: HistoryListItem[] };
      error: null;
      meta?: Record<string, unknown>;
    }
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

export type HistoryDetailResponse =
  | {
      data: {
        jobId: string;
        status: HistoryJobStatus;
        updatedAt: string;
        queuedAt?: string;
        processingAt?: string;
        readyAt?: string;
        failedAt?: string;
        failure?: HistoryFailureMetadata;
      };
      error: null;
      meta?: Record<string, unknown>;
    }
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

export function toStatusLabel(status: HistoryJobStatus): string {
  if (status === 'queued') return 'Queued';
  if (status === 'processing') return 'Processing';
  if (status === 'ready') return 'Ready';
  return 'Failed';
}
