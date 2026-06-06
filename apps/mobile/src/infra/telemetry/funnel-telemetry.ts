import {
  FUNNEL_TELEMETRY_SCHEMA_VERSION,
  JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION,
  type CreateJobDraftTelemetryEvent,
  type FunnelPlatform,
  type FunnelStage,
  type FunnelTelemetryEventV1,
  type JobExperienceMetricsEventV1,
  type PreviewExportEvent,
  type PreviewExportEventName,
  type SubmissionOutcomeClass,
  type TerminalJobStatusClass,
} from '@banyone/contracts';
import { Platform } from 'react-native';

type EmitFunnelTelemetryInput = {
  funnelStage: FunnelStage;
  submissionOutcomeClass?: SubmissionOutcomeClass;
  terminalJobStatusClass?: TerminalJobStatusClass;
  eventName?: string;
  code?: string;
} & (
  | {
      jobId: string;
      qualityTier: number;
    }
  | {
      jobId?: undefined;
      qualityTier?: undefined;
    }
);

let cachedSessionId: string | null = null;

function resolvePlatform(): FunnelPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

function randomChunk(): string {
  return Math.random().toString(36).slice(2, 10);
}

function createSessionId(): string {
  const maybeUuid = globalThis.crypto?.randomUUID?.();
  if (typeof maybeUuid === 'string' && maybeUuid.length > 0) {
    return maybeUuid;
  }
  return `sess_${Date.now().toString(36)}_${randomChunk()}`;
}

export function getTelemetrySessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  cachedSessionId = createSessionId();
  return cachedSessionId;
}

export function emitFunnelTelemetry(input: EmitFunnelTelemetryInput): FunnelTelemetryEventV1 {
  const payload: FunnelTelemetryEventV1 = {
    schemaVersion: FUNNEL_TELEMETRY_SCHEMA_VERSION,
    funnelStage: input.funnelStage,
    occurredAt: new Date().toISOString(),
    platform: resolvePlatform(),
    clientSessionId: getTelemetrySessionId(),
    ...(input.jobId ? { jobId: input.jobId, qualityTier: input.qualityTier } : {}),
    ...(input.submissionOutcomeClass ? { submissionOutcomeClass: input.submissionOutcomeClass } : {}),
    ...(input.terminalJobStatusClass ? { terminalJobStatusClass: input.terminalJobStatusClass } : {}),
    ...(input.eventName ? { eventName: input.eventName } : {}),
    ...(input.code ? { code: input.code } : {}),
  };

  if (__DEV__) {
    console.info('telemetry.funnel.v1', payload);
  }

  return payload;
}

type DraftTelemetryInput = {
  event: CreateJobDraftTelemetryEvent['event'];
  funnelStage: FunnelStage;
  hasVideo: boolean;
  hasImage: boolean;
  hadPendingIdempotencyKey?: boolean;
  submissionOutcomeClass?: SubmissionOutcomeClass;
  terminalJobStatusClass?: TerminalJobStatusClass;
  eventName?: string;
  code?: string;
} & (
  | {
      jobId: string;
      qualityTier: number;
    }
  | {
      jobId?: undefined;
      qualityTier?: undefined;
    }
);

export function emitCreateJobDraftTelemetry(input: DraftTelemetryInput): CreateJobDraftTelemetryEvent {
  const base = emitFunnelTelemetry(input);
  const payload: CreateJobDraftTelemetryEvent = {
    ...base,
    event: input.event,
    hasVideo: input.hasVideo,
    hasImage: input.hasImage,
    ...(input.hadPendingIdempotencyKey !== undefined
      ? { hadPendingIdempotencyKey: input.hadPendingIdempotencyKey }
      : {}),
  };
  if (__DEV__) {
    console.info(`telemetry.${input.event}.v1`, payload);
  }
  return payload;
}

type PreviewTelemetryInput = {
  event: PreviewExportEvent['event'];
  funnelStage: FunnelStage;
  jobId: string;
  qualityTier: number;
  submissionOutcomeClass?: SubmissionOutcomeClass;
  terminalJobStatusClass?: TerminalJobStatusClass;
  eventName?: string;
  code?: string;
};

export function emitPreviewExportTelemetry(input: PreviewTelemetryInput): PreviewExportEvent {
  const base = emitFunnelTelemetry(input);
  const payload: PreviewExportEvent = {
    ...base,
    event: input.event,
    ...(input.code ? { code: input.code } : {}),
  };
  if (__DEV__) {
    console.info(`telemetry.${input.event}.v1`, payload);
  }
  return payload;
}

type JobExperienceLifecycleInput = {
  metricKind: 'lifecycle_terminal_observed';
  jobId: string;
  qualityTier: number;
  serverTimeToPreviewMs?: number | null;
  terminalJobStatusClass: 'ready' | 'failed';
};

type JobExperienceExportInput = {
  metricKind: 'preview_export_step';
  jobId: string;
  qualityTier: number;
  previewExportEvent: PreviewExportEventName;
  serverTimeToPreviewMs?: number | null;
};

type EmitJobExperienceMetricsInput =
  | JobExperienceLifecycleInput
  | JobExperienceExportInput;

export function emitJobExperienceMetrics(
  input: EmitJobExperienceMetricsInput,
): JobExperienceMetricsEventV1 {
  const base: Pick<
    JobExperienceMetricsEventV1,
    'occurredAt' | 'platform' | 'clientSessionId' | 'jobId' | 'qualityTier' | 'schemaVersion'
  > = {
    schemaVersion: JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION,
    occurredAt: new Date().toISOString(),
    platform: resolvePlatform(),
    clientSessionId: getTelemetrySessionId(),
    jobId: input.jobId,
    qualityTier: input.qualityTier,
  };

  const payload: JobExperienceMetricsEventV1 =
    input.metricKind === 'lifecycle_terminal_observed'
      ? {
          ...base,
          metricKind: 'lifecycle_terminal_observed',
          terminalJobStatusClass: input.terminalJobStatusClass,
          ...(input.serverTimeToPreviewMs !== undefined
            ? { serverTimeToPreviewMs: input.serverTimeToPreviewMs }
            : {}),
        }
      : {
          ...base,
          metricKind: 'preview_export_step',
          previewExportEvent: input.previewExportEvent,
          ...(input.serverTimeToPreviewMs !== undefined
            ? { serverTimeToPreviewMs: input.serverTimeToPreviewMs }
            : {}),
        };

  if (__DEV__) {
    console.info('telemetry.job.experience.metrics.v1', payload);
  }

  return payload;
}
