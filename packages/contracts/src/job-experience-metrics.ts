/**
 * Story 5.2 — Time-to-preview and reliability metrics (canonical definitions)
 *
 * **Time-to-preview (server truth, milliseconds):**
 * `readyAtMs - queuedAtMs` using persisted server timestamps on the job record.
 * Jobs that end in terminal state `failed` without reaching `ready` **do not** contribute a
 * time-to-preview sample (excluded — do not emit a null latency row for that metric).
 * Legacy jobs missing `queuedAtMs` or `readyAtMs` produce **no** sample.
 *
 * **Lifecycle completion reliability (accepted jobs):**
 * Denominator: jobs accepted into the processing pipeline after successful submit (server ack
 * with job entering `queued` or later). At terminal lifecycle, outcomes are classified as
 * `ready` vs `failed` for completion-rate style reporting (aggregation cadence is out of scope).
 *
 * **Export / share reliability (client-observed, from `PreviewExportEvent`):**
 * - **Export success after intent:** among jobs where `export_started` was emitted, the rate of
 *   subsequent `export_succeeded` vs `export_failed` (per job; downstream may dedupe).
 * - **Share completion after open:** among jobs where `share_opened` was emitted, the rate of
 *   `share_completed` vs `share_dismissed` (per job).
 * `preview_viewed` is a separate funnel step and is not the export-success denominator.
 */

import type { FunnelPlatform } from './funnel-telemetry.js';
import type { PreviewExportEventName } from './telemetry.js';

export const JOB_LIFECYCLE_METRICS_SCHEMA_VERSION = 1 as const;

/** Log key for structured backend lifecycle metric records (grep-friendly). */
export const JOB_LIFECYCLE_METRICS_LOG_KEY =
  'telemetry.job.lifecycle.metrics.v1' as const;

export const JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION = 1 as const;

export const DEFAULT_QUALITY_TIER = 1 as const;

export type JobLifecycleTerminalStatusForMetrics = 'ready' | 'failed';

/**
 * Server-emitted payload when a job reaches a terminal lifecycle state (`ready` | `failed`).
 * `timeToPreviewMs` is `null` when no sample applies (failed terminal, or missing timestamps).
 */
export type JobLifecycleMetricsPayloadV1 = {
  schemaVersion: typeof JOB_LIFECYCLE_METRICS_SCHEMA_VERSION;
  jobId: string;
  terminalStatus: JobLifecycleTerminalStatusForMetrics;
  qualityTier: number;
  timeToPreviewMs: number | null;
};

export type JobExperienceMetricKind =
  | 'lifecycle_terminal_observed'
  | 'preview_export_step';

/**
 * Client-side metrics aligned with contracts; uses a dedicated schema version from funnel V1.
 * Prefer `serverTimeToPreviewMs` from the status API when present — do not infer server latency
 * from client clocks alone.
 */
export type JobExperienceMetricsEventV1 = {
  schemaVersion: typeof JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION;
  metricKind: JobExperienceMetricKind;
  occurredAt: string;
  platform: FunnelPlatform;
  clientSessionId: string;
  jobId: string;
  qualityTier: number;
  serverTimeToPreviewMs?: number | null;
  terminalJobStatusClass?: 'ready' | 'failed';
  previewExportEvent?: PreviewExportEventName;
};

export function computeTimeToPreviewMs(params: {
  queuedAtMs?: number;
  readyAtMs?: number;
  terminalStatus: JobLifecycleTerminalStatusForMetrics;
}): number | null {
  if (params.terminalStatus === 'failed') return null;
  const q = params.queuedAtMs;
  const r = params.readyAtMs;
  if (typeof q !== 'number' || typeof r !== 'number') return null;
  return r - q;
}
