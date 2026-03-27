export type PreviewStage = 'loading' | 'ready' | 'failed-preview';

export type PreviewPayload = {
  jobId: string;
  status: 'ready';
  updatedAt: string;
  previewUri: string;
  mimeType: 'video/mp4';
};

export type ExportPayload = {
  jobId: string;
  status: 'ready';
  updatedAt: string;
  exportUri: string;
  mimeType: 'video/mp4';
};

export type ApiErrorEnvelope = {
  data: null;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
    traceId: string;
  };
};
