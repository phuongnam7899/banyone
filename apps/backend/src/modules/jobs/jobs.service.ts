import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { validateJobInputCompliance } from '@banyone/contracts';

import { SyntheticMediaDisclosureStore } from '../disclosure/synthetic-media-disclosure.store';
import { JobLifecyclePushService } from '../notifications/job-lifecycle-push.service';
import { assertAllowedLifecycleTransition } from './jobs.lifecycle';
import type { CreateGenerationJobRequestBody } from './dto/create-generation-job.request';
import type {
  GenerationJobEnvelope,
  GenerationJobExportEnvelope,
  GenerationJobHistoryDetailEnvelope,
  GenerationJobHistoryListEnvelope,
  GenerationJobInputViolationDetail,
  GenerationJobPreviewEnvelope,
  GenerationJobStatus,
  GenerationJobValidationErrorDetails,
  GenerationJobErrorEnvelope,
  GenerationJobStatusEnvelope,
  GenerationJobStatusPayload,
} from './jobs.types';

/** Separates Firebase uid from client idempotency key in persisted storage. */
const IDEMPOTENCY_SCOPING_SEP = '\u001f';

/** Jobs and idempotency rows migrated from pre–Story 2.1 stores. */
const LEGACY_UNSCOPED_USER_ID = '__legacy_unscoped__';
const DISCLOSURE_REQUIRED_ERROR_CODE = 'DISCLOSURE_REQUIRED';

type PersistedJobsStore = {
  version: 3;
  idempotency: Record<string, { jobId: string; status: GenerationJobStatus }>;
  jobs: Record<string, PersistedJobRecord>;
};

type PersistedJobRecord = {
  jobId: string;
  userId: string;
  status: GenerationJobStatus;

  // Internal timestamps stored as unix epoch milliseconds.
  updatedAtMs: number;
  queuedAtMs?: number;
  processingAtMs?: number;
  readyAtMs?: number;
  failedAtMs?: number;

  failure?: {
    retryable: boolean;
    reasonCode: string;
    nextAction: string;
    message: string;
  };
};

function scopedIdempotencyKey(userId: string, clientKey: string): string {
  return `${userId}${IDEMPOTENCY_SCOPING_SEP}${clientKey}`;
}

@Injectable()
export class JobsService {
  private readonly storeDir: string;
  private readonly storeFilePath: string;
  private store: PersistedJobsStore;
  private readonly inFlight = new Map<string, Promise<GenerationJobEnvelope>>();

  // MVP lifecycle progression model:
  // - queued -> processing after a short delay
  // - processing -> ready|failed after a longer delay
  // This keeps the system transport-agnostic (polling only) while still meeting
  // the status freshness expectation from Story 1.5.
  private readonly queuedToProcessingMs = 600;
  private readonly processingToFinalMs = 1800;
  private readonly maxEtaSeconds = 60;

  // Invariant metric: should remain 0 because the service only commits allowed transitions.
  private illegalTransitionCount = 0;

  constructor(
    private readonly jobLifecyclePush: JobLifecyclePushService,
    private readonly disclosure: SyntheticMediaDisclosureStore,
  ) {
    // Tests can set BANYONE_JOBS_DATA_DIR to isolate persistence.
    const configuredDir = process.env.BANYONE_JOBS_DATA_DIR;
    this.storeDir =
      configuredDir ?? path.join(process.cwd(), '.banyone-jobs-data');
    this.storeFilePath = path.join(this.storeDir, 'jobs-store.json');
    mkdirSync(this.storeDir, { recursive: true });
    this.store = this.loadStore();
  }

  private loadStore(): PersistedJobsStore {
    if (!existsSync(this.storeFilePath)) {
      return { version: 3, idempotency: {}, jobs: {} };
    }
    try {
      const raw = readFileSync(this.storeFilePath, { encoding: 'utf-8' });
      const parsedUnknown = JSON.parse(raw) as unknown;
      return this.normalizePersistedJobsStore(parsedUnknown);
    } catch {
      return { version: 3, idempotency: {}, jobs: {} };
    }
  }

  private normalizePersistedJobsStore(
    parsedUnknown: unknown,
  ): PersistedJobsStore {
    if (
      typeof parsedUnknown !== 'object' ||
      parsedUnknown === null ||
      !('idempotency' in parsedUnknown) ||
      !('jobs' in parsedUnknown)
    ) {
      return { version: 3, idempotency: {}, jobs: {} };
    }

    const parsed = parsedUnknown as {
      version?: unknown;
      idempotency: Record<
        string,
        { jobId: string; status: GenerationJobStatus }
      >;
      jobs: Record<string, unknown>;
    };

    let version: number =
      typeof parsed.version === 'number' ? parsed.version : 2;

    let idempotency = { ...parsed.idempotency };
    let jobs: Record<string, PersistedJobRecord> = {};

    if (version === 1) {
      const nowMs = Date.now();
      const migratedJobs: Record<string, PersistedJobRecord> = {};
      const jobsUnknown = parsed.jobs;

      for (const [jobKey, job] of Object.entries(jobsUnknown)) {
        const maybeJob = job as { jobId?: unknown; status?: unknown };
        const jobId =
          typeof maybeJob.jobId === 'string' && maybeJob.jobId.trim().length > 0
            ? maybeJob.jobId
            : jobKey;

        const statusUnknown = maybeJob.status;
        if (
          statusUnknown !== 'queued' &&
          statusUnknown !== 'processing' &&
          statusUnknown !== 'ready' &&
          statusUnknown !== 'failed'
        ) {
          continue;
        }

        const status = statusUnknown;

        migratedJobs[jobKey] = {
          jobId,
          userId: LEGACY_UNSCOPED_USER_ID,
          status,
          updatedAtMs: nowMs,
          queuedAtMs: status === 'queued' ? nowMs : undefined,
          processingAtMs: status === 'processing' ? nowMs : undefined,
          readyAtMs: status === 'ready' ? nowMs : undefined,
          failedAtMs: status === 'failed' ? nowMs : undefined,
        };
      }
      jobs = migratedJobs;
      const scopedIdem: Record<
        string,
        { jobId: string; status: GenerationJobStatus }
      > = {};
      for (const [k, v] of Object.entries(idempotency)) {
        scopedIdem[scopedIdempotencyKey(LEGACY_UNSCOPED_USER_ID, k)] = v;
      }
      idempotency = scopedIdem;
      version = 3;
    } else {
      for (const [jobKey, jobUnknown] of Object.entries(parsed.jobs)) {
        const j = jobUnknown as Record<string, unknown>;
        if (
          typeof j.jobId !== 'string' ||
          (j.status !== 'queued' &&
            j.status !== 'processing' &&
            j.status !== 'ready' &&
            j.status !== 'failed')
        ) {
          continue;
        }
        const uid =
          typeof j.userId === 'string' && j.userId.length > 0
            ? j.userId
            : LEGACY_UNSCOPED_USER_ID;
        jobs[jobKey] = {
          jobId: j.jobId,
          userId: uid,
          status: j.status as GenerationJobStatus,
          updatedAtMs:
            typeof j.updatedAtMs === 'number' ? j.updatedAtMs : Date.now(),
          ...(typeof j.queuedAtMs === 'number'
            ? { queuedAtMs: j.queuedAtMs }
            : {}),
          ...(typeof j.processingAtMs === 'number'
            ? { processingAtMs: j.processingAtMs }
            : {}),
          ...(typeof j.readyAtMs === 'number'
            ? { readyAtMs: j.readyAtMs }
            : {}),
          ...(typeof j.failedAtMs === 'number'
            ? { failedAtMs: j.failedAtMs }
            : {}),
          ...(typeof j.failure === 'object' &&
          j.failure !== null &&
          'retryable' in j.failure &&
          'reasonCode' in j.failure &&
          'nextAction' in j.failure &&
          'message' in j.failure
            ? {
                failure: j.failure as PersistedJobRecord['failure'],
              }
            : {}),
        };
      }

      if (version === 2) {
        const scopedIdem: Record<
          string,
          { jobId: string; status: GenerationJobStatus }
        > = {};
        for (const [k, v] of Object.entries(idempotency)) {
          if (k.includes(IDEMPOTENCY_SCOPING_SEP)) {
            scopedIdem[k] = v;
          } else {
            scopedIdem[scopedIdempotencyKey(LEGACY_UNSCOPED_USER_ID, k)] = v;
          }
        }
        idempotency = scopedIdem;
        for (const job of Object.values(jobs)) {
          if (!job.userId) job.userId = LEGACY_UNSCOPED_USER_ID;
        }
        version = 3;
      }
    }

    if (version !== 3) {
      return { version: 3, idempotency: {}, jobs: {} };
    }

    return { version: 3, idempotency, jobs };
  }

  private saveStore(): void {
    writeFileSync(this.storeFilePath, JSON.stringify(this.store, null, 2), {
      encoding: 'utf-8',
    });
  }

  private normalizeIdempotencyKey(
    input?: string,
  ): { ok: true; value: string } | { ok: false } {
    const trimmed = (input ?? '').trim();
    if (!trimmed) return { ok: false };
    return { ok: true, value: trimmed };
  }

  private makeErrorEnvelope(params: {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
  }): GenerationJobErrorEnvelope {
    return {
      data: null,
      error: {
        code: params.code,
        message: params.message,
        retryable: params.retryable,
        details: params.details,
        traceId: randomUUID(),
      },
    };
  }

  private makeSuccessEnvelope(params: {
    jobId: string;
    status: GenerationJobStatus;
  }): GenerationJobEnvelope {
    return {
      data: {
        jobId: params.jobId,
        status: params.status,
      },
      error: null,
    };
  }

  private enqueuePlaceholderProcessing(): void {
    // Story 1.4 requires immediate acknowledgment without waiting for processing.
    // A later story will implement a real async worker/enqueue adapter.
    // Intentionally do nothing here.
  }

  async createGenerationJob(params: {
    userId: string;
    body: CreateGenerationJobRequestBody;
    idempotencyKeyHeader?: string;
  }): Promise<GenerationJobEnvelope> {
    const startedAt = Date.now();
    const normalized = this.normalizeIdempotencyKey(
      params.idempotencyKeyHeader,
    );
    if (!normalized.ok) {
      const envelope = this.makeErrorEnvelope({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Missing or invalid idempotency key.',
        retryable: false,
      });
      this.recordAckTelemetry(envelope, startedAt);
      return envelope;
    }

    const key = scopedIdempotencyKey(params.userId, normalized.value);
    const existingPromise = this.inFlight.get(key);
    if (existingPromise) {
      const envelope = await existingPromise;
      this.recordAckTelemetry(envelope, startedAt);
      return envelope;
    }

    const promise = Promise.resolve(
      this.handleCreateForKey({
        userId: params.userId,
        key,
        body: params.body,
      }),
    ).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    const envelope = await promise;
    this.recordAckTelemetry(envelope, startedAt);
    return envelope;
  }

  private recordAckTelemetry(
    envelope: GenerationJobEnvelope,
    startedAt: number,
  ): void {
    if (envelope.error === null) {
      console.info('telemetry.jobs.generation.acknowledged.v1', {
        outcome: 'accepted',
        jobId: envelope.data.jobId,
        status: envelope.data.status,
        serverAckHandlingMs: Date.now() - startedAt,
      });
      return;
    }

    const details = envelope.error.details as
      | GenerationJobValidationErrorDetails
      | undefined;
    const rejectionCodes = details?.violations?.map((v) => v.code) ?? [];

    console.info('telemetry.jobs.generation.acknowledged.v1', {
      outcome: 'rejected',
      rejectionCodes,
      serverAckHandlingMs: Date.now() - startedAt,
      traceId: envelope.error.traceId,
    });
  }

  getGenerationJobStatus(params: {
    userId: string;
    jobId: string;
  }): GenerationJobStatusEnvelope {
    const job = this.store.jobs[params.jobId];
    if (!job || job.userId !== params.userId) {
      // Keep canonical envelope shape, even for not-found.
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found.',
        retryable: false,
      });
    }

    const nowMs = Date.now();
    const transition = this.advanceJobLifecycleIfNeeded({
      job,
      nowMs,
    });

    if (transition) {
      console.info('telemetry.jobs.lifecycle.transition.v1', {
        jobId: job.jobId,
        from: transition.from,
        to: transition.to,
        occurredAt: new Date(transition.occurredAtMs).toISOString(),
      });
    }

    // Persist any status changes to maintain canonical server truth.
    if (transition) this.saveStore();

    if (transition) {
      if (transition.to === 'ready') {
        this.jobLifecyclePush.notifyJobReady(job.userId, job.jobId);
      }
      if (transition.to === 'failed' && job.failure) {
        this.jobLifecyclePush.notifyJobFailed(
          job.userId,
          job.jobId,
          job.failure,
        );
      }
    }

    const payload = this.mapJobToStatusPayload({
      job,
      nowMs,
    });

    return {
      data: payload,
      error: null,
    };
  }

  listGenerationJobs(params: {
    userId: string;
  }): GenerationJobHistoryListEnvelope {
    const items = Object.values(this.store.jobs)
      .filter((job) => job.userId === params.userId)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      .map((job) => ({
        jobId: job.jobId,
        status: job.status,
        updatedAt: new Date(job.updatedAtMs).toISOString(),
      }));

    return {
      data: { items },
      error: null,
      meta: { total: items.length },
    };
  }

  getGenerationJobHistoryDetail(params: {
    userId: string;
    jobId: string;
  }): GenerationJobHistoryDetailEnvelope {
    const job = this.store.jobs[params.jobId];
    if (!job || job.userId !== params.userId) {
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found.',
        retryable: false,
      });
    }

    return {
      data: {
        jobId: job.jobId,
        status: job.status,
        updatedAt: new Date(job.updatedAtMs).toISOString(),
        ...(typeof job.queuedAtMs === 'number'
          ? { queuedAt: new Date(job.queuedAtMs).toISOString() }
          : {}),
        ...(typeof job.processingAtMs === 'number'
          ? { processingAt: new Date(job.processingAtMs).toISOString() }
          : {}),
        ...(typeof job.readyAtMs === 'number'
          ? { readyAt: new Date(job.readyAtMs).toISOString() }
          : {}),
        ...(typeof job.failedAtMs === 'number'
          ? { failedAt: new Date(job.failedAtMs).toISOString() }
          : {}),
        ...(job.failure ? { failure: job.failure } : {}),
      },
      error: null,
    };
  }

  getGenerationJobPreview(params: {
    userId: string;
    jobId: string;
  }): GenerationJobPreviewEnvelope {
    const job = this.store.jobs[params.jobId];
    if (!job || job.userId !== params.userId) {
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found.',
        retryable: false,
      });
    }
    if (job.status !== 'ready') {
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_READY',
        message: 'Preview is available only after the job is ready.',
        retryable: true,
        details: { expectedStatus: 'ready', currentStatus: job.status },
      });
    }
    if (this.shouldPreviewFail(job.jobId)) {
      return this.makeErrorEnvelope({
        code: 'PREVIEW_LOAD_FAILED',
        message: 'Preview failed to load. Please retry.',
        retryable: true,
        details: { stage: 'failed-preview' },
      });
    }

    return {
      data: {
        jobId: job.jobId,
        status: 'ready',
        updatedAt: new Date(job.updatedAtMs).toISOString(),
        previewUri: `https://cdn.banyone.local/generated/${job.jobId}.mp4`,
        mimeType: 'video/mp4',
      },
      error: null,
    };
  }

  createGenerationJobExport(params: {
    userId: string;
    jobId: string;
  }): GenerationJobExportEnvelope {
    const job = this.store.jobs[params.jobId];
    if (!job || job.userId !== params.userId) {
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found.',
        retryable: false,
      });
    }
    if (job.status !== 'ready') {
      return this.makeErrorEnvelope({
        code: 'JOB_NOT_READY',
        message: 'Export is available only after the job is ready.',
        retryable: true,
        details: { expectedStatus: 'ready', currentStatus: job.status },
      });
    }
    if (this.shouldExportFail(job.jobId)) {
      return this.makeErrorEnvelope({
        code: 'EXPORT_PREPARATION_FAILED',
        message: 'Unable to prepare export file. Please retry.',
        retryable: true,
        details: { outputStatePreserved: true },
      });
    }

    return {
      data: {
        jobId: job.jobId,
        status: 'ready',
        updatedAt: new Date(job.updatedAtMs).toISOString(),
        exportUri: `file:///tmp/banyone/${job.jobId}.mp4`,
        mimeType: 'video/mp4',
      },
      error: null,
    };
  }

  /**
   * Test/diagnostics helper for Story 1.5 observability:
   * ensures lifecycle transition integrity enforcement stays error-free.
   */
  public getLifecycleInvariantReport(): {
    illegalTransitionCount: number;
  } {
    return { illegalTransitionCount: this.illegalTransitionCount };
  }

  /**
   * Test helper for Story 1.5:
   * allows seeding persisted job lifecycle state without reaching into private store internals.
   */
  public __testSeedJob(params: {
    jobId: string;
    userId?: string;
    status: GenerationJobStatus;
    updatedAtMs?: number;
    queuedAtMs?: number;
    processingAtMs?: number;
    readyAtMs?: number;
    failedAtMs?: number;
    failure?: {
      retryable: boolean;
      reasonCode: string;
      nextAction: string;
      message: string;
    };
  }): void {
    const updatedAtMs = params.updatedAtMs ?? Date.now();
    const userId =
      params.userId ?? process.env.BANYONE_AUTH_TEST_UID ?? 'test-user-uid';

    const queuedAtMs =
      params.status === 'queued'
        ? (params.queuedAtMs ?? updatedAtMs)
        : params.queuedAtMs;
    const processingAtMs =
      params.status === 'processing'
        ? (params.processingAtMs ?? updatedAtMs)
        : params.processingAtMs;
    const readyAtMs =
      params.status === 'ready'
        ? (params.readyAtMs ?? updatedAtMs)
        : params.readyAtMs;
    const failedAtMs =
      params.status === 'failed'
        ? (params.failedAtMs ?? updatedAtMs)
        : params.failedAtMs;

    this.store.jobs[params.jobId] = {
      jobId: params.jobId,
      userId,
      status: params.status,
      updatedAtMs,
      queuedAtMs,
      processingAtMs,
      readyAtMs,
      failedAtMs,
      ...(params.status === 'failed' && params.failure
        ? { failure: params.failure }
        : {}),
    };
  }

  private advanceJobLifecycleIfNeeded(params: {
    job: PersistedJobRecord;
    nowMs: number;
  }): {
    from: GenerationJobStatus;
    to: GenerationJobStatus;
    occurredAtMs: number;
  } | null {
    const { job, nowMs } = params;

    // Transition model rules:
    // - committed states only ever move forward
    // - at most ONE transition per read to prevent illegal skipping
    if (job.status === 'queued') {
      const queuedAtMs = job.queuedAtMs ?? job.updatedAtMs;
      if (nowMs - queuedAtMs >= this.queuedToProcessingMs) {
        const from: GenerationJobStatus = 'queued';
        const to: GenerationJobStatus = 'processing';
        try {
          assertAllowedLifecycleTransition(from, to);
        } catch (err) {
          this.illegalTransitionCount += 1;
          throw err;
        }
        job.status = to;
        job.processingAtMs = nowMs;
        job.updatedAtMs = nowMs;
        delete job.failure;
        return { from, to, occurredAtMs: nowMs };
      }
      return null;
    }

    if (job.status === 'processing') {
      const processingAtMs = job.processingAtMs ?? job.updatedAtMs;
      if (nowMs - processingAtMs >= this.processingToFinalMs) {
        const from: GenerationJobStatus = 'processing';
        const shouldFail = this.shouldJobFail(job.jobId);
        const to: GenerationJobStatus = shouldFail ? 'failed' : 'ready';

        try {
          assertAllowedLifecycleTransition(from, to);
        } catch (err) {
          this.illegalTransitionCount += 1;
          throw err;
        }

        job.status = to;
        job.updatedAtMs = nowMs;
        if (to === 'ready') {
          job.readyAtMs = nowMs;
          delete job.failure;
        } else {
          job.failedAtMs = nowMs;
          job.failure = this.buildFailureMetadata({ jobId: job.jobId });
        }

        return { from, to, occurredAtMs: nowMs };
      }
      return null;
    }

    return null;
  }

  private mapJobToStatusPayload(params: {
    job: PersistedJobRecord;
    nowMs: number;
  }): GenerationJobStatusPayload {
    const { job, nowMs } = params;
    const updatedAt = new Date(job.updatedAtMs).toISOString();

    const payload: GenerationJobStatusPayload = {
      jobId: job.jobId,
      status: job.status,
      updatedAt,
    };

    if (job.status === 'queued') {
      const queuedAtMs = job.queuedAtMs ?? job.updatedAtMs;
      const remainingMs = Math.max(
        0,
        this.queuedToProcessingMs - (nowMs - queuedAtMs),
      );
      payload.etaSeconds = this.remainingMsToEtaSeconds(remainingMs);
    }

    if (job.status === 'processing') {
      const processingAtMs = job.processingAtMs ?? job.updatedAtMs;
      const remainingMs = Math.max(
        0,
        this.processingToFinalMs - (nowMs - processingAtMs),
      );
      payload.etaSeconds = this.remainingMsToEtaSeconds(remainingMs);
    }

    if (job.status === 'failed') {
      if (job.failure) {
        payload.failure = job.failure;
      } else {
        payload.failure = {
          retryable: false,
          reasonCode: 'PROCESSING_FAILED_UNKNOWN',
          nextAction: 'contact_support',
          message: 'Processing failed.',
        };
      }
    }

    return payload;
  }

  private remainingMsToEtaSeconds(remainingMs: number): number {
    // Bounded representation for UI copy; never show 0 in timeline
    // because stage changes are immediately polled.
    const seconds = Math.ceil(remainingMs / 1000);
    if (!Number.isFinite(seconds) || seconds <= 0) return 1;
    return Math.min(seconds, this.maxEtaSeconds);
  }

  private shouldJobFail(jobId: string): boolean {
    const lastChar = (jobId ?? '').trim().slice(-1).toLowerCase();
    const digit = /^[0-9a-f]$/.test(lastChar)
      ? parseInt(lastChar, 16)
      : jobId.length % 16;

    // Deterministic split:
    // - digit % 3 == 2 => ready
    // - digit % 3 == 0 or 1 => failed
    return digit % 3 !== 2;
  }

  private shouldPreviewFail(jobId: string): boolean {
    return this.readDeterministicHexDigit(jobId) % 5 === 1;
  }

  private shouldExportFail(jobId: string): boolean {
    return this.readDeterministicHexDigit(jobId) % 5 === 2;
  }

  private readDeterministicHexDigit(value: string): number {
    const lastChar = (value ?? '').trim().slice(-1).toLowerCase();
    if (/^[0-9a-f]$/.test(lastChar)) return parseInt(lastChar, 16);
    return value.length % 16;
  }

  private buildFailureMetadata(params: { jobId: string }): {
    retryable: boolean;
    reasonCode: string;
    nextAction: string;
    message: string;
  } {
    const lastChar = (params.jobId ?? '').trim().slice(-1).toLowerCase();
    const digit = /^[0-9a-f]$/.test(lastChar)
      ? parseInt(lastChar, 16)
      : params.jobId.length % 16;

    const mod = digit % 3;
    const retryable = mod === 0;

    return retryable
      ? {
          retryable: true,
          reasonCode: 'PROCESSING_FAILED_RETRYABLE',
          nextAction: 'retry',
          message: 'Processing failed. You can retry this job.',
        }
      : {
          retryable: false,
          reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
          nextAction: 'contact_support',
          message: 'Processing failed and cannot be retried.',
        };
  }

  private handleCreateForKey(params: {
    userId: string;
    key: string;
    body: CreateGenerationJobRequestBody;
  }): GenerationJobEnvelope {
    if (!this.disclosure.isAcceptedForUser(params.userId)) {
      return this.makeErrorEnvelope({
        code: DISCLOSURE_REQUIRED_ERROR_CODE,
        message:
          'Synthetic media disclosure acknowledgment is required before your first generation.',
        retryable: false,
        details: {
          currentVersion: this.disclosure.getCurrentVersion(),
          action: 'acknowledge_disclosure',
        },
      });
    }

    const existing = this.store.idempotency[params.key];
    if (existing) {
      return this.makeSuccessEnvelope({
        jobId: existing.jobId,
        status: existing.status,
      });
    }

    const validation = validateJobInputCompliance({
      video: {
        // If uri is missing, contracts returns `pending`; for submission we want a deterministic validation failure.
        uri: params.body.video.uri?.trim()
          ? params.body.video.uri
          : '__missing__',
        durationSec: params.body.video.durationSec,
        widthPx: params.body.video.widthPx,
        heightPx: params.body.video.heightPx,
        mimeType: params.body.video.mimeType,
      },
      image: {
        uri: params.body.image.uri?.trim()
          ? params.body.image.uri
          : '__missing__',
        widthPx: params.body.image.widthPx,
        heightPx: params.body.image.heightPx,
        mimeType: params.body.image.mimeType,
      },
    });

    const isValid =
      validation.video.status === 'valid' &&
      validation.image.status === 'valid';
    if (!isValid) {
      const violations: GenerationJobInputViolationDetail[] = [
        ...validation.video.violations.map((v) => ({
          ...v,
          slot: 'video' as const,
        })),
        ...validation.image.violations.map((v) => ({
          ...v,
          slot: 'image' as const,
        })),
      ];

      // If for any reason violations are empty (e.g. unexpected contract behavior),
      // still return a deterministic invalid response.
      const details: GenerationJobValidationErrorDetails = {
        violationSummary: {
          videoStatus: validation.video.status,
          imageStatus: validation.image.status,
        },
        violations,
      };

      return this.makeErrorEnvelope({
        code: 'INPUT_INVALID',
        message: 'Input validation failed.',
        retryable: false,
        details,
      });
    }

    const jobId = randomUUID();
    const status: GenerationJobStatus = 'queued';
    const nowMs = Date.now();

    this.store.jobs[jobId] = {
      jobId,
      userId: params.userId,
      status,
      updatedAtMs: nowMs,
      queuedAtMs: nowMs,
    };
    this.store.idempotency[params.key] = { jobId, status };
    this.saveStore();

    this.enqueuePlaceholderProcessing();
    this.jobLifecyclePush.notifyJobQueued(params.userId, jobId);
    return this.makeSuccessEnvelope({ jobId, status });
  }
}
