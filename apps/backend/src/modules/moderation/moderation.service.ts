import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  MODERATION_INVALID_ACTION_ERROR_CODE,
  MODERATION_REPORT_NOT_FOUND_ERROR_CODE,
  OUTPUT_REPORT_INVALID_ERROR_CODE,
  isModerationActionType,
  isOutputReportReasonCategory,
  type CreateOutputReportRequest,
  type CreateModerationActionRequest,
  type ModerationActionEnvelope,
  type ModerationQueueDetailEnvelope,
  type ModerationQueueListEnvelope,
  type ModerationQueueListQuery,
  type OutputReportEnvelope,
  type OutputReportReasonCategory,
} from '@banyone/contracts';

import { JobsService } from '../jobs/jobs.service';
import { ModerationActionStore } from './moderation-action.store';
import { OutputReportStore } from './output-report.store';

const MAX_OUTPUT_REPORT_DETAILS_LENGTH = 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ModerationService {
  constructor(
    private readonly outputReports: OutputReportStore,
    private readonly moderationActions: ModerationActionStore,
    private readonly jobsService: JobsService,
  ) {}

  async createOutputReport(params: {
    userId: string;
    jobId: string;
    body: unknown;
  }): Promise<OutputReportEnvelope> {
    const parsed = this.parseCreateOutputReportRequest(params.body);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: OUTPUT_REPORT_INVALID_ERROR_CODE,
        message:
          'Invalid report payload. reasonCategory is required and details may be up to 1000 characters.',
        retryable: false,
      });
    }

    const eligibility = await this.jobsService.getOutputReportEligibility({
      userId: params.userId,
      jobId: params.jobId,
    });
    if (!eligibility.ok) {
      return this.makeErrorEnvelope({
        code: eligibility.code,
        message: eligibility.message,
        retryable: eligibility.retryable,
      });
    }

    const reportId = randomUUID();
    const traceId = randomUUID();
    const createdAt = new Date().toISOString();
    const data = await this.outputReports.create({
      reportId,
      jobId: params.jobId,
      reporterUserId: params.userId,
      reasonCategory: parsed.reasonCategory,
      details: parsed.details,
      createdAt,
      traceId,
    });

    console.info('telemetry.moderation.outputReport.submitted.v1', {
      traceId,
      jobId: params.jobId,
      reportId,
      reasonCategory: parsed.reasonCategory,
    });

    return { data, error: null };
  }

  private parseCreateOutputReportRequest(
    body: unknown,
  ): CreateOutputReportRequest | null {
    if (
      typeof body !== 'object' ||
      body === null ||
      !('reasonCategory' in body)
    ) {
      return null;
    }
    const reasonCategory = (body as { reasonCategory?: unknown })
      .reasonCategory;
    const detailsRaw = (body as { details?: unknown }).details;

    if (!isOutputReportReasonCategory(reasonCategory)) {
      return null;
    }
    if (detailsRaw !== undefined && typeof detailsRaw !== 'string') return null;

    const details = detailsRaw?.trim();
    if (details && details.length > MAX_OUTPUT_REPORT_DETAILS_LENGTH)
      return null;

    return {
      reasonCategory,
      ...(details ? { details } : {}),
    };
  }

  async listModerationQueue(
    query: ModerationQueueListQuery,
  ): Promise<ModerationQueueListEnvelope> {
    const page = this.normalizePositiveInt(query.page, 1);
    const pageSize = this.normalizePositiveInt(
      query.pageSize,
      DEFAULT_PAGE_SIZE,
    );
    const boundedPageSize = Math.min(pageSize, MAX_PAGE_SIZE);

    const reports = await this.outputReports.list({
      reasonCategory: query.reasonCategory,
    });

    const start = (page - 1) * boundedPageSize;
    const items = await Promise.all(
      reports
        .slice(start, start + boundedPageSize)
        .map((report) => this.enrichQueueItem(report)),
    );

    return {
      data: {
        items,
        page,
        pageSize: boundedPageSize,
        total: reports.length,
      },
      error: null,
    };
  }

  async getModerationQueueDetail(
    reportId: string,
  ): Promise<ModerationQueueDetailEnvelope> {
    const report = await this.outputReports.getById(reportId);
    if (!report) {
      return this.makeErrorEnvelope({
        code: MODERATION_REPORT_NOT_FOUND_ERROR_CODE,
        message: 'Moderation report not found.',
        retryable: false,
      });
    }

    const actions = await this.moderationActions.listByReportId(report.reportId);
    return {
      data: {
        ...(await this.enrichQueueItem(report)),
        actions,
      },
      error: null,
    };
  }

  async createModerationAction(params: {
    actorUserId: string;
    reportId: string;
    body: unknown;
  }): Promise<ModerationActionEnvelope> {
    const report = await this.outputReports.getById(params.reportId);
    if (!report) {
      return this.makeErrorEnvelope({
        code: MODERATION_REPORT_NOT_FOUND_ERROR_CODE,
        message: 'Moderation report not found.',
        retryable: false,
      });
    }

    const parsed = this.parseCreateModerationActionRequest(params.body);
    if (!parsed) {
      return this.makeErrorEnvelope({
        code: MODERATION_INVALID_ACTION_ERROR_CODE,
        message:
          'Invalid moderation action payload. actionType is required and notes may be up to 1000 characters.',
        retryable: false,
      });
    }

    const action = await this.moderationActions.append({
      actionId: randomUUID(),
      reportId: report.reportId,
      jobId: report.jobId,
      actorUserId: params.actorUserId,
      actionType: parsed.actionType,
      createdAt: new Date().toISOString(),
      traceId: randomUUID(),
      notes: parsed.notes,
    });

    console.info('telemetry.moderation.outputReport.actioned.v1', {
      traceId: action.traceId,
      reportId: action.reportId,
      jobId: action.jobId,
      actionType: action.actionType,
    });

    return {
      data: { action },
      error: null,
    };
  }

  private parseCreateModerationActionRequest(
    body: unknown,
  ): CreateModerationActionRequest | null {
    if (typeof body !== 'object' || body === null || !('actionType' in body)) {
      return null;
    }
    const actionType = (body as { actionType?: unknown }).actionType;
    const notesRaw = (body as { notes?: unknown }).notes;
    if (!isModerationActionType(actionType)) {
      return null;
    }
    if (notesRaw !== undefined && typeof notesRaw !== 'string') return null;

    const notes = notesRaw?.trim();
    if (notes && notes.length > MAX_OUTPUT_REPORT_DETAILS_LENGTH) return null;

    return {
      actionType,
      ...(notes ? { notes } : {}),
    };
  }

  private normalizePositiveInt(
    value: number | undefined,
    fallback: number,
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const rounded = Math.trunc(value);
    return rounded > 0 ? rounded : fallback;
  }

  private async enrichQueueItem(report: {
    reportId: string;
    jobId: string;
    reporterUserId: string;
    reasonCategory: OutputReportReasonCategory;
    createdAt: string;
    traceId: string;
    details?: string;
  }) {
    const job = await this.jobsService.getJobSnapshotForModeration({
      jobId: report.jobId,
    });

    return {
      reportId: report.reportId,
      jobId: report.jobId,
      reporterUserId: report.reporterUserId,
      reasonCategory: report.reasonCategory,
      createdAt: report.createdAt,
      traceId: report.traceId,
      ...(report.details ? { details: report.details } : {}),
      job: job
        ? {
            status: job.status,
            userId: job.userId,
            updatedAt: job.updatedAt,
            ...(job.queuedAt ? { queuedAt: job.queuedAt } : {}),
            ...(job.processingAt ? { processingAt: job.processingAt } : {}),
            ...(job.readyAt ? { readyAt: job.readyAt } : {}),
            ...(job.failedAt ? { failedAt: job.failedAt } : {}),
            ...(job.failure ? { failure: job.failure } : {}),
          }
        : {
            status: null,
            userId: null,
            updatedAt: null,
          },
    };
  }

  private makeErrorEnvelope(params: {
    code: string;
    message: string;
    retryable: boolean;
  }): {
    data: null;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      traceId: string;
    };
  } {
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
