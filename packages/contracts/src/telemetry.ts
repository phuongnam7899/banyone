export type PreviewExportEventName =
  | 'preview_viewed'
  | 'export_started'
  | 'export_succeeded'
  | 'export_failed'
  | 'share_opened'
  | 'share_completed'
  | 'share_dismissed';

export type PreviewExportEvent = {
  event: PreviewExportEventName;
  jobId: string;
  code?: string;
};

export type CreateJobDraftTelemetryEventName =
  | 'create_job_draft_saved'
  | 'create_job_draft_loaded'
  | 'create_job_draft_discarded'
  | 'create_job_submit_retry_after_failure';

export type CreateJobDraftTelemetryEvent = {
  event: CreateJobDraftTelemetryEventName;
  /** Avoid logging raw paths in production; use booleans or hashed ids only. */
  hasVideo: boolean;
  hasImage: boolean;
  hadPendingIdempotencyKey?: boolean;
};
