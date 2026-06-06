import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES,
  SUPPORT_DIAGNOSTICS_INVALID_QUERY_ERROR_CODE,
  SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND_ERROR_CODE,
  SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY_ERROR_CODE,
  type QualityTierComparisonEnvelope,
  type RecoveryPlaybook,
  type SupportEscalationEnvelope,
  type SupportEscalationListEnvelope,
  type SupportEscalationStatus,
  type SupportDiagnosticsFailureCategory,
  type SupportRecoveryPlaybooksEnvelope,
  type SupportJobDiagnosticsEnvelope,
  isSupportDiagnosticsFailureCategory,
} from '@banyone/contracts';

import { BillingService } from '../billing/billing.service';
import { JobsService } from '../jobs/jobs.service';
import {
  aggregateQualityTierOutcomes,
  emitQualityTierComparisonLog,
} from '../../telemetry/quality-tier-comparison';
import { SupportEscalationStore } from './support-escalation.store';

export function mapFailureCategoryFromReasonCode(
  reasonCode: string | undefined,
): SupportDiagnosticsFailureCategory {
  if (!reasonCode) return 'unknown';

  if (reasonCode === 'INPUT_INVALID') return 'validation';
  if (reasonCode === 'POLICY_VIOLATION') return 'policy';
  if (reasonCode === 'PROCESSING_FAILED_RETRYABLE')
    return 'processing-retryable';
  if (reasonCode === 'PROCESSING_FAILED_NON_RETRYABLE') {
    return 'processing-non-retryable';
  }
  if (reasonCode === 'ABUSE_RESTRICTION_ACTIVE') return 'abuse-restriction';
  return 'unknown';
}

type RecoveryPlaybookResolution = {
  playbook: RecoveryPlaybook;
  usedFallback: boolean;
};

type SupportErrorEnvelope<TCode extends string = string> = {
  data: null;
  error: {
    code: TCode;
    message: string;
    retryable: boolean;
    traceId: string;
  };
};

export type SupportBillingDiagnosticsEnvelope =
  | {
      data: {
        userId: string;
        subscriptionState: 'active' | 'inactive' | 'unknown';
        activeProductId: string | null;
        grantHistory: Array<{
          eventId: string;
          eventType: string;
          productId: string | null;
          grantedCredits: number;
          processedAt: string;
        }>;
      };
      error: null;
    }
  | SupportErrorEnvelope;

const SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE =
  'SUPPORT_ESCALATION_INVALID_BODY' as const;
const SUPPORT_ESCALATION_NOT_FOUND_ERROR_CODE =
  'SUPPORT_ESCALATION_NOT_FOUND' as const;
const SUPPORT_ESCALATION_JOB_NOT_FOUND_ERROR_CODE =
  'SUPPORT_ESCALATION_JOB_NOT_FOUND' as const;
const MIN_SUPPORT_ESCALATION_IMPACT_SUMMARY_LENGTH = 20;
const SUPPORT_ESCALATION_STATUSES: ReadonlySet<string> = new Set([
  'open',
  'in_progress',
  'resolved',
  'cancelled',
]);

const BASE_RECOVERY_PLAYBOOKS: Record<
  SupportDiagnosticsFailureCategory,
  RecoveryPlaybook
> = {
  validation: {
    id: 'validation-default',
    failureCategory: 'validation',
    title: 'Fix invalid input and submit again',
    summary: 'Your upload did not pass input checks.',
    explanation:
      'One or more files did not match required format, duration, or dimensions.',
    retryGuidance: 'retry',
    nextSteps: [
      'Review the validation error details and correct the flagged media.',
      'Confirm file format, dimensions, and duration meet requirements.',
      'Submit a new job after fixing the input issues.',
    ],
  },
  policy: {
    id: 'policy-default',
    failureCategory: 'policy',
    title: 'Content violates policy and cannot be processed',
    summary: 'This request is blocked by platform policy checks.',
    explanation:
      'The request matched a policy rule and cannot proceed in its current form.',
    retryGuidance: 'do-not-retry',
    nextSteps: [
      'Do not retry the same content unchanged.',
      'Remove or replace policy-violating media and submit a new job.',
      'Contact support if the user believes the policy block is incorrect.',
    ],
  },
  'processing-retryable': {
    id: 'processing-retryable-default',
    failureCategory: 'processing-retryable',
    title: 'Temporary processing failure',
    summary: 'The job failed due to a temporary processing issue.',
    explanation:
      'This failure is considered transient and can often succeed on a new attempt.',
    retryGuidance: 'retry',
    nextSteps: [
      'Retry the generation request.',
      'If repeated attempts fail, wait briefly and retry again.',
      'Escalate with trace ID if failures persist.',
    ],
  },
  'processing-non-retryable': {
    id: 'processing-non-retryable-default',
    failureCategory: 'processing-non-retryable',
    title: 'Processing failed and needs support intervention',
    summary: 'Retrying the same request is unlikely to succeed.',
    explanation:
      'This failure is not marked as transient. The request needs investigation or adjustment.',
    retryGuidance: 'do-not-retry',
    nextSteps: [
      'Do not retry the same request repeatedly.',
      'Collect job ID and trace ID for support follow-up.',
      'Escalate to support for deeper diagnostics.',
    ],
  },
  'abuse-restriction': {
    id: 'abuse-restriction-default',
    failureCategory: 'abuse-restriction',
    title: 'Account or device is currently restricted',
    summary: 'Generation is blocked by an active abuse restriction.',
    explanation:
      'An abuse safeguard has temporarily restricted this subject from creating jobs.',
    retryGuidance: 'do-not-retry',
    nextSteps: [
      'Do not retry while the restriction is active.',
      'Review moderation history and restriction reason.',
      'Escalate to moderation/support for review when needed.',
    ],
  },
  unknown: {
    id: 'unknown-fallback',
    failureCategory: 'unknown',
    title: 'Unknown failure category, escalate with diagnostics',
    summary: 'The system could not map this failure to a standard category.',
    explanation:
      'A generic fallback playbook is being used because failure classification was unknown.',
    retryGuidance: 'conditional',
    nextSteps: [
      'If the failure looks transient, try one retry.',
      'Capture job ID and trace ID.',
      'Escalate to support for manual investigation.',
    ],
  },
};

const REASON_CODE_PLAYBOOK_OVERRIDES: Partial<
  Record<SupportDiagnosticsFailureCategory, Record<string, RecoveryPlaybook>>
> = {
  validation: {
    INPUT_INVALID: {
      id: 'validation-input-invalid',
      failureCategory: 'validation',
      reasonCode: 'INPUT_INVALID',
      title: 'Input did not meet validation constraints',
      summary: 'Uploaded media failed one or more input checks.',
      explanation:
        'At least one field is outside accepted limits (format, size, duration, or dimensions).',
      retryGuidance: 'retry',
      nextSteps: [
        'Fix the exact violations shown in the validation details.',
        'Keep only supported file types and sizes.',
        'Retry submission after corrections.',
      ],
    },
  },
  policy: {
    POLICY_VIOLATION: {
      id: 'policy-violation',
      failureCategory: 'policy',
      reasonCode: 'POLICY_VIOLATION',
      title: 'Policy violation detected',
      summary: 'The request violates policy and cannot run as-is.',
      explanation:
        'Policy checks blocked the request to protect platform safety and compliance.',
      retryGuidance: 'do-not-retry',
      nextSteps: [
        'Do not retry the exact same request.',
        'Revise content to comply with policy requirements.',
        'Escalate if the user disputes the classification.',
      ],
    },
  },
  'processing-retryable': {
    PROCESSING_FAILED_RETRYABLE: {
      id: 'processing-retryable-known',
      failureCategory: 'processing-retryable',
      reasonCode: 'PROCESSING_FAILED_RETRYABLE',
      title: 'Retryable processing failure',
      summary: 'A temporary backend issue interrupted job processing.',
      explanation:
        'This known processing condition is marked retryable by the backend.',
      retryGuidance: 'retry',
      nextSteps: [
        'Retry the job now.',
        'If it fails repeatedly, wait a short interval and retry.',
        'Escalate with trace ID if still failing.',
      ],
    },
  },
  'processing-non-retryable': {
    PROCESSING_FAILED_NON_RETRYABLE: {
      id: 'processing-non-retryable-known',
      failureCategory: 'processing-non-retryable',
      reasonCode: 'PROCESSING_FAILED_NON_RETRYABLE',
      title: 'Non-retryable processing failure',
      summary: 'The backend marked this failure as non-retryable.',
      explanation:
        'The same request is unlikely to succeed without investigation or changes.',
      retryGuidance: 'do-not-retry',
      nextSteps: [
        'Avoid repeated retries.',
        'Gather job and trace information.',
        'Escalate for support diagnostics and guidance.',
      ],
    },
  },
  'abuse-restriction': {
    ABUSE_RESTRICTION_ACTIVE: {
      id: 'abuse-restriction-active',
      failureCategory: 'abuse-restriction',
      reasonCode: 'ABUSE_RESTRICTION_ACTIVE',
      title: 'Active abuse restriction',
      summary: 'Generation is blocked by an active abuse control.',
      explanation:
        'The subject currently has an active restriction that blocks generation actions.',
      retryGuidance: 'do-not-retry',
      nextSteps: [
        'Do not retry until restriction state changes.',
        'Review reason and moderation history.',
        'Escalate to moderation/support for possible resolution.',
      ],
    },
  },
};

@Injectable()
export class SupportService {
  constructor(
    private readonly jobsService: JobsService,
    private readonly billingService: BillingService,
    private readonly supportEscalations: SupportEscalationStore,
  ) {}

  async getJobDiagnostics(query: unknown): Promise<SupportJobDiagnosticsEnvelope> {
    const parsed = this.parseQuery(query);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_DIAGNOSTICS_INVALID_QUERY_ERROR_CODE,
        message: 'jobId query parameter is required.',
        retryable: false,
      });
    }

    const snapshot = await this.jobsService.getJobDiagnosticsSnapshot({
      jobId: parsed.jobId,
    });
    if (!snapshot) {
      return this.makeErrorEnvelope({
        code: SUPPORT_DIAGNOSTICS_JOB_NOT_FOUND_ERROR_CODE,
        message: 'Generation job diagnostics not found.',
        retryable: false,
      });
    }

    const category = mapFailureCategoryFromReasonCode(
      snapshot.failure?.reasonCode,
    );
    return {
      data: {
        jobId: snapshot.jobId,
        status: snapshot.status,
        ownerUserId: snapshot.userId,
        updatedAt: snapshot.updatedAt,
        traceId: snapshot.traceId,
        failureCategory: category,
        ...(snapshot.queuedAt ? { queuedAt: snapshot.queuedAt } : {}),
        ...(snapshot.processingAt
          ? { processingAt: snapshot.processingAt }
          : {}),
        ...(snapshot.readyAt ? { readyAt: snapshot.readyAt } : {}),
        ...(snapshot.failedAt ? { failedAt: snapshot.failedAt } : {}),
        ...(snapshot.failure ? { failure: snapshot.failure } : {}),
      },
      error: null,
    };
  }

  async getBillingDiagnostics(
    query: unknown,
  ): Promise<SupportBillingDiagnosticsEnvelope> {
    const parsed = this.parseBillingDiagnosticsQuery(query);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_DIAGNOSTICS_INVALID_QUERY_ERROR_CODE,
        message:
          'userId query parameter is required and limit must be a positive integer when provided.',
        retryable: false,
      });
    }

    const payload = await this.billingService.getSupportBillingDiagnostics(
      parsed.userId,
      parsed.limit,
    );

    return {
      data: payload,
      error: null,
    };
  }

  getRecoveryPlaybooks(query: unknown): SupportRecoveryPlaybooksEnvelope {
    const parsed = this.parseRecoveryPlaybooksQuery(query);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_RECOVERY_PLAYBOOK_INVALID_QUERY_ERROR_CODE,
        message:
          'failureCategory must be a known support diagnostics category when provided.',
        retryable: false,
      });
    }

    if (parsed.failureCategory) {
      const resolution = this.resolveRecoveryPlaybook(
        parsed.failureCategory,
        parsed.reasonCode,
      );
      return {
        data: {
          items: [resolution.playbook],
          requestedCategory: parsed.failureCategory,
          ...(parsed.reasonCode
            ? { requestedReasonCode: parsed.reasonCode }
            : {}),
          usedFallback: resolution.usedFallback,
        },
        error: null,
      };
    }

    return {
      data: {
        items: SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES.map(
          (category) => BASE_RECOVERY_PLAYBOOKS[category],
        ),
        requestedCategory: 'all',
        usedFallback: false,
      },
      error: null,
    };
  }

  async getQualityTierComparison(): Promise<QualityTierComparisonEnvelope> {
    const payload = aggregateQualityTierOutcomes(
      await this.jobsService.listJobsForQualityTierComparison(),
    );
    emitQualityTierComparisonLog(payload);
    return {
      data: payload,
      error: null,
    };
  }

  async createEscalation(params: {
    actorUserId: string;
    body: unknown;
  }): Promise<SupportEscalationEnvelope> {
    const parsed = this.parseCreateEscalationBody(params.body);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE,
        message:
          'Invalid escalation payload. jobId and userImpactSummary are required.',
        retryable: false,
      });
    }

    const diagnosticsEnvelope = await this.getJobDiagnostics({ jobId: parsed.jobId });
    if (diagnosticsEnvelope.error !== null) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_JOB_NOT_FOUND_ERROR_CODE,
        message:
          'Cannot create escalation because job diagnostics were not found.',
        retryable: false,
      });
    }

    const createdAt = new Date().toISOString();
    const escalation = await this.supportEscalations.create({
      escalationId: randomUUID(),
      jobId: parsed.jobId,
      createdAt,
      traceId: randomUUID(),
      actorUserId: params.actorUserId,
      userImpactSummary: parsed.userImpactSummary,
      ...(parsed.notes ? { notes: parsed.notes } : {}),
      diagnosticsSnapshot: {
        ...diagnosticsEnvelope.data,
        ...(parsed.recoveryPlaybookId
          ? { recoveryPlaybookId: parsed.recoveryPlaybookId }
          : {}),
      },
      status: 'open',
      statusUpdatedAt: createdAt,
    });

    return {
      data: escalation,
      error: null,
    };
  }

  async getEscalationById(
    escalationId: string,
  ): Promise<SupportEscalationEnvelope> {
    const id = escalationId.trim();
    if (!id) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE,
        message: 'escalationId is required.',
        retryable: false,
      });
    }

    const escalation = await this.supportEscalations.getById(id);
    if (!escalation) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_NOT_FOUND_ERROR_CODE,
        message: 'Escalation not found.',
        retryable: false,
      });
    }

    return {
      data: escalation,
      error: null,
    };
  }

  async listEscalations(query: unknown): Promise<SupportEscalationListEnvelope> {
    const parsed = this.parseEscalationListQuery(query);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE,
        message:
          'Invalid escalation query. status must be a known value and limit must be a positive integer when provided.',
        retryable: false,
      });
    }

    const items = await this.supportEscalations.list(parsed);
    return {
      data: {
        items,
        total: items.length,
      },
      error: null,
    };
  }

  async updateEscalationStatus(params: {
    escalationId: string;
    body: unknown;
  }): Promise<SupportEscalationEnvelope> {
    const escalationId = params.escalationId.trim();
    if (!escalationId) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE,
        message: 'escalationId is required.',
        retryable: false,
      });
    }

    const parsed = this.parseEscalationPatchBody(params.body);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_INVALID_BODY_ERROR_CODE,
        message:
          'Invalid escalation status payload. status is required and resolutionNotes may be up to 1000 characters.',
        retryable: false,
      });
    }

    const updated = await this.supportEscalations.updateStatus({
      escalationId,
      status: parsed.status,
      statusUpdatedAt: new Date().toISOString(),
      ...(parsed.resolutionNotes
        ? { resolutionNotes: parsed.resolutionNotes }
        : {}),
    });
    if (!updated) {
      return this.makeErrorEnvelope({
        code: SUPPORT_ESCALATION_NOT_FOUND_ERROR_CODE,
        message: 'Escalation not found.',
        retryable: false,
      });
    }

    return {
      data: updated,
      error: null,
    };
  }

  private parseQuery(query: unknown): { jobId: string } | null {
    if (typeof query !== 'object' || query === null) return null;
    const rawJobId = (query as { jobId?: unknown }).jobId;
    if (typeof rawJobId !== 'string') return null;

    const jobId = rawJobId.trim();
    if (!jobId) return null;
    return { jobId };
  }

  private parseCreateEscalationBody(body: unknown): {
    jobId: string;
    userImpactSummary: string;
    notes?: string;
    recoveryPlaybookId?: string;
  } | null {
    if (typeof body !== 'object' || body === null) return null;
    const b = body as Record<string, unknown>;
    if (
      typeof b.jobId !== 'string' ||
      typeof b.userImpactSummary !== 'string' ||
      (b.notes !== undefined && typeof b.notes !== 'string') ||
      (b.recoveryPlaybookId !== undefined &&
        typeof b.recoveryPlaybookId !== 'string')
    ) {
      return null;
    }

    const jobId = b.jobId.trim();
    const userImpactSummary = b.userImpactSummary.trim();
    const notes =
      typeof b.notes === 'string' && b.notes.trim().length > 0
        ? b.notes.trim()
        : undefined;
    const recoveryPlaybookId =
      typeof b.recoveryPlaybookId === 'string' &&
      b.recoveryPlaybookId.trim().length > 0
        ? b.recoveryPlaybookId.trim()
        : undefined;

    if (!jobId) return null;
    if (
      userImpactSummary.length < MIN_SUPPORT_ESCALATION_IMPACT_SUMMARY_LENGTH
    ) {
      return null;
    }
    if (notes && notes.length > 1000) return null;

    return {
      jobId,
      userImpactSummary,
      ...(notes ? { notes } : {}),
      ...(recoveryPlaybookId ? { recoveryPlaybookId } : {}),
    };
  }

  private parseEscalationListQuery(query: unknown): {
    jobId?: string;
    status?: SupportEscalationStatus;
    limit?: number;
  } | null {
    if (query === undefined || query === null) return {};
    if (typeof query !== 'object') return null;
    const q = query as Record<string, unknown>;

    let jobId: string | undefined;
    if (q.jobId !== undefined) {
      if (typeof q.jobId !== 'string') return null;
      const candidate = q.jobId.trim();
      if (!candidate) return null;
      jobId = candidate;
    }

    let status: SupportEscalationStatus | undefined;
    if (q.status !== undefined) {
      if (
        typeof q.status !== 'string' ||
        !SUPPORT_ESCALATION_STATUSES.has(q.status)
      ) {
        return null;
      }
      status = q.status as SupportEscalationStatus;
    }

    let limit: number | undefined;
    if (q.limit !== undefined) {
      const asNumber =
        typeof q.limit === 'number'
          ? q.limit
          : typeof q.limit === 'string'
            ? Number(q.limit)
            : NaN;
      if (!Number.isFinite(asNumber)) return null;
      const normalized = Math.trunc(asNumber);
      if (normalized <= 0) return null;
      limit = normalized;
    }

    return {
      ...(jobId ? { jobId } : {}),
      ...(status ? { status } : {}),
      ...(limit ? { limit } : {}),
    };
  }

  private parseBillingDiagnosticsQuery(query: unknown): {
    userId: string;
    limit: number;
  } | null {
    if (typeof query !== 'object' || query === null) return null;
    const q = query as Record<string, unknown>;
    if (typeof q.userId !== 'string') return null;
    const userId = q.userId.trim();
    if (!userId) return null;

    let limit = 50;
    if (q.limit !== undefined) {
      const asNumber =
        typeof q.limit === 'number'
          ? q.limit
          : typeof q.limit === 'string'
            ? Number(q.limit)
            : NaN;
      if (!Number.isFinite(asNumber)) return null;
      const normalized = Math.trunc(asNumber);
      if (normalized <= 0) return null;
      limit = Math.min(normalized, 200);
    }

    return { userId, limit };
  }

  private parseEscalationPatchBody(body: unknown): {
    status: SupportEscalationStatus;
    resolutionNotes?: string;
  } | null {
    if (typeof body !== 'object' || body === null) return null;
    const b = body as Record<string, unknown>;
    if (
      typeof b.status !== 'string' ||
      !SUPPORT_ESCALATION_STATUSES.has(b.status)
    ) {
      return null;
    }
    if (
      b.resolutionNotes !== undefined &&
      typeof b.resolutionNotes !== 'string'
    ) {
      return null;
    }

    const resolutionNotes =
      typeof b.resolutionNotes === 'string' &&
      b.resolutionNotes.trim().length > 0
        ? b.resolutionNotes.trim()
        : undefined;
    if (resolutionNotes && resolutionNotes.length > 1000) return null;

    return {
      status: b.status as SupportEscalationStatus,
      ...(resolutionNotes ? { resolutionNotes } : {}),
    };
  }

  private parseRecoveryPlaybooksQuery(query: unknown): {
    failureCategory?: SupportDiagnosticsFailureCategory;
    reasonCode?: string;
  } | null {
    if (query === null || query === undefined) return {};
    if (typeof query !== 'object') return null;

    const rawFailureCategory = (query as { failureCategory?: unknown })
      .failureCategory;
    const rawReasonCode = (query as { reasonCode?: unknown }).reasonCode;

    let failureCategory: SupportDiagnosticsFailureCategory | undefined;
    if (rawFailureCategory !== undefined) {
      if (typeof rawFailureCategory !== 'string') return null;
      const candidate = rawFailureCategory.trim();
      if (!candidate) return null;
      if (!isSupportDiagnosticsFailureCategory(candidate)) return null;
      failureCategory = candidate;
    }

    let reasonCode: string | undefined;
    if (rawReasonCode !== undefined) {
      if (typeof rawReasonCode !== 'string') return null;
      const candidate = rawReasonCode.trim();
      if (!candidate) return null;
      reasonCode = candidate;
    }

    return {
      ...(failureCategory ? { failureCategory } : {}),
      ...(reasonCode ? { reasonCode } : {}),
    };
  }

  private resolveRecoveryPlaybook(
    category: SupportDiagnosticsFailureCategory,
    reasonCode?: string,
  ): RecoveryPlaybookResolution {
    if (reasonCode) {
      const normalizedReasonCode = reasonCode.toUpperCase();
      const reasonCodeMap = REASON_CODE_PLAYBOOK_OVERRIDES[category];
      const matched = reasonCodeMap?.[normalizedReasonCode];
      if (matched) {
        return { playbook: matched, usedFallback: false };
      }
      return {
        playbook: BASE_RECOVERY_PLAYBOOKS[category],
        usedFallback: true,
      };
    }

    return {
      playbook: BASE_RECOVERY_PLAYBOOKS[category],
      usedFallback: false,
    };
  }

  private makeErrorEnvelope<TCode extends string>(params: {
    code: TCode;
    message: string;
    retryable: boolean;
  }): SupportErrorEnvelope<TCode> {
    return {
      data: null,
      error: {
        code: params.code,
        message: params.message,
        retryable: params.retryable,
        traceId: randomUUID(),
      },
    };
  }
}
