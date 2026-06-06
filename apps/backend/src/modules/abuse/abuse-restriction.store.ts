import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AbuseRestrictionAuditRecord,
  AbuseRestrictionRecord,
  AbuseRestrictionSource,
  AbuseSubjectType,
} from '@banyone/contracts';
import { FIRESTORE } from '../../infra/firestore.module';

type PersistedAbuseRestrictionRecord = {
  restriction_id: string;
  subject_type: AbuseSubjectType;
  subject_id: string;
  reason: string;
  source: AbuseRestrictionSource;
  created_at: string;
  updated_at: string;
  created_by: string;
  expires_at?: string;
  cleared_at?: string;
  cleared_by?: string;
};

type PersistedAbuseRestrictionAuditRecord = {
  record_id: string;
  restriction_id: string;
  subject_type: AbuseSubjectType;
  subject_id: string;
  action: 'apply' | 'clear' | 'update';
  actor_user_id: string;
  created_at: string;
  trace_id: string;
  reason: string;
  source: AbuseRestrictionSource;
  expires_at?: string;
};

type UpsertRestrictionParams = {
  restrictionId: string;
  subjectType: AbuseSubjectType;
  subjectId: string;
  reason: string;
  source: AbuseRestrictionSource;
  createdAt: string;
  createdBy: string;
  expiresAt?: string;
};

@Injectable()
export class AbuseRestrictionStore {
  private readonly restrictionsBySubject = new Map<
    string,
    PersistedAbuseRestrictionRecord
  >();
  private readonly audits: PersistedAbuseRestrictionAuditRecord[] = [];
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  upsertRestriction(
    params: UpsertRestrictionParams,
  ): AbuseRestrictionRecord {
    const nowIso = params.createdAt;
    const key = this.buildSubjectKey(params.subjectType, params.subjectId);
    const existing = this.restrictionsBySubject.get(key);
    const next: PersistedAbuseRestrictionRecord = {
      restriction_id: params.restrictionId,
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      reason: params.reason,
      source: params.source,
      created_at: existing?.created_at ?? nowIso,
      updated_at: nowIso,
      created_by: existing?.created_by ?? params.createdBy,
      ...(params.expiresAt ? { expires_at: params.expiresAt } : {}),
      ...(existing?.cleared_at ? {} : {}),
      ...(existing?.cleared_by ? {} : {}),
    };
    delete next.cleared_at;
    delete next.cleared_by;
    this.restrictionsBySubject.set(key, next);
    void this.firestore.collection('abuse_restrictions').doc(key).set(next);
    return this.toRestrictionRecord(next);
  }

  getActiveRestriction(
    subjectType: AbuseSubjectType,
    subjectId: string,
    nowIso: string,
  ): AbuseRestrictionRecord | null {
    const key = this.buildSubjectKey(subjectType, subjectId);
    const record = this.restrictionsBySubject.get(key);
    if (!record) return null;
    if (record.cleared_at) return null;
    if (record.expires_at && record.expires_at <= nowIso) return null;
    return this.toRestrictionRecord(record);
  }

  clearRestriction(
    subjectType: AbuseSubjectType,
    subjectId: string,
    actorUserId: string,
    clearedAt: string,
  ): AbuseRestrictionRecord | null {
    const key = this.buildSubjectKey(subjectType, subjectId);
    const doc = this.firestore.collection('abuse_restrictions').doc(key);
    const record = this.restrictionsBySubject.get(key);
    if (!record) return null;
    record.cleared_at = clearedAt;
    record.cleared_by = actorUserId;
    record.updated_at = clearedAt;
    this.restrictionsBySubject.set(key, record);
    void doc.set(record);
    return this.toRestrictionRecord(record);
  }

  appendAudit(record: AbuseRestrictionAuditRecord): void {
    const row: PersistedAbuseRestrictionAuditRecord = {
      record_id: record.recordId,
      restriction_id: record.restrictionId,
      subject_type: record.subjectType,
      subject_id: record.subjectId,
      action: record.action,
      actor_user_id: record.actorUserId,
      created_at: record.createdAt,
      trace_id: record.traceId,
      reason: record.reason,
      source: record.source,
      ...(record.expiresAt ? { expires_at: record.expiresAt } : {}),
    };
    this.audits.push(row);
    void this.firestore.collection('abuse_audits').doc(row.record_id).set(row);
  }

  listAuditBySubject(
    subjectType: AbuseSubjectType,
    subjectId: string,
  ): AbuseRestrictionAuditRecord[] {
    return this.audits
      .filter(
        (record) =>
          record.subject_type === subjectType && record.subject_id === subjectId,
      )
      .map((record) => ({
        recordId: record.record_id,
        restrictionId: record.restriction_id,
        subjectType: record.subject_type,
        subjectId: record.subject_id,
        action: record.action,
        actorUserId: record.actor_user_id,
        createdAt: record.created_at,
        traceId: record.trace_id,
        reason: record.reason,
        source: record.source,
        ...(record.expires_at ? { expiresAt: record.expires_at } : {}),
      }));
  }

  private buildSubjectKey(subjectType: AbuseSubjectType, subjectId: string): string {
    return `${subjectType}:${subjectId}`;
  }

  private toRestrictionRecord(
    record: PersistedAbuseRestrictionRecord,
  ): AbuseRestrictionRecord {
    return {
      restrictionId: record.restriction_id,
      subjectType: record.subject_type,
      subjectId: record.subject_id,
      reason: record.reason,
      source: record.source,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      createdBy: record.created_by,
      ...(record.expires_at ? { expiresAt: record.expires_at } : {}),
      ...(record.cleared_at ? { clearedAt: record.cleared_at } : {}),
      ...(record.cleared_by ? { clearedBy: record.cleared_by } : {}),
    };
  }


  private tryParsePersistedRestriction(
    value: unknown,
  ): PersistedAbuseRestrictionRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.restriction_id !== 'string' ||
      (v.subject_type !== 'account' && v.subject_type !== 'device') ||
      typeof v.subject_id !== 'string' ||
      typeof v.reason !== 'string' ||
      (v.source !== 'manual' && v.source !== 'automated') ||
      typeof v.created_at !== 'string' ||
      typeof v.updated_at !== 'string' ||
      typeof v.created_by !== 'string'
    ) {
      return null;
    }
    if (v.expires_at !== undefined && typeof v.expires_at !== 'string') return null;
    if (v.cleared_at !== undefined && typeof v.cleared_at !== 'string') return null;
    if (v.cleared_by !== undefined && typeof v.cleared_by !== 'string') return null;

    return {
      restriction_id: v.restriction_id,
      subject_type: v.subject_type,
      subject_id: v.subject_id,
      reason: v.reason,
      source: v.source,
      created_at: v.created_at,
      updated_at: v.updated_at,
      created_by: v.created_by,
      ...(v.expires_at ? { expires_at: v.expires_at } : {}),
      ...(v.cleared_at ? { cleared_at: v.cleared_at } : {}),
      ...(v.cleared_by ? { cleared_by: v.cleared_by } : {}),
    };
  }

  private tryParsePersistedAudit(
    value: unknown,
  ): PersistedAbuseRestrictionAuditRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const v = value as Record<string, unknown>;
    if (
      typeof v.record_id !== 'string' ||
      typeof v.restriction_id !== 'string' ||
      (v.subject_type !== 'account' && v.subject_type !== 'device') ||
      typeof v.subject_id !== 'string' ||
      (v.action !== 'apply' && v.action !== 'clear' && v.action !== 'update') ||
      typeof v.actor_user_id !== 'string' ||
      typeof v.created_at !== 'string' ||
      typeof v.trace_id !== 'string' ||
      typeof v.reason !== 'string' ||
      (v.source !== 'manual' && v.source !== 'automated')
    ) {
      return null;
    }
    if (v.expires_at !== undefined && typeof v.expires_at !== 'string') return null;
    return {
      record_id: v.record_id,
      restriction_id: v.restriction_id,
      subject_type: v.subject_type,
      subject_id: v.subject_id,
      action: v.action,
      actor_user_id: v.actor_user_id,
      created_at: v.created_at,
      trace_id: v.trace_id,
      reason: v.reason,
      source: v.source,
      ...(v.expires_at ? { expires_at: v.expires_at } : {}),
    };
  }

}
