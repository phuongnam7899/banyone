import {
  FUNNEL_STAGES,
  FUNNEL_TELEMETRY_SCHEMA_VERSION,
  JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION,
  SUBMISSION_OUTCOME_CLASSES,
  TERMINAL_JOB_STATUS_CLASSES,
} from '@banyone/contracts';
import {
  emitCreateJobDraftTelemetry,
  emitFunnelTelemetry,
  emitJobExperienceMetrics,
  emitPreviewExportTelemetry,
  getTelemetrySessionId,
} from './funnel-telemetry';

beforeAll(() => {
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('emitFunnelTelemetry', () => {
  it('includes schemaVersion, funnelStage, occurredAt, platform, clientSessionId, and stable session across emissions', () => {
    const first = emitFunnelTelemetry({ funnelStage: 'submit_result' });
    const second = emitFunnelTelemetry({
      funnelStage: 'job_status_transition',
      jobId: 'job-123',
      qualityTier: 2,
    });

    expect(first.schemaVersion).toBe(FUNNEL_TELEMETRY_SCHEMA_VERSION);
    expect(first.funnelStage).toBe('submit_result');
    expect(second.funnelStage).toBe('job_status_transition');
    expect(second.jobId).toBe('job-123');
    expect(first.clientSessionId).toBe(second.clientSessionId);
    expect(first.clientSessionId.length).toBeGreaterThan(0);

    expect(new Date(first.occurredAt).toString()).not.toBe('Invalid Date');
    expect(first.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(FUNNEL_STAGES).toContain(first.funnelStage);
    expect(['ios', 'android', 'web', 'unknown']).toContain(first.platform);
  });

  it('includes optional submission and job status outcome classes when provided', () => {
    const payload = emitFunnelTelemetry({
      funnelStage: 'submit_result',
      submissionOutcomeClass: 'accepted',
      terminalJobStatusClass: 'ready',
    });
    expect(payload.submissionOutcomeClass).toBe('accepted');
    expect(payload.terminalJobStatusClass).toBe('ready');
    expect(SUBMISSION_OUTCOME_CLASSES).toContain(payload.submissionOutcomeClass!);
    expect(TERMINAL_JOB_STATUS_CLASSES).toContain(payload.terminalJobStatusClass!);
  });

  it('includes qualityTier when jobId is present', () => {
    const payload = emitFunnelTelemetry({
      funnelStage: 'submit_result',
      jobId: 'job-with-tier',
      qualityTier: 5,
      submissionOutcomeClass: 'accepted',
    });

    expect(payload.jobId).toBe('job-with-tier');
    expect(payload.qualityTier).toBe(5);
  });

  it('passes through eventName and code when provided', () => {
    const payload = emitFunnelTelemetry({
      funnelStage: 'disclosure_presented',
      eventName: 'disclosure',
      code: 'SYNTHETIC_MEDIA',
    });
    expect(payload.eventName).toBe('disclosure');
    expect(payload.code).toBe('SYNTHETIC_MEDIA');
  });
});

describe('emitCreateJobDraftTelemetry', () => {
  it('extends base funnel payload with draft event and media flags', () => {
    const payload = emitCreateJobDraftTelemetry({
      event: 'create_job_draft_saved',
      funnelStage: 'input_selected',
      hasVideo: true,
      hasImage: false,
      hadPendingIdempotencyKey: true,
    });
    expect(payload.event).toBe('create_job_draft_saved');
    expect(payload.hasVideo).toBe(true);
    expect(payload.hasImage).toBe(false);
    expect(payload.hadPendingIdempotencyKey).toBe(true);
    expect(payload.funnelStage).toBe('input_selected');
    expect(payload.schemaVersion).toBe(FUNNEL_TELEMETRY_SCHEMA_VERSION);
    expect(payload.clientSessionId).toBe(getTelemetrySessionId());
  });
});

describe('emitPreviewExportTelemetry', () => {
  it('extends base funnel payload with preview/export event and jobId', () => {
    const payload = emitPreviewExportTelemetry({
      event: 'export_started',
      funnelStage: 'preview_export',
      jobId: 'job-abc',
      qualityTier: 3,
      code: 'EXPORT_ERR',
    });
    expect(payload.event).toBe('export_started');
    expect(payload.jobId).toBe('job-abc');
    expect(payload.funnelStage).toBe('preview_export');
    expect(payload.code).toBe('EXPORT_ERR');
    expect(payload.qualityTier).toBe(3);
  });
});

describe('emitJobExperienceMetrics', () => {
  it('emits lifecycle_terminal_observed with dedicated schema version', () => {
    const payload = emitJobExperienceMetrics({
      metricKind: 'lifecycle_terminal_observed',
      jobId: 'job-x',
      qualityTier: 1,
      serverTimeToPreviewMs: 222,
      terminalJobStatusClass: 'ready',
    });
    expect(payload.schemaVersion).toBe(JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION);
    expect(payload.metricKind).toBe('lifecycle_terminal_observed');
    expect(payload.serverTimeToPreviewMs).toBe(222);
    expect(payload.clientSessionId).toBe(getTelemetrySessionId());
  });

  it('emits preview_export_step with preview export event name', () => {
    const payload = emitJobExperienceMetrics({
      metricKind: 'preview_export_step',
      jobId: 'job-y',
      qualityTier: 2,
      previewExportEvent: 'export_started',
    });
    expect(payload.metricKind).toBe('preview_export_step');
    expect(payload.previewExportEvent).toBe('export_started');
    expect(payload.qualityTier).toBe(2);
  });
});

describe('getTelemetrySessionId', () => {
  it('returns the same opaque id for the lifetime of the module', () => {
    expect(getTelemetrySessionId()).toBe(getTelemetrySessionId());
  });
});
