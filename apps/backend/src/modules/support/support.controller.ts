import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type {
  QualityTierComparisonEnvelope,
  SupportEscalationEnvelope,
  SupportEscalationListEnvelope,
  SupportJobDiagnosticsEnvelope,
  SupportRecoveryPlaybooksEnvelope,
} from '@banyone/contracts';

import { CurrentUser } from '../auth/current-user.decorator';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import { SupportGuard } from '../auth/support.guard';
import { SupportService } from './support.service';
import type { SupportBillingDiagnosticsEnvelope } from './support.service';

@UseGuards(FirebaseAuthGuard, BanyoneUserThrottlerGuard)
@SkipThrottle({ default: true })
@Controller('v1')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('support/job-diagnostics')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  getJobDiagnostics(
    @Query('jobId') jobId?: string,
  ): Promise<SupportJobDiagnosticsEnvelope> {
    return this.supportService.getJobDiagnostics({ jobId });
  }

  @Get('support/recovery-playbooks')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  getRecoveryPlaybooks(
    @Query('failureCategory') failureCategory?: string,
    @Query('reasonCode') reasonCode?: string,
  ): SupportRecoveryPlaybooksEnvelope {
    return this.supportService.getRecoveryPlaybooks({
      failureCategory,
      reasonCode,
    });
  }

  @Get('support/billing-diagnostics')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  getBillingDiagnostics(
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<SupportBillingDiagnosticsEnvelope> {
    return this.supportService.getBillingDiagnostics({
      userId,
      limit,
    });
  }

  @Get('support/quality-tier-comparison')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  getQualityTierComparison(): Promise<QualityTierComparisonEnvelope> {
    return this.supportService.getQualityTierComparison();
  }

  @Post('support/escalations')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  createEscalation(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: unknown,
  ): Promise<SupportEscalationEnvelope> {
    return this.supportService.createEscalation({
      actorUserId: user.uid,
      body,
    });
  }

  @Get('support/escalations/:escalationId')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  getEscalation(
    @Param('escalationId') escalationId: string,
  ): Promise<SupportEscalationEnvelope> {
    return this.supportService.getEscalationById(escalationId);
  }

  @Get('support/escalations')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  listEscalations(
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ): Promise<SupportEscalationListEnvelope> {
    return this.supportService.listEscalations({
      ...(jobId !== undefined ? { jobId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
  }

  @Patch('support/escalations/:escalationId')
  @UseGuards(SupportGuard)
  @SkipThrottle({ default: true })
  updateEscalation(
    @Param('escalationId') escalationId: string,
    @Body() body: unknown,
  ): Promise<SupportEscalationEnvelope> {
    return this.supportService.updateEscalationStatus({ escalationId, body });
  }
}
