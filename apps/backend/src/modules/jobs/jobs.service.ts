import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import {
  ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
  INSUFFICIENT_CREDIT_ERROR_CODE,
  type JobCostSignalPayloadV1,
  POLICY_VIOLATION_ERROR_CODE,
  computeTimeToPreviewMs,
  DEFAULT_QUALITY_TIER,
  JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
  isJobPolicyViolationDetails,
  validateJobInputCompliance,
} from '@banyone/contracts';

import { emitJobLifecycleMetricsV1Log } from '../../telemetry/job-lifecycle-metrics';
import { FIRESTORE } from '../../infra/firestore.module';
import {
  computeJobCostSignalV1,
  emitJobCostSignalV1Log,
} from '../../telemetry/job-cost-signal';
import { AbuseService } from '../abuse/abuse.service';
import { SyntheticMediaDisclosureStore } from '../disclosure/synthetic-media-disclosure.store';
import { JobPolicyScreeningService } from '../job-policy/job-policy-screening.service';
import { JobLifecyclePushService } from '../notifications/job-lifecycle-push.service';
import { JobMediaAssetsService } from './job-media-assets.service';
import { assertAllowedLifecycleTransition } from './jobs.lifecycle';
import { ReplicateGenerationProvider } from './replicate-generation.provider';
import type { CreateGenerationJobRequestBody } from './dto/create-generation-job.request';
import { UserCreditsStore } from './user-credits.store';
import type {
  GenerationJobEnvelope,
  GenerationJobExportEnvelope,
  GenerationJobCreditsEnvelope,
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

type CreditChargeResult =
  | { ok: true }
  | {
      ok: false;
      reasonCode: 'INSUFFICIENT_CREDIT_BALANCE' | 'CREDIT_DEBIT_FAILED';
      retryable: boolean;
      message: string;
    };

export type PersistedJobRecord = {
  jobId: string;
  userId: string;
  status: GenerationJobStatus;
  traceId?: string;
  /** Metrics segmentation; defaults to {@link DEFAULT_QUALITY_TIER} when missing (legacy rows). */
  qualityTier?: number;

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
    traceId?: string;
  };
  /**
   * Story 5.3 server-owned internal economics signal (not exposed on user mobile payloads).
   * Present only after first terminalization (`ready` | `failed`).
   */
  jobCostSignalV1?: JobCostSignalPayloadV1;
  providerKey?: 'replicate';
  providerPredictionId?: string;
  providerStatus?: string;
  sourceVideoUrl?: string;
  sourceImageUrl?: string;
  outputUrl?: string;
  creditsRequired?: number;
  creditsChargedAtMs?: number;
};

function scopedIdempotencyKey(userId: string, clientKey: string): string {
  return `${userId}${IDEMPOTENCY_SCOPING_SEP}${clientKey}`;
}

function normalizeQualityTierInput(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return DEFAULT_QUALITY_TIER;
  }
  const n = Math.floor(input);
  if (n < 1) return 1;
  if (n > 99) return 99;
  return n;
}

function computeRequiredCredits(params: {
  videoDurationSec: number | null;
  videoCreditPerSecond: number;
}): number {
  const duration = params.videoDurationSec;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.ceil(duration * params.videoCreditPerSecond);
}

@Injectable()
export class JobsService {
  private store: PersistedJobsStore;
  private storeLoadPromise: Promise<void> | null = null;
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
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly jobLifecyclePush: JobLifecyclePushService,
    private readonly disclosure: SyntheticMediaDisclosureStore,
    private readonly abuse: AbuseService,
    private readonly jobPolicy: JobPolicyScreeningService,
    private readonly replicateProvider: ReplicateGenerationProvider,
    private readonly mediaAssets: JobMediaAssetsService,
    private readonly userCredits: UserCreditsStore,
  ) {
    this.store = { version: 3, idempotency: {}, jobs: {} };
    this.logProviderConfiguration();
  }

  private logProviderConfiguration(): void {
    console.info('telemetry.jobs.provider.config.v1', {
      provider: 'replicate',
      enabled: this.replicateProvider.isEnabled(),
      model: this.replicateProvider.getConfiguredModel() || null,
      strictMode: !this.allowMockJobFlow(),
    });
  }

  private allowMockJobFlow(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.BANYONE_IS_TESTING_ENV === 'true' ||
      process.env.BANYONE_ALLOW_STUB_JOBS === 'true'
    );
  }

  private async ensureStoreLoaded(): Promise<void> {
    if (this.storeLoadPromise) return this.storeLoadPromise;
    this.storeLoadPromise = (async () => {
      const snapshot = await this.firestore.collection('jobs_store').doc('state').get();
      if (!snapshot.exists) return;
      this.store = this.normalizePersistedJobsStore(snapshot.data());
    })();
    await this.storeLoadPromise;
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
          qualityTier: DEFAULT_QUALITY_TIER,
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
          ...(typeof j.failure === 'object' && j.failure !== null
            ? (() => {
                const failure = j.failure as Record<string, unknown>;
                if (
                  typeof failure.retryable !== 'boolean' ||
                  typeof failure.reasonCode !== 'string' ||
                  typeof failure.nextAction !== 'string' ||
                  typeof failure.message !== 'string'
                ) {
                  return {};
                }
                return {
                  failure: {
                    retryable: failure.retryable,
                    reasonCode: failure.reasonCode,
                    nextAction: failure.nextAction,
                    message: failure.message,
                    ...(typeof failure.traceId === 'string'
                      ? { traceId: failure.traceId }
                      : {}),
                  },
                };
              })()
            : {}),
          ...(typeof j.traceId === 'string' ? { traceId: j.traceId } : {}),
          ...(typeof j.qualityTier === 'number'
            ? { qualityTier: normalizeQualityTierInput(j.qualityTier) }
            : {}),
          ...(isPersistedJobCostSignalV1(j.jobCostSignalV1)
            ? { jobCostSignalV1: j.jobCostSignalV1 }
            : {}),
          ...(j.providerKey === 'replicate' ? { providerKey: 'replicate' } : {}),
          ...(typeof j.providerPredictionId === 'string'
            ? { providerPredictionId: j.providerPredictionId }
            : {}),
          ...(typeof j.providerStatus === 'string'
            ? { providerStatus: j.providerStatus }
            : {}),
          ...(typeof j.sourceVideoUrl === 'string'
            ? { sourceVideoUrl: j.sourceVideoUrl }
            : {}),
          ...(typeof j.sourceImageUrl === 'string'
            ? { sourceImageUrl: j.sourceImageUrl }
            : {}),
          ...(typeof j.outputUrl === 'string' ? { outputUrl: j.outputUrl } : {}),
          ...(typeof j.creditsRequired === 'number' &&
          Number.isFinite(j.creditsRequired) &&
          j.creditsRequired > 0
            ? { creditsRequired: Math.ceil(j.creditsRequired) }
            : {}),
          ...(typeof j.creditsChargedAtMs === 'number' &&
          Number.isFinite(j.creditsChargedAtMs) &&
          j.creditsChargedAtMs > 0
            ? { creditsChargedAtMs: Math.floor(j.creditsChargedAtMs) }
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

  private async saveStore(): Promise<void> {
    await this.firestore.collection('jobs_store').doc('state').set(this.store);
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
    await this.ensureStoreLoaded();
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

  async getGenerationCredits(params: {
    userId: string;
  }): Promise<GenerationJobCreditsEnvelope> {
    const [balance, videoCreditPerSecond] = await Promise.all([
      this.userCredits.getBalance(params.userId),
      Promise.resolve(this.userCredits.getVideoCreditPerSecond()),
    ]);
    return {
      data: {
        balance,
        videoCreditPerSecond,
      },
      error: null,
    };
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

    const detailsUnknown = envelope.error.details;
    const policyDetails = isJobPolicyViolationDetails(detailsUnknown)
      ? detailsUnknown
      : undefined;
    const validationDetails = envelope.error.details as
      | GenerationJobValidationErrorDetails
      | undefined;
    const rejectionCodes =
      policyDetails !== undefined
        ? [policyDetails.policyCode]
        : (validationDetails?.violations?.map((v) => v.code) ?? []);
    const normalizedRejectionCodes =
      rejectionCodes.length > 0 ? rejectionCodes : [envelope.error.code];
    const rejectionReason = this.mapRejectedAckReason(
      envelope.error.code,
      envelope.error.message,
    );

    console.info('telemetry.jobs.generation.acknowledged.v1', {
      outcome: 'rejected',
      errorCode: envelope.error.code,
      rejectionCodes: normalizedRejectionCodes,
      reason: rejectionReason,
      serverAckHandlingMs: Date.now() - startedAt,
      traceId: envelope.error.traceId,
    });
  }

  private mapRejectedAckReason(errorCode: string, message: string): string {
    if (errorCode !== 'INPUT_INVALID') {
      return errorCode.toLowerCase();
    }

    if (message.includes('Video must be uploaded first')) {
      return 'video_asset_not_uploaded';
    }
    if (message.includes('Image must be uploaded first')) {
      return 'image_asset_not_uploaded';
    }
    if (message.includes('Uploaded media could not be read')) {
      return 'uploaded_media_unreadable';
    }
    if (message.includes('Input validation failed')) {
      return 'contract_validation_failed';
    }

    return 'input_invalid_unspecified';
  }

  async getGenerationJobStatus(params: {
    userId: string;
    jobId: string;
  }): Promise<GenerationJobStatusEnvelope> {
    await this.ensureStoreLoaded();
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
    if (
      job.providerKey === 'replicate' &&
      job.providerPredictionId &&
      (job.status === 'queued' || job.status === 'processing')
    ) {
      return this.getGenerationJobStatusFromReplicate({ job, nowMs });
    }
    const transition = this.advanceJobLifecycleIfNeeded({ job, nowMs });

    if (transition) {
      console.info('telemetry.jobs.lifecycle.transition.v1', {
        jobId: job.jobId,
        from: transition.from,
        to: transition.to,
        occurredAt: new Date(transition.occurredAtMs).toISOString(),
      });
    }

    if (transition) {
      let terminalStatusForMetrics: 'ready' | 'failed' | null = null;
      if (transition.to === 'ready') {
        const chargeResult = await this.chargeCreditsOnce(job, nowMs);
        if (chargeResult.ok) {
          this.jobLifecyclePush.notifyJobReady(job.userId, job.jobId);
          terminalStatusForMetrics = 'ready';
        } else {
          this.applyCreditChargeFailure({
            job,
            nowMs,
            reasonCode: chargeResult.reasonCode,
            retryable: chargeResult.retryable,
            message: chargeResult.message,
          });
          if (job.failure) {
            this.jobLifecyclePush.notifyJobFailed(job.userId, job.jobId, job.failure);
          }
          terminalStatusForMetrics = 'failed';
        }
      }
      if (transition.to === 'failed' && job.failure) {
        this.jobLifecyclePush.notifyJobFailed(
          job.userId,
          job.jobId,
          job.failure,
        );
        terminalStatusForMetrics = 'failed';
      }

      if (terminalStatusForMetrics !== null) {
        const tier = job.qualityTier ?? DEFAULT_QUALITY_TIER;
        const costSignal = computeJobCostSignalV1({
          jobId: job.jobId,
          qualityTier: tier,
          terminalStatus: terminalStatusForMetrics,
        });
        job.jobCostSignalV1 = costSignal;
        const timeToPreviewMs = computeTimeToPreviewMs({
          queuedAtMs: job.queuedAtMs,
          readyAtMs: job.readyAtMs,
          terminalStatus: terminalStatusForMetrics,
        });
        emitJobLifecycleMetricsV1Log({
          schemaVersion: JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
          jobId: job.jobId,
          terminalStatus: terminalStatusForMetrics,
          qualityTier: tier,
          timeToPreviewMs,
        });
        emitJobCostSignalV1Log(costSignal);
      }

      // Persist any status changes to maintain canonical server truth.
      await this.saveStore();
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

  private async getGenerationJobStatusFromReplicate(params: {
    job: PersistedJobRecord;
    nowMs: number;
  }): Promise<GenerationJobStatusEnvelope> {
    const { job, nowMs } = params;
    const previous = job.status;
    try {
      const polled = await this.replicateProvider.getPrediction(
        job.providerPredictionId as string,
      );
      const mapped = this.mapReplicateStatus(polled.status, polled.outputUrl);
      job.providerStatus = polled.status;
      if (mapped.outputUrl) job.outputUrl = mapped.outputUrl;
      if (mapped.status !== previous) {
        job.status = mapped.status;
        job.updatedAtMs = nowMs;
        if (mapped.status === 'processing') {
          job.processingAtMs = nowMs;
        }
        if (mapped.status === 'ready') {
          job.readyAtMs = nowMs;
          delete job.failure;
          const chargeResult = await this.chargeCreditsOnce(job, nowMs);
          if (chargeResult.ok) {
            this.jobLifecyclePush.notifyJobReady(job.userId, job.jobId);
          } else {
            this.applyCreditChargeFailure({
              job,
              nowMs,
              reasonCode: chargeResult.reasonCode,
              retryable: chargeResult.retryable,
              message: chargeResult.message,
            });
            if (job.failure) {
              this.jobLifecyclePush.notifyJobFailed(job.userId, job.jobId, job.failure);
            }
          }
        }
        if (mapped.status === 'failed') {
          job.failedAtMs = nowMs;
          job.failure = {
            ...this.buildFailureMetadata({
              jobId: job.jobId,
              traceId: this.readPersistedTraceId(job),
            }),
            message:
              polled.errorMessage?.trim() ||
              'Processing failed and cannot be retried.',
          };
          this.jobLifecyclePush.notifyJobFailed(job.userId, job.jobId, job.failure);
        }
        const terminalStatusForMetrics =
          mapped.status === 'ready' && job.status === 'failed'
            ? 'failed'
            : mapped.status;
        if (terminalStatusForMetrics === 'ready' || terminalStatusForMetrics === 'failed') {
          const tier = job.qualityTier ?? DEFAULT_QUALITY_TIER;
          const costSignal = computeJobCostSignalV1({
            jobId: job.jobId,
            qualityTier: tier,
            terminalStatus: terminalStatusForMetrics,
            inferenceProviderKey: 'replicate',
          });
          job.jobCostSignalV1 = costSignal;
          const timeToPreviewMs = computeTimeToPreviewMs({
            queuedAtMs: job.queuedAtMs,
            readyAtMs: job.readyAtMs,
            terminalStatus: terminalStatusForMetrics,
          });
          emitJobLifecycleMetricsV1Log({
            schemaVersion: JOB_LIFECYCLE_METRICS_SCHEMA_VERSION,
            jobId: job.jobId,
            terminalStatus: terminalStatusForMetrics,
            qualityTier: tier,
            timeToPreviewMs,
          });
          emitJobCostSignalV1Log(costSignal);
        }
        await this.saveStore();
      }
    } catch {
      // Keep previous status for polling retries.
    }
    return {
      data: this.mapJobToStatusPayload({ job, nowMs }),
      error: null,
    };
  }

  async getOutputReportEligibility(params: { userId: string; jobId: string }):
    Promise<
      | { ok: true }
      | {
        ok: false;
        code: 'JOB_NOT_FOUND' | 'JOB_NOT_READY';
        message: string;
        retryable: false;
      }
    > {
    await this.ensureStoreLoaded();
    const job = this.store.jobs[params.jobId];
    if (!job || job.userId !== params.userId) {
      return {
        ok: false,
        code: 'JOB_NOT_FOUND',
        message: 'Generation job not found.',
        retryable: false,
      };
    }

    if (job.status !== 'ready') {
      return {
        ok: false,
        code: 'JOB_NOT_READY',
        message: 'Reports are accepted only for ready jobs.',
        retryable: false,
      };
    }

    return { ok: true };
  }

  async listGenerationJobs(params: {
    userId: string;
  }): Promise<GenerationJobHistoryListEnvelope> {
    await this.ensureStoreLoaded();
    const items = Object.values(this.store.jobs)
      .filter((job) => job.userId === params.userId)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      .map((job) => ({
        jobId: job.jobId,
        status: job.status,
        updatedAt: new Date(job.updatedAtMs).toISOString(),
        ...(typeof job.sourceImageUrl === 'string'
          ? { sourceImageUrl: job.sourceImageUrl }
          : {}),
      }));

    return {
      data: { items },
      error: null,
      meta: { total: items.length },
    };
  }

  async getGenerationJobHistoryDetail(params: {
    userId: string;
    jobId: string;
  }): Promise<GenerationJobHistoryDetailEnvelope> {
    await this.ensureStoreLoaded();
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

  async getJobSnapshotForModeration(params: { jobId: string }): Promise<{
    jobId: string;
    userId: string;
    status: GenerationJobStatus;
    updatedAt: string;
    queuedAt?: string;
    processingAt?: string;
    readyAt?: string;
    failedAt?: string;
    failure?: {
      retryable: boolean;
      reasonCode: string;
      nextAction: string;
      message: string;
    };
  } | null> {
    await this.ensureStoreLoaded();
    const snapshot = this.getInternalJobSnapshot(params);
    if (!snapshot) return null;

    return {
      jobId: snapshot.jobId,
      userId: snapshot.userId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      ...(snapshot.queuedAt ? { queuedAt: snapshot.queuedAt } : {}),
      ...(snapshot.processingAt ? { processingAt: snapshot.processingAt } : {}),
      ...(snapshot.readyAt ? { readyAt: snapshot.readyAt } : {}),
      ...(snapshot.failedAt ? { failedAt: snapshot.failedAt } : {}),
      ...(snapshot.failure ? { failure: snapshot.failure } : {}),
    };
  }

  async getJobDiagnosticsSnapshot(params: { jobId: string }): Promise<{
    jobId: string;
    userId: string;
    status: GenerationJobStatus;
    traceId: string;
    updatedAt: string;
    queuedAt?: string;
    processingAt?: string;
    readyAt?: string;
    failedAt?: string;
    failure?: {
      retryable: boolean;
      reasonCode: string;
      nextAction: string;
    };
  } | null> {
    await this.ensureStoreLoaded();
    const snapshot = this.getInternalJobSnapshot(params);
    if (!snapshot) return null;

    return {
      jobId: snapshot.jobId,
      userId: snapshot.userId,
      status: snapshot.status,
      traceId: snapshot.traceId,
      updatedAt: snapshot.updatedAt,
      ...(snapshot.queuedAt ? { queuedAt: snapshot.queuedAt } : {}),
      ...(snapshot.processingAt ? { processingAt: snapshot.processingAt } : {}),
      ...(snapshot.readyAt ? { readyAt: snapshot.readyAt } : {}),
      ...(snapshot.failedAt ? { failedAt: snapshot.failedAt } : {}),
      ...(snapshot.failure
        ? {
            failure: {
              retryable: snapshot.failure.retryable,
              reasonCode: snapshot.failure.reasonCode,
              nextAction: snapshot.failure.nextAction,
            },
          }
        : {}),
    };
  }

  /**
   * Internal analytics snapshot used for aggregate reporting.
   * Includes only fields required by quality-tier comparisons.
   */
  async listJobsForQualityTierComparison(): Promise<Array<{
    jobId: string;
    status: GenerationJobStatus;
    qualityTier?: number;
    queuedAtMs?: number;
    readyAtMs?: number;
    failedAtMs?: number;
    jobCostSignalV1?: JobCostSignalPayloadV1;
  }>> {
    await this.ensureStoreLoaded();
    return Object.values(this.store.jobs).map((job) => ({
      jobId: job.jobId,
      status: job.status,
      ...(typeof job.qualityTier === 'number' ? { qualityTier: job.qualityTier } : {}),
      ...(typeof job.queuedAtMs === 'number' ? { queuedAtMs: job.queuedAtMs } : {}),
      ...(typeof job.readyAtMs === 'number' ? { readyAtMs: job.readyAtMs } : {}),
      ...(typeof job.failedAtMs === 'number' ? { failedAtMs: job.failedAtMs } : {}),
      ...(job.jobCostSignalV1 ? { jobCostSignalV1: job.jobCostSignalV1 } : {}),
    }));
  }

  private getInternalJobSnapshot(params: { jobId: string }): {
    jobId: string;
    userId: string;
    status: GenerationJobStatus;
    traceId: string;
    updatedAt: string;
    queuedAt?: string;
    processingAt?: string;
    readyAt?: string;
    failedAt?: string;
    failure?: {
      retryable: boolean;
      reasonCode: string;
      nextAction: string;
      message: string;
    };
  } | null {
    const job = this.store.jobs[params.jobId];
    if (!job) return null;

    return {
      jobId: job.jobId,
      userId: job.userId,
      status: job.status,
      traceId: this.readPersistedTraceId(job),
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
    };
  }

  async getGenerationJobPreview(params: {
    userId: string;
    jobId: string;
  }): Promise<GenerationJobPreviewEnvelope> {
    await this.ensureStoreLoaded();
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
      if (job.providerKey === 'replicate' && job.outputUrl) {
        return {
          data: {
            jobId: job.jobId,
            status: 'ready',
            updatedAt: new Date(job.updatedAtMs).toISOString(),
            previewUri: job.outputUrl,
            mimeType: 'video/mp4',
          },
          error: null,
        };
      }
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
        previewUri:
          job.outputUrl ?? `https://cdn.banyone.local/generated/${job.jobId}.mp4`,
        mimeType: 'video/mp4',
      },
      error: null,
    };
  }

  async createGenerationJobExport(params: {
    userId: string;
    jobId: string;
  }): Promise<GenerationJobExportEnvelope> {
    await this.ensureStoreLoaded();
    const abuseRestriction = await this.abuse.checkRestriction({
      userId: params.userId,
      action: 'generation_job_export',
    });
    if (abuseRestriction.blocked) {
      return this.makeErrorEnvelope({
        code: ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
        message: 'This account is currently restricted from this action.',
        retryable: abuseRestriction.details.expiresAt !== undefined,
        details: abuseRestriction.details,
      });
    }

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
      if (job.providerKey === 'replicate' && job.outputUrl) {
        return {
          data: {
            jobId: job.jobId,
            status: 'ready',
            updatedAt: new Date(job.updatedAtMs).toISOString(),
            exportUri: job.outputUrl,
            mimeType: 'video/mp4',
          },
          error: null,
        };
      }
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
        exportUri: job.outputUrl ?? `file:///tmp/banyone/${job.jobId}.mp4`,
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
    traceId?: string;
    qualityTier?: number;
    updatedAtMs?: number;
    queuedAtMs?: number;
    processingAtMs?: number;
    readyAtMs?: number;
    failedAtMs?: number;
    sourceImageUrl?: string;
    creditsRequired?: number;
    creditsChargedAtMs?: number;
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
      ...(params.traceId ? { traceId: params.traceId } : {}),
      ...(params.qualityTier !== undefined
        ? { qualityTier: normalizeQualityTierInput(params.qualityTier) }
        : {}),
      updatedAtMs,
      queuedAtMs,
      processingAtMs,
      readyAtMs,
      failedAtMs,
      ...(typeof params.sourceImageUrl === 'string'
        ? { sourceImageUrl: params.sourceImageUrl }
        : {}),
      ...(typeof params.creditsRequired === 'number' &&
      Number.isFinite(params.creditsRequired) &&
      params.creditsRequired > 0
        ? { creditsRequired: Math.ceil(params.creditsRequired) }
        : {}),
      ...(typeof params.creditsChargedAtMs === 'number' &&
      Number.isFinite(params.creditsChargedAtMs) &&
      params.creditsChargedAtMs > 0
        ? { creditsChargedAtMs: Math.floor(params.creditsChargedAtMs) }
        : {}),
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
          job.failure = this.buildFailureMetadata({
            jobId: job.jobId,
            traceId: this.readPersistedTraceId(job),
          });
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

    const tier = job.qualityTier ?? DEFAULT_QUALITY_TIER;

    const payload: GenerationJobStatusPayload = {
      jobId: job.jobId,
      status: job.status,
      updatedAt,
      qualityTier: tier,
    };

    if (job.status === 'ready') {
      const ttp = computeTimeToPreviewMs({
        queuedAtMs: job.queuedAtMs,
        readyAtMs: job.readyAtMs,
        terminalStatus: 'ready',
      });
      if (typeof ttp === 'number') {
        payload.timeToPreviewMs = ttp;
      }
    }

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
    // Local testing mode should avoid flaky failure branches so UI flows stay stable.
    if (this.allowMockJobFlow()) return false;
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
    if (this.allowMockJobFlow()) return false;
    return this.readDeterministicHexDigit(jobId) % 5 === 1;
  }

  private shouldExportFail(jobId: string): boolean {
    if (this.allowMockJobFlow()) return false;
    return this.readDeterministicHexDigit(jobId) % 5 === 2;
  }

  private mapReplicateStatus(
    status: string,
    outputUrl?: string,
  ): { status: GenerationJobStatus; outputUrl?: string } {
    if (status === 'succeeded') return { status: 'ready', outputUrl };
    if (status === 'failed' || status === 'canceled') return { status: 'failed' };
    if (status === 'starting' || status === 'processing') {
      return { status: 'processing' };
    }
    return { status: 'queued' };
  }

  private readPersistedTraceId(job: PersistedJobRecord): string {
    const directTraceId =
      typeof job.traceId === 'string' && job.traceId.length > 0
        ? job.traceId
        : undefined;
    if (directTraceId) return directTraceId;

    const failureTraceId =
      typeof job.failure?.traceId === 'string' && job.failure.traceId.length > 0
        ? job.failure.traceId
        : undefined;
    if (failureTraceId) return failureTraceId;

    return `legacy-trace:${job.jobId}`;
  }

  private async chargeCreditsOnce(
    job: PersistedJobRecord,
    nowMs: number,
  ): Promise<CreditChargeResult> {
    const required = Math.max(0, Math.ceil(job.creditsRequired ?? 0));
    if (required <= 0 || typeof job.creditsChargedAtMs === 'number') {
      return { ok: true };
    }
    try {
      await this.userCredits.debit(job.userId, required);
      job.creditsChargedAtMs = nowMs;
      return { ok: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown';
      console.error('telemetry.jobs.credits.debit_failed.v1', {
        jobId: job.jobId,
        userId: job.userId,
        required,
        message: errorMessage,
      });
      if (errorMessage === 'INSUFFICIENT_CREDIT_BALANCE') {
        return {
          ok: false,
          reasonCode: 'INSUFFICIENT_CREDIT_BALANCE',
          retryable: false,
          message:
            'Generation completed but credit balance was insufficient during final charge.',
        };
      }
      return {
        ok: false,
        reasonCode: 'CREDIT_DEBIT_FAILED',
        retryable: true,
        message: 'Generation completed but charging credits failed. Please retry.',
      };
    }
  }

  private applyCreditChargeFailure(params: {
    job: PersistedJobRecord;
    nowMs: number;
    reasonCode: 'INSUFFICIENT_CREDIT_BALANCE' | 'CREDIT_DEBIT_FAILED';
    retryable: boolean;
    message: string;
  }): void {
    const { job, nowMs, reasonCode, retryable, message } = params;
    job.status = 'failed';
    job.failedAtMs = nowMs;
    job.updatedAtMs = nowMs;
    delete job.readyAtMs;
    job.failure = {
      retryable,
      reasonCode,
      nextAction: retryable ? 'retry' : 'add_credits',
      message,
      traceId: this.readPersistedTraceId(job),
    };
  }

  private readDeterministicHexDigit(value: string): number {
    const lastChar = (value ?? '').trim().slice(-1).toLowerCase();
    if (/^[0-9a-f]$/.test(lastChar)) return parseInt(lastChar, 16);
    return value.length % 16;
  }

  private buildFailureMetadata(params: { jobId: string; traceId?: string }): {
    retryable: boolean;
    reasonCode: string;
    nextAction: string;
    message: string;
    traceId?: string;
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
          ...(params.traceId ? { traceId: params.traceId } : {}),
        }
      : {
          retryable: false,
          reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
          nextAction: 'contact_support',
          message: 'Processing failed and cannot be retried.',
          ...(params.traceId ? { traceId: params.traceId } : {}),
        };
  }

  private async handleCreateForKey(params: {
    userId: string;
    key: string;
    body: CreateGenerationJobRequestBody;
  }): Promise<GenerationJobEnvelope> {
    if (!(await this.disclosure.isAcceptedForUser(params.userId))) {
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

    const automatedRestriction = await this.abuse.evaluateAutomatedThreshold({
      userId: params.userId,
    });
    if (automatedRestriction) {
      return this.makeErrorEnvelope({
        code: ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
        message: 'This account is currently restricted from this action.',
        retryable: automatedRestriction.expiresAt !== undefined,
        details: {
          restrictionId: automatedRestriction.restrictionId,
          subjectType: automatedRestriction.subjectType,
          subjectId: automatedRestriction.subjectId,
          reason: automatedRestriction.reason,
          source: automatedRestriction.source,
          ...(automatedRestriction.expiresAt
            ? { expiresAt: automatedRestriction.expiresAt }
            : {}),
        },
      });
    }

    const abuseRestriction = await this.abuse.checkRestriction({
      userId: params.userId,
      action: 'generation_job_create',
    });
    if (abuseRestriction.blocked) {
      return this.makeErrorEnvelope({
        code: ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
        message: 'This account is currently restricted from this action.',
        retryable: abuseRestriction.details.expiresAt !== undefined,
        details: abuseRestriction.details,
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

    const policyResult = this.jobPolicy.evaluate({
      userId: params.userId,
      body: params.body,
    });
    if (policyResult.decision === 'block') {
      const envelope = this.makeErrorEnvelope({
        code: POLICY_VIOLATION_ERROR_CODE,
        message: policyResult.message,
        retryable: false,
        details: { policyCode: policyResult.policyCode },
      });
      if (envelope.error !== null) {
        console.info('telemetry.jobs.policy.rejected.v1', {
          traceId: envelope.error.traceId,
          policyCode: policyResult.policyCode,
          userId: params.userId,
        });
      }
      return envelope;
    }

    const videoCreditPerSecond = this.userCredits.getVideoCreditPerSecond();
    const creditsRequired = computeRequiredCredits({
      videoDurationSec: params.body.video.durationSec,
      videoCreditPerSecond,
    });
    const creditStatus = await this.userCredits.hasEnough(
      params.userId,
      creditsRequired,
    );
    if (!creditStatus.ok) {
      return this.makeErrorEnvelope({
        code: INSUFFICIENT_CREDIT_ERROR_CODE,
        message: 'Not enough credits to generate this video.',
        retryable: false,
        details: {
          balance: creditStatus.balance,
          required: creditsRequired,
          shortfall: Math.max(0, creditsRequired - creditStatus.balance),
          videoCreditPerSecond,
        },
      });
    }

    const jobId = randomUUID();
    const nowMs = Date.now();
    const traceId = randomUUID();
    const qualityTier = normalizeQualityTierInput(params.body.qualityTier);
    let status: GenerationJobStatus = 'queued';
    let providerPredictionId: string | undefined;
    let providerStatus: string | undefined;
    let outputUrl: string | undefined;
    const allowMockFlow = this.allowMockJobFlow();
    const usingReplicate = this.replicateProvider.isEnabled();
    if (!usingReplicate && !allowMockFlow) {
      return this.makeErrorEnvelope({
        code: 'PROVIDER_NOT_CONFIGURED',
        message:
          'Replicate provider is not configured. Set REPLICATE_API_TOKEN and REPLICATE_MODEL.',
        retryable: false,
      });
    }
    if (usingReplicate && !allowMockFlow) {
      if (!this.mediaAssets.isManagedAssetUrl(params.body.video.uri)) {
        return this.makeErrorEnvelope({
          code: 'INPUT_INVALID',
          message:
            'Video must be uploaded first (POST /v1/generation-jobs/assets); use the returned asset URL.',
          retryable: false,
        });
      }
      if (!this.mediaAssets.isManagedAssetUrl(params.body.image.uri)) {
        return this.makeErrorEnvelope({
          code: 'INPUT_INVALID',
          message:
            'Image must be uploaded first (POST /v1/generation-jobs/assets); use the returned asset URL.',
          retryable: false,
        });
      }
      let videoBuffer: Buffer;
      let imageBuffer: Buffer;
      try {
        videoBuffer = await this.mediaAssets.readUploadedAssetBuffer(
          params.body.video.uri,
        );
        imageBuffer = await this.mediaAssets.readUploadedAssetBuffer(
          params.body.image.uri,
        );
      } catch {
        return this.makeErrorEnvelope({
          code: 'INPUT_INVALID',
          message: 'Uploaded media could not be read. Re-upload and try again.',
          retryable: false,
        });
      }
      try {
        const prediction = await this.replicateProvider.createPrediction({
          video: videoBuffer,
          characterImage: imageBuffer,
          prompt: params.body.prompt,
        });
        providerPredictionId = prediction.predictionId;
        providerStatus = prediction.status;
        const mapped = this.mapReplicateStatus(prediction.status);
        status = mapped.status;
        outputUrl = mapped.outputUrl;
      } catch (error) {
        await this.mediaAssets.deleteByUrl(params.body.video.uri ?? undefined);
        await this.mediaAssets.deleteByUrl(params.body.image.uri ?? undefined);
        return this.makeErrorEnvelope({
          code: 'PROVIDER_SUBMIT_FAILED',
          message: 'Unable to submit generation request to provider.',
          retryable: true,
          details:
            error instanceof Error
              ? { provider: 'replicate', reason: error.message }
              : { provider: 'replicate' },
        });
      }
    }

    this.store.jobs[jobId] = {
      jobId,
      userId: params.userId,
      status,
      traceId,
      qualityTier,
      updatedAtMs: nowMs,
      queuedAtMs: nowMs,
      ...(usingReplicate && !allowMockFlow
        ? { providerKey: 'replicate' as const }
        : {}),
      ...(providerPredictionId ? { providerPredictionId } : {}),
      ...(providerStatus ? { providerStatus } : {}),
      ...(params.body.video.uri ? { sourceVideoUrl: params.body.video.uri } : {}),
      ...(params.body.image.uri ? { sourceImageUrl: params.body.image.uri } : {}),
      ...(outputUrl ? { outputUrl } : {}),
      ...(creditsRequired > 0 ? { creditsRequired } : {}),
      ...(status === 'processing' ? { processingAtMs: nowMs } : {}),
      ...(status === 'ready' ? { readyAtMs: nowMs } : {}),
      ...(status === 'failed'
        ? {
            failedAtMs: nowMs,
            failure: this.buildFailureMetadata({
              jobId,
              traceId,
            }),
          }
        : {}),
    };
    this.store.idempotency[params.key] = { jobId, status };
      await this.saveStore();

    if (!usingReplicate || allowMockFlow) this.enqueuePlaceholderProcessing();
    this.jobLifecyclePush.notifyJobQueued(params.userId, jobId);
    return this.makeSuccessEnvelope({ jobId, status });
  }
}

function isPersistedJobCostSignalV1(
  input: unknown,
): input is JobCostSignalPayloadV1 {
  if (typeof input !== 'object' || input === null) return false;
  const row = input as Record<string, unknown>;
  if (row.schemaVersion !== 1) return false;
  if (typeof row.jobId !== 'string' || row.jobId.length === 0) return false;
  if (
    row.terminalStatus !== 'ready' &&
    row.terminalStatus !== 'failed'
  ) {
    return false;
  }
  if (typeof row.qualityTier !== 'number') return false;
  if (typeof row.costModelVersion !== 'string') return false;
  if (
    typeof row.inferenceProviderKey !== 'undefined' &&
    typeof row.inferenceProviderKey !== 'string'
  ) {
    return false;
  }
  if (typeof row.estimatedCost !== 'object' || row.estimatedCost === null) {
    return false;
  }
  const estimatedCost = row.estimatedCost as Record<string, unknown>;
  if (typeof estimatedCost.amount !== 'number') return false;
  if (estimatedCost.currencyCode !== 'USD') return false;
  return true;
}
