import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  CreateOutputReportResponse,
  OutputReportReasonCategory,
} from '@banyone/contracts';
import { FIRESTORE } from '../../infra/firestore.module';

type PersistedOutputReportRecord = {
  report_id: string;
  job_id: string;
  reporter_user_id: string;
  reason_category: OutputReportReasonCategory;
  details?: string;
  created_at: string;
  trace_id: string;
};

export type StoredOutputReport = {
  reportId: string;
  jobId: string;
  reporterUserId: string;
  reasonCategory: OutputReportReasonCategory;
  createdAt: string;
  traceId: string;
  details?: string;
};

@Injectable()
export class OutputReportStore {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async create(params: {
    reportId: string;
    jobId: string;
    reporterUserId: string;
    reasonCategory: OutputReportReasonCategory;
    createdAt: string;
    traceId: string;
    details?: string;
  }): Promise<CreateOutputReportResponse> {
    const record: PersistedOutputReportRecord = {
      report_id: params.reportId,
      job_id: params.jobId,
      reporter_user_id: params.reporterUserId,
      reason_category: params.reasonCategory,
      created_at: params.createdAt,
      trace_id: params.traceId,
      ...(params.details ? { details: params.details } : {}),
    };

    await this.firestore
      .collection('moderation_reports')
      .doc(params.reportId)
      .set(record);

    return {
      reportId: record.report_id,
      jobId: record.job_id,
      reporterUserId: record.reporter_user_id,
      reasonCategory: record.reason_category,
      createdAt: record.created_at,
      traceId: record.trace_id,
    };
  }

  async list(params: {
    reasonCategory?: OutputReportReasonCategory;
  }): Promise<StoredOutputReport[]> {
    const snapshots = await this.firestore.collection('moderation_reports').get();
    const records = snapshots.docs
      .map((d) => tryParsePersistedOutputReportRecord(d.data()))
      .filter((record): record is PersistedOutputReportRecord => record !== null)
      .map((record) => this.toStoredOutputReport(record))
      .filter((record) =>
        params.reasonCategory
          ? record.reasonCategory === params.reasonCategory
          : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return records;
  }

  async getById(reportId: string): Promise<StoredOutputReport | null> {
    const snapshot = await this.firestore
      .collection('moderation_reports')
      .doc(reportId)
      .get();
    const record = tryParsePersistedOutputReportRecord(snapshot.data());
    if (!record) return null;
    return this.toStoredOutputReport(record);
  }

  private toStoredOutputReport(
    record: PersistedOutputReportRecord,
  ): StoredOutputReport {
    return {
      reportId: record.report_id,
      jobId: record.job_id,
      reporterUserId: record.reporter_user_id,
      reasonCategory: record.reason_category,
      createdAt: record.created_at,
      traceId: record.trace_id,
      ...(record.details ? { details: record.details } : {}),
    };
  }
}

function tryParsePersistedOutputReportRecord(
  value: unknown,
): PersistedOutputReportRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.report_id !== 'string' ||
    typeof v.job_id !== 'string' ||
    typeof v.reporter_user_id !== 'string' ||
    typeof v.reason_category !== 'string' ||
    typeof v.created_at !== 'string' ||
    typeof v.trace_id !== 'string'
  ) {
    return null;
  }

  const reason = v.reason_category as OutputReportReasonCategory;
  if (
    reason !== 'HARASSMENT' &&
    reason !== 'HATE' &&
    reason !== 'SEXUAL_CONTENT' &&
    reason !== 'VIOLENCE' &&
    reason !== 'ILLEGAL' &&
    reason !== 'COPYRIGHT' &&
    reason !== 'SPAM' &&
    reason !== 'OTHER'
  ) {
    return null;
  }

  if (v.details !== undefined && typeof v.details !== 'string') return null;
  return {
    report_id: v.report_id,
    job_id: v.job_id,
    reporter_user_id: v.reporter_user_id,
    reason_category: reason,
    created_at: v.created_at,
    trace_id: v.trace_id,
    ...(typeof v.details === 'string' && v.details.trim().length > 0
      ? { details: v.details }
      : {}),
  };
}
