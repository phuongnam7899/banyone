import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  ModerationActionRecord,
  ModerationActionType,
} from '@banyone/contracts';
import { FIRESTORE } from '../../infra/firestore.module';

type PersistedModerationActionRecord = {
  action_id: string;
  report_id: string;
  job_id: string;
  actor_user_id: string;
  action_type: ModerationActionType;
  created_at: string;
  trace_id: string;
  notes?: string;
};

@Injectable()
export class ModerationActionStore {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async append(params: {
    actionId: string;
    reportId: string;
    jobId: string;
    actorUserId: string;
    actionType: ModerationActionType;
    createdAt: string;
    traceId: string;
    notes?: string;
  }): Promise<ModerationActionRecord> {
    const record: PersistedModerationActionRecord = {
      action_id: params.actionId,
      report_id: params.reportId,
      job_id: params.jobId,
      actor_user_id: params.actorUserId,
      action_type: params.actionType,
      created_at: params.createdAt,
      trace_id: params.traceId,
      ...(params.notes ? { notes: params.notes } : {}),
    };

    await this.firestore
      .collection('moderation_actions')
      .doc(params.actionId)
      .set(record);

    return this.toActionRecord(record);
  }

  async listByReportId(reportId: string): Promise<ModerationActionRecord[]> {
    const snapshot = await this.firestore
      .collection('moderation_actions')
      .where('report_id', '==', reportId)
      .get();
    const records = snapshot.docs
      .map((doc) => this.tryParsePersistedRecord(doc.data()))
      .filter(
        (record): record is PersistedModerationActionRecord => record !== null,
      );
    return records
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((record) => this.toActionRecord(record));
  }

  private toActionRecord(
    record: PersistedModerationActionRecord,
  ): ModerationActionRecord {
    return {
      actionId: record.action_id,
      reportId: record.report_id,
      jobId: record.job_id,
      actorUserId: record.actor_user_id,
      actionType: record.action_type,
      createdAt: record.created_at,
      traceId: record.trace_id,
      ...(record.notes ? { notes: record.notes } : {}),
    };
  }


  private tryParsePersistedRecord(
    value: unknown,
  ): PersistedModerationActionRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.action_id !== 'string' ||
      typeof v.report_id !== 'string' ||
      typeof v.job_id !== 'string' ||
      typeof v.actor_user_id !== 'string' ||
      typeof v.created_at !== 'string' ||
      typeof v.trace_id !== 'string' ||
      (v.action_type !== 'DISMISS' &&
        v.action_type !== 'ESCALATE' &&
        v.action_type !== 'RESTRICT_RECOMMENDED')
    ) {
      return null;
    }
    if (v.notes !== undefined && typeof v.notes !== 'string') return null;
    return {
      action_id: v.action_id,
      report_id: v.report_id,
      job_id: v.job_id,
      actor_user_id: v.actor_user_id,
      action_type: v.action_type,
      created_at: v.created_at,
      trace_id: v.trace_id,
      ...(typeof v.notes === 'string' && v.notes.trim().length > 0
        ? { notes: v.notes }
        : {}),
    };
  }

}
