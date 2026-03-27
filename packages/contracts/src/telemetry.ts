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
