import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type {
  ModerationActionEnvelope,
  ModerationQueueDetailEnvelope,
  ModerationQueueListEnvelope,
  OutputReportEnvelope,
  OutputReportReasonCategory,
} from '@banyone/contracts';

import { CurrentUser } from '../auth/current-user.decorator';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ModeratorGuard } from '../auth/moderator.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import { ModerationService } from './moderation.service';

@UseGuards(FirebaseAuthGuard, BanyoneUserThrottlerGuard)
@SkipThrottle({ default: true })
@Controller('v1')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * OpenAPI (inline minimal docs):
   * - POST /v1/generation-jobs/:jobId/reports
   * - Body: { reasonCategory: OutputReportReasonCategory, details?: string }
   * - 201: { data: { reportId, jobId, reporterUserId, reasonCategory, createdAt, traceId }, error: null }
   * - 200 (error envelope): { data: null, error: { code, message, retryable, traceId } }
   *   - JOB_NOT_FOUND when job does not exist or is not owned by caller.
   *   - JOB_NOT_READY when reporting is attempted before completion.
   */
  @Post('generation-jobs/:jobId/reports')
  @SkipThrottle({ default: false })
  createOutputReport(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('jobId') jobId: string,
    @Body() body: unknown,
  ): Promise<OutputReportEnvelope> {
    return this.moderationService.createOutputReport({
      userId: user.uid,
      jobId,
      body,
    });
  }

  @Get('moderation/output-reports')
  @UseGuards(ModeratorGuard)
  @SkipThrottle({ default: true })
  listOutputReports(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('reasonCategory') reasonCategory?: OutputReportReasonCategory,
  ): Promise<ModerationQueueListEnvelope> {
    return this.moderationService.listModerationQueue({
      page,
      pageSize,
      reasonCategory,
    });
  }

  @Get('moderation/output-reports/:reportId')
  @UseGuards(ModeratorGuard)
  @SkipThrottle({ default: true })
  getOutputReportDetail(
    @Param('reportId') reportId: string,
  ): Promise<ModerationQueueDetailEnvelope> {
    return this.moderationService.getModerationQueueDetail(reportId);
  }

  @Post('moderation/output-reports/:reportId/actions')
  @UseGuards(ModeratorGuard)
  @SkipThrottle({ default: false })
  createOutputReportAction(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('reportId') reportId: string,
    @Body() body: unknown,
  ): Promise<ModerationActionEnvelope> {
    return this.moderationService.createModerationAction({
      actorUserId: user.uid,
      reportId,
      body,
    });
  }
}
