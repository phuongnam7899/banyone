import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  SupportEscalationDiagnosticsSnapshot,
  SupportEscalationRecord,
  SupportEscalationStatus,
} from '@banyone/contracts';
import { FIRESTORE } from '../../infra/firestore.module';

type PersistedSupportEscalationDiagnosticsSnapshot = {
  job_id: string;
  status: string;
  owner_user_id: string;
  updated_at: string;
  trace_id: string;
  failure_category: string;
  queued_at?: string;
  processing_at?: string;
  ready_at?: string;
  failed_at?: string;
  recovery_playbook_id?: string;
  failure?: {
    retryable: boolean;
    reason_code: string;
    next_action: string;
  };
};

type PersistedSupportEscalationRecord = {
  escalation_id: string;
  job_id: string;
  created_at: string;
  trace_id: string;
  actor_user_id: string;
  user_impact_summary: string;
  notes?: string;
  diagnostics_snapshot: PersistedSupportEscalationDiagnosticsSnapshot;
  status: SupportEscalationStatus;
  status_updated_at: string;
  resolution_notes?: string;
};

@Injectable()
export class SupportEscalationStore {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async create(record: SupportEscalationRecord): Promise<SupportEscalationRecord> {
    await this.firestore
      .collection('support_escalations')
      .doc(record.escalationId)
      .set(this.toPersisted(record));
    return record;
  }

  async getById(escalationId: string): Promise<SupportEscalationRecord | null> {
    const snapshot = await this.firestore
      .collection('support_escalations')
      .doc(escalationId)
      .get();
    const persisted = this.tryParseRecord(snapshot.data());
    if (!persisted) return null;
    return this.toRecord(persisted);
  }

  async list(filters: {
    jobId?: string;
    status?: SupportEscalationStatus;
    limit?: number;
  }): Promise<SupportEscalationRecord[]> {
    const boundedLimit =
      typeof filters.limit === 'number' && Number.isFinite(filters.limit)
        ? Math.max(1, Math.min(100, Math.trunc(filters.limit)))
        : undefined;

    const snapshots = await this.firestore.collection('support_escalations').get();
    const records = snapshots.docs
      .map((doc) => this.tryParseRecord(doc.data()))
      .filter((record): record is PersistedSupportEscalationRecord => record !== null)
      .map((record) => this.toRecord(record))
      .filter((record) =>
        filters.jobId ? record.jobId === filters.jobId : true,
      )
      .filter((record) =>
        filters.status ? record.status === filters.status : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (!boundedLimit) return records;
    return records.slice(0, boundedLimit);
  }

  async updateStatus(params: {
    escalationId: string;
    status: SupportEscalationStatus;
    statusUpdatedAt: string;
    resolutionNotes?: string;
  }): Promise<SupportEscalationRecord | null> {
    const ref = this.firestore
      .collection('support_escalations')
      .doc(params.escalationId);
    const existing = this.tryParseRecord((await ref.get()).data());
    if (!existing) return null;

    const next: PersistedSupportEscalationRecord = {
      ...existing,
      status: params.status,
      status_updated_at: params.statusUpdatedAt,
      ...(params.resolutionNotes
        ? { resolution_notes: params.resolutionNotes }
        : {}),
    };
    if (!params.resolutionNotes) {
      delete next.resolution_notes;
    }

    await ref.set(next);
    return this.toRecord(next);
  }

  private toPersisted(
    record: SupportEscalationRecord,
  ): PersistedSupportEscalationRecord {
    return {
      escalation_id: record.escalationId,
      job_id: record.jobId,
      created_at: record.createdAt,
      trace_id: record.traceId,
      actor_user_id: record.actorUserId,
      user_impact_summary: record.userImpactSummary,
      ...(record.notes ? { notes: record.notes } : {}),
      diagnostics_snapshot: {
        job_id: record.diagnosticsSnapshot.jobId,
        status: record.diagnosticsSnapshot.status,
        owner_user_id: record.diagnosticsSnapshot.ownerUserId,
        updated_at: record.diagnosticsSnapshot.updatedAt,
        trace_id: record.diagnosticsSnapshot.traceId,
        failure_category: record.diagnosticsSnapshot.failureCategory,
        ...(record.diagnosticsSnapshot.queuedAt
          ? { queued_at: record.diagnosticsSnapshot.queuedAt }
          : {}),
        ...(record.diagnosticsSnapshot.processingAt
          ? { processing_at: record.diagnosticsSnapshot.processingAt }
          : {}),
        ...(record.diagnosticsSnapshot.readyAt
          ? { ready_at: record.diagnosticsSnapshot.readyAt }
          : {}),
        ...(record.diagnosticsSnapshot.failedAt
          ? { failed_at: record.diagnosticsSnapshot.failedAt }
          : {}),
        ...(record.diagnosticsSnapshot.recoveryPlaybookId
          ? {
              recovery_playbook_id:
                record.diagnosticsSnapshot.recoveryPlaybookId,
            }
          : {}),
        ...(record.diagnosticsSnapshot.failure
          ? {
              failure: {
                retryable: record.diagnosticsSnapshot.failure.retryable,
                reason_code: record.diagnosticsSnapshot.failure.reasonCode,
                next_action: record.diagnosticsSnapshot.failure.nextAction,
              },
            }
          : {}),
      },
      status: record.status,
      status_updated_at: record.statusUpdatedAt,
      ...(record.resolutionNotes
        ? { resolution_notes: record.resolutionNotes }
        : {}),
    };
  }

  private toRecord(
    record: PersistedSupportEscalationRecord,
  ): SupportEscalationRecord {
    const snapshot: SupportEscalationDiagnosticsSnapshot = {
      jobId: record.diagnostics_snapshot.job_id,
      status: record.diagnostics_snapshot
        .status as SupportEscalationDiagnosticsSnapshot['status'],
      ownerUserId: record.diagnostics_snapshot.owner_user_id,
      updatedAt: record.diagnostics_snapshot.updated_at,
      traceId: record.diagnostics_snapshot.trace_id,
      failureCategory: record.diagnostics_snapshot
        .failure_category as SupportEscalationDiagnosticsSnapshot['failureCategory'],
      ...(record.diagnostics_snapshot.queued_at
        ? { queuedAt: record.diagnostics_snapshot.queued_at }
        : {}),
      ...(record.diagnostics_snapshot.processing_at
        ? { processingAt: record.diagnostics_snapshot.processing_at }
        : {}),
      ...(record.diagnostics_snapshot.ready_at
        ? { readyAt: record.diagnostics_snapshot.ready_at }
        : {}),
      ...(record.diagnostics_snapshot.failed_at
        ? { failedAt: record.diagnostics_snapshot.failed_at }
        : {}),
      ...(record.diagnostics_snapshot.recovery_playbook_id
        ? {
            recoveryPlaybookId:
              record.diagnostics_snapshot.recovery_playbook_id,
          }
        : {}),
      ...(record.diagnostics_snapshot.failure
        ? {
            failure: {
              retryable: record.diagnostics_snapshot.failure.retryable,
              reasonCode: record.diagnostics_snapshot.failure.reason_code,
              nextAction: record.diagnostics_snapshot.failure.next_action,
            },
          }
        : {}),
    };

    return {
      escalationId: record.escalation_id,
      jobId: record.job_id,
      createdAt: record.created_at,
      traceId: record.trace_id,
      actorUserId: record.actor_user_id,
      userImpactSummary: record.user_impact_summary,
      ...(record.notes ? { notes: record.notes } : {}),
      diagnosticsSnapshot: snapshot,
      status: record.status,
      statusUpdatedAt: record.status_updated_at,
      ...(record.resolution_notes
        ? { resolutionNotes: record.resolution_notes }
        : {}),
    };
  }


  private tryParseRecord(
    value: unknown,
  ): PersistedSupportEscalationRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.escalation_id !== 'string' ||
      typeof v.job_id !== 'string' ||
      typeof v.created_at !== 'string' ||
      typeof v.trace_id !== 'string' ||
      typeof v.actor_user_id !== 'string' ||
      typeof v.user_impact_summary !== 'string' ||
      typeof v.status !== 'string' ||
      typeof v.status_updated_at !== 'string' ||
      typeof v.diagnostics_snapshot !== 'object' ||
      v.diagnostics_snapshot === null
    ) {
      return null;
    }

    const ds = v.diagnostics_snapshot as Record<string, unknown>;
    if (
      typeof ds.job_id !== 'string' ||
      typeof ds.status !== 'string' ||
      typeof ds.owner_user_id !== 'string' ||
      typeof ds.updated_at !== 'string' ||
      typeof ds.trace_id !== 'string' ||
      typeof ds.failure_category !== 'string'
    ) {
      return null;
    }

    const parsedFailure =
      typeof ds.failure === 'object' &&
      ds.failure !== null &&
      typeof (ds.failure as { retryable?: unknown }).retryable === 'boolean' &&
      typeof (ds.failure as { reason_code?: unknown }).reason_code ===
        'string' &&
      typeof (ds.failure as { next_action?: unknown }).next_action === 'string'
        ? {
            retryable: (ds.failure as { retryable: boolean }).retryable,
            reason_code: (ds.failure as { reason_code: string }).reason_code,
            next_action: (ds.failure as { next_action: string }).next_action,
          }
        : undefined;

    return {
      escalation_id: v.escalation_id,
      job_id: v.job_id,
      created_at: v.created_at,
      trace_id: v.trace_id,
      actor_user_id: v.actor_user_id,
      user_impact_summary: v.user_impact_summary,
      ...(typeof v.notes === 'string' && v.notes.trim().length > 0
        ? { notes: v.notes }
        : {}),
      diagnostics_snapshot: {
        job_id: ds.job_id,
        status: ds.status,
        owner_user_id: ds.owner_user_id,
        updated_at: ds.updated_at,
        trace_id: ds.trace_id,
        failure_category: ds.failure_category,
        ...(typeof ds.queued_at === 'string'
          ? { queued_at: ds.queued_at }
          : {}),
        ...(typeof ds.processing_at === 'string'
          ? { processing_at: ds.processing_at }
          : {}),
        ...(typeof ds.ready_at === 'string' ? { ready_at: ds.ready_at } : {}),
        ...(typeof ds.failed_at === 'string'
          ? { failed_at: ds.failed_at }
          : {}),
        ...(typeof ds.recovery_playbook_id === 'string'
          ? { recovery_playbook_id: ds.recovery_playbook_id }
          : {}),
        ...(parsedFailure ? { failure: parsedFailure } : {}),
      },
      status: v.status as SupportEscalationStatus,
      status_updated_at: v.status_updated_at,
      ...(typeof v.resolution_notes === 'string' &&
      v.resolution_notes.trim().length > 0
        ? { resolution_notes: v.resolution_notes }
        : {}),
    };
  }

}
