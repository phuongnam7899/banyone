export type JobStatusStage = 'queued' | 'processing' | 'ready' | 'failed';

export type JobFailureMetadata = {
  retryable: boolean;
  reasonCode: string;
  nextAction: string;
  message: string;
};

export type JobStatusPayload = {
  jobId: string;
  status: JobStatusStage;
  updatedAt: string;
  etaSeconds?: number;
  failure?: JobFailureMetadata;
};

