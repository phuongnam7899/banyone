export const FUNNEL_TELEMETRY_SCHEMA_VERSION = 2 as const;

export const FUNNEL_STAGES = [
  'input_selected',
  'validation_completed',
  'disclosure_presented',
  'disclosure_acknowledged',
  'submit_result',
  'job_status_transition',
  'preview_export',
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_PLATFORMS = ['ios', 'android', 'web', 'unknown'] as const;

export type FunnelPlatform = (typeof FUNNEL_PLATFORMS)[number];

export const SUBMISSION_OUTCOME_CLASSES = [
  'accepted',
  'validation_rejected',
  'rate_limited',
  'disclosure_required',
  'policy_blocked',
  'abuse_restricted',
  'network_error',
] as const;

export type SubmissionOutcomeClass = (typeof SUBMISSION_OUTCOME_CLASSES)[number];

export const TERMINAL_JOB_STATUS_CLASSES = ['queued', 'processing', 'ready', 'failed'] as const;

export type TerminalJobStatusClass = (typeof TERMINAL_JOB_STATUS_CLASSES)[number];

type FunnelTelemetryEventBaseV2 = {
  schemaVersion: typeof FUNNEL_TELEMETRY_SCHEMA_VERSION;
  funnelStage: FunnelStage;
  occurredAt: string;
  platform: FunnelPlatform;
  clientSessionId: string;
  submissionOutcomeClass?: SubmissionOutcomeClass;
  terminalJobStatusClass?: TerminalJobStatusClass;
  eventName?: string;
  code?: string;
};

/**
 * Funnel V2 adds `qualityTier` to job-correlated events so conversion reporting can be bucketed
 * directly from telemetry streams without joining backend job storage.
 */
export type FunnelTelemetryEventV2 =
  | (FunnelTelemetryEventBaseV2 & {
      jobId: string;
      qualityTier: number;
    })
  | (FunnelTelemetryEventBaseV2 & {
      jobId?: undefined;
      qualityTier?: undefined;
    });

/** Backward-compatible alias used by existing callers in this repository. */
export type FunnelTelemetryEventV1 = FunnelTelemetryEventV2;
