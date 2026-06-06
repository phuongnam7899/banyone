import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
  type AbuseRestrictionDetails,
  type AbuseRestrictionMutationEnvelope,
  type AbuseRestrictionRecord,
  type AbuseRestrictionSource,
  type AbuseSubjectType,
} from '@banyone/contracts';

import { AbuseRestrictionStore } from './abuse-restriction.store';

const ACTION_CREATE = 'generation_job_create';
const ACTION_EXPORT = 'generation_job_export';

@Injectable()
export class AbuseService {
  private readonly thresholdWindowMs: number;
  private readonly thresholdMaxJobs: number;
  private readonly recentAttemptsByUser = new Map<string, number[]>();

  constructor(private readonly store: AbuseRestrictionStore) {
    this.thresholdWindowMs = this.readIntEnv('BANYONE_ABUSE_THRESHOLD_WINDOW_MS', 60_000);
    this.thresholdMaxJobs = this.readIntEnv('BANYONE_ABUSE_THRESHOLD_MAX_JOBS', 0);
  }

  async checkRestriction(params: {
    userId: string;
    action: typeof ACTION_CREATE | typeof ACTION_EXPORT;
  }): Promise<
    { blocked: false } | { blocked: true; details: AbuseRestrictionDetails }
  > {
    const nowIso = new Date().toISOString();
    const active = await this.store.getActiveRestriction(
      'account',
      params.userId,
      nowIso,
    );
    if (!active) return { blocked: false };

    return {
      blocked: true,
      details: {
        restrictionId: active.restrictionId,
        subjectType: active.subjectType,
        subjectId: active.subjectId,
        reason: active.reason,
        source: active.source,
        ...(active.expiresAt ? { expiresAt: active.expiresAt } : {}),
      },
    };
  }

  async evaluateAutomatedThreshold(params: {
    userId: string;
  }): Promise<AbuseRestrictionRecord | null> {
    if (this.thresholdMaxJobs <= 0) return null;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const existing = await this.store.getActiveRestriction(
      'account',
      params.userId,
      nowIso,
    );
    if (existing) return existing;

    const previous = this.recentAttemptsByUser.get(params.userId) ?? [];
    const fresh = previous.filter((timestampMs) => nowMs - timestampMs <= this.thresholdWindowMs);
    fresh.push(nowMs);
    this.recentAttemptsByUser.set(params.userId, fresh);
    if (fresh.length <= this.thresholdMaxJobs) return null;

    const reason = `Automated threshold triggered: ${fresh.length} create attempts in ${this.thresholdWindowMs}ms`;
    const applied = await this.applyRestrictionInternal({
      subjectType: 'account',
      subjectId: params.userId,
      reason,
      source: 'automated',
      actorUserId: 'system',
      expiresAt: undefined,
    });

    console.info('telemetry.abuse.restriction.automated.v1', {
      traceId: randomUUID(),
      subjectId: params.userId,
      action: 'apply',
      source: 'automated',
      reason,
    });

    return applied;
  }

  async applyManualRestriction(params: {
    actorUserId: string;
    subjectType: AbuseSubjectType;
    subjectId: string;
    reason: string;
    expiresAt?: string;
  }): Promise<AbuseRestrictionMutationEnvelope> {
    if (!this.isReasonValid(params.reason) || !this.isSubjectIdValid(params.subjectId)) {
      return this.makeErrorEnvelope({
        code: 'ABUSE_RESTRICTION_INVALID',
        message: 'Invalid restriction payload.',
        retryable: false,
      });
    }

    if (params.expiresAt && Number.isNaN(Date.parse(params.expiresAt))) {
      return this.makeErrorEnvelope({
        code: 'ABUSE_RESTRICTION_INVALID',
        message: 'expiresAt must be a valid ISO timestamp.',
        retryable: false,
      });
    }

    const data = await this.applyRestrictionInternal({
      actorUserId: params.actorUserId,
      source: 'manual',
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      reason: params.reason.trim(),
      expiresAt: params.expiresAt,
    });

    return { data: { restriction: data }, error: null };
  }

  async clearManualRestriction(params: {
    actorUserId: string;
    subjectType: AbuseSubjectType;
    subjectId: string;
    reason?: string;
  }): Promise<AbuseRestrictionMutationEnvelope> {
    if (!this.isSubjectIdValid(params.subjectId)) {
      return this.makeErrorEnvelope({
        code: 'ABUSE_RESTRICTION_INVALID',
        message: 'Invalid restriction payload.',
        retryable: false,
      });
    }
    const nowIso = new Date().toISOString();
    const active = await this.store.getActiveRestriction(
      params.subjectType,
      params.subjectId,
      nowIso,
    );
    if (!active) {
      return this.makeErrorEnvelope({
        code: 'ABUSE_RESTRICTION_INVALID',
        message: 'No active restriction exists for this subject.',
        retryable: false,
      });
    }

    const cleared = await this.store.clearRestriction(
      params.subjectType,
      params.subjectId,
      params.actorUserId,
      nowIso,
    );
    if (!cleared) {
      return this.makeErrorEnvelope({
        code: 'ABUSE_RESTRICTION_INVALID',
        message: 'No active restriction exists for this subject.',
        retryable: false,
      });
    }

    const traceId = randomUUID();
    await this.store.appendAudit({
      recordId: randomUUID(),
      restrictionId: cleared.restrictionId,
      subjectType: cleared.subjectType,
      subjectId: cleared.subjectId,
      action: 'clear',
      actorUserId: params.actorUserId,
      createdAt: nowIso,
      traceId,
      reason: params.reason?.trim() || 'Restriction cleared by moderator',
      source: 'manual',
    });

    console.info('telemetry.abuse.restriction.v1', {
      traceId,
      subjectId: params.subjectId,
      action: 'clear',
    });

    return { data: { restriction: cleared }, error: null };
  }

  async getActiveRestriction(params: {
    subjectType: AbuseSubjectType;
    subjectId: string;
  }): Promise<AbuseRestrictionRecord | null> {
    return this.store.getActiveRestriction(
      params.subjectType,
      params.subjectId,
      new Date().toISOString(),
    );
  }

  makeRestrictionErrorEnvelope(details: AbuseRestrictionDetails): {
    data: null;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      details: AbuseRestrictionDetails;
      traceId: string;
    };
  } {
    return {
      data: null,
      error: {
        code: ABUSE_RESTRICTION_ACTIVE_ERROR_CODE,
        message: 'This account is currently restricted from this action.',
        retryable: details.expiresAt !== undefined,
        details,
        traceId: randomUUID(),
      },
    };
  }

  private async applyRestrictionInternal(params: {
    actorUserId: string;
    source: AbuseRestrictionSource;
    subjectType: AbuseSubjectType;
    subjectId: string;
    reason: string;
    expiresAt?: string;
  }): Promise<AbuseRestrictionRecord> {
    const nowIso = new Date().toISOString();
    const active = await this.store.getActiveRestriction(
      params.subjectType,
      params.subjectId,
      nowIso,
    );
    const action = active ? 'update' : 'apply';
    const restriction = await this.store.upsertRestriction({
      restrictionId: active?.restrictionId ?? randomUUID(),
      subjectType: params.subjectType,
      subjectId: params.subjectId.trim(),
      reason: params.reason.trim(),
      source: params.source,
      createdAt: nowIso,
      createdBy: params.actorUserId,
      expiresAt: params.expiresAt,
    });

    const traceId = randomUUID();
    await this.store.appendAudit({
      recordId: randomUUID(),
      restrictionId: restriction.restrictionId,
      subjectType: restriction.subjectType,
      subjectId: restriction.subjectId,
      action,
      actorUserId: params.actorUserId,
      createdAt: nowIso,
      traceId,
      reason: restriction.reason,
      source: params.source,
      ...(restriction.expiresAt ? { expiresAt: restriction.expiresAt } : {}),
    });

    console.info('telemetry.abuse.restriction.v1', {
      traceId,
      subjectId: restriction.subjectId,
      action,
      source: params.source,
    });

    return restriction;
  }

  private makeErrorEnvelope(params: {
    code: string;
    message: string;
    retryable: boolean;
  }): AbuseRestrictionMutationEnvelope {
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

  private isReasonValid(reason: string): boolean {
    return reason.trim().length > 0 && reason.trim().length <= 500;
  }

  private isSubjectIdValid(subjectId: string): boolean {
    const normalized = subjectId.trim();
    return normalized.length > 0 && normalized.length <= 128;
  }

  private readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.trunc(parsed);
  }
}
