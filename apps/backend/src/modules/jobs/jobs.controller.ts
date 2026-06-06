import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { CreateGenerationJobRequestBody } from './dto/create-generation-job.request';
import { CurrentUser } from '../auth/current-user.decorator';
import { BanyoneUserThrottlerGuard } from '../auth/banyone-user-throttler.guard';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { BanyoneAuthUser } from '../auth/banyone-user.types';
import type {
  GenerationJobHistoryListEnvelope,
  GenerationJobEnvelope,
  GenerationJobExportEnvelope,
  GenerationJobCreditsEnvelope,
  GenerationJobPreviewEnvelope,
  GenerationJobStatusEnvelope,
} from './jobs.types';
import { JobsService } from './jobs.service';
import { JobMediaAssetsService } from './job-media-assets.service';

type UploadedBinaryFile = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
};

@UseGuards(FirebaseAuthGuard, BanyoneUserThrottlerGuard)
@SkipThrottle({ default: true })
@Controller('v1')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobMediaAssets: JobMediaAssetsService,
  ) {}

  /**
   * OpenAPI (inline minimal docs):
   * - POST /v1/generation-jobs
   * - Headers: x-banyone-idempotency-key (string)
   * - Body: { video: {...}, image: {...} }
   * - 200: { data: { jobId: string, status: 'queued' }, error: null }
   * - 4xx: { data: null, error: { code, message, retryable, details?, traceId } }
   *   - Policy block after validation: code `POLICY_VIOLATION`, retryable false,
   *     details `{ policyCode: 'STORAGE_URI_BLOCKED' }` (see @banyone/contracts).
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

  @Get('generation-jobs/credits')
  getGenerationCredits(
    @CurrentUser() user: BanyoneAuthUser,
  ): Promise<GenerationJobCreditsEnvelope> {
    return this.jobsService.getGenerationCredits({ userId: user.uid });
  }

  @Post('generation-jobs/assets')
  @SkipThrottle({ default: false })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadGenerationJobAsset(
    @CurrentUser() user: BanyoneAuthUser,
    @Body('slot') slot: 'video' | 'image',
    @UploadedFile() fileRaw?: unknown,
  ): Promise<{
    data: {
      slot: 'video' | 'image';
      assetUrl: string;
      mimeType: string | null;
      sizeBytes: number;
    };
    error: null;
  }> {
    if (slot !== 'video' && slot !== 'image') {
      throw new BadRequestException('slot must be video or image');
    }
    const file = (fileRaw ?? null) as UploadedBinaryFile | null;
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.byteLength === 0) {
      throw new BadRequestException('file is required');
    }
    if (
      file.buffer.byteLength > this.jobMediaAssets.getMaxUploadSizeBytes()
    ) {
      throw new BadRequestException('file too large');
    }
    const mimeType =
      typeof file.mimetype === 'string'
        ? file.mimetype
        : 'application/octet-stream';
    if (slot === 'video' && !mimeType.startsWith('video/')) {
      throw new BadRequestException('video slot requires a video file');
    }
    if (slot === 'image' && !mimeType.startsWith('image/')) {
      throw new BadRequestException('image slot requires an image file');
    }
    const stored = await this.jobMediaAssets.persistUpload({
      userId: user.uid,
      slot,
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType,
    });
    return {
      data: {
        slot,
        assetUrl: stored.assetUrl,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
      error: null,
    };
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
  ): Promise<GenerationJobHistoryListEnvelope> {
    return this.jobsService.listGenerationJobs({ userId: user.uid });
  }

  @Get('generation-jobs/:id')
  getGenerationJobStatus(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('id') id: string,
  ): Promise<GenerationJobStatusEnvelope> | GenerationJobStatusEnvelope {
    return this.jobsService.getGenerationJobStatus({
      userId: user.uid,
      jobId: id,
    });
  }

  @Get('generation-jobs/:id/preview')
  getGenerationJobPreview(
    @CurrentUser() user: BanyoneAuthUser,
    @Param('id') id: string,
  ): Promise<GenerationJobPreviewEnvelope> {
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
  ): Promise<GenerationJobExportEnvelope> {
    return this.jobsService.createGenerationJobExport({
      userId: user.uid,
      jobId: id,
    });
  }
}
