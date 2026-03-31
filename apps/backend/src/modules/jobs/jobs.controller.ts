import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { CreateGenerationJobRequestBody } from './dto/create-generation-job.request';
import { CurrentUser } from '../auth/current-user.decorator';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import type {
  GenerationJobHistoryListEnvelope,
  GenerationJobEnvelope,
  GenerationJobExportEnvelope,
  GenerationJobPreviewEnvelope,
  GenerationJobStatusEnvelope,
} from './jobs.types';
import { JobsService } from './jobs.service';

@UseGuards(FirebaseAuthGuard, BanyoneUserThrottlerGuard)
@SkipThrottle({ default: true })
@Controller('v1')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /**
   * OpenAPI (inline minimal docs):
   * - POST /v1/generation-jobs
   * - Headers: x-banyone-idempotency-key (string)
   * - Body: { video: {...}, image: {...} }
   * - 200: { data: { jobId: string, status: 'queued' }, error: null }
   * - 4xx: { data: null, error: { code, message, retryable, details?, traceId } }
   */
  @Post('generation-jobs')
  @SkipThrottle({ default: false })
  async createGenerationJob(
    @CurrentUser() user: BanyoneAuthUser,
    @Body() body: CreateGenerationJobRequestBody,
    @Headers('x-banyone-idempotency-key') idempotencyKey?: string,
  ): Promise<GenerationJobEnvelope> {
    return this.jobsService.createGenerationJob({
      userId: user.uid,
      body,
      idempotencyKeyHeader: idempotencyKey,
    });
  }

  /**
   * Returns canonical job lifecycle payload for the status timeline.
   *
   * Success:
   * - { data, meta?, error: null }
   * Error:
   * - { data: null, error: { code, message, retryable, details?, traceId }, meta? }
   */
  @Get('generation-jobs')
  listGenerationJobs(
    @CurrentUser() user: BanyoneAuthUser,
  ): GenerationJobHistoryListEnvelope {
    return this.jobsService.listGenerationJobs({ userId: user.uid });
  }

  @Get('generation-jobs/:id')
  getGenerationJobStatus(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('id') id: string,
  ): GenerationJobStatusEnvelope {
    return this.jobsService.getGenerationJobStatus({
      userId: user.uid,
      jobId: id,
    });
  }

  @Get('generation-jobs/:id/preview')
  getGenerationJobPreview(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('id') id: string,
  ): GenerationJobPreviewEnvelope {
    return this.jobsService.getGenerationJobPreview({
      userId: user.uid,
      jobId: id,
    });
  }

  @Post('generation-jobs/:id/export')
  @SkipThrottle({ default: false })
  createGenerationJobExport(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('id') id: string,
  ): GenerationJobExportEnvelope {
    return this.jobsService.createGenerationJobExport({
      userId: user.uid,
      jobId: id,
    });
  }
}
