import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import type { CreateGenerationJobRequestBody } from './dto/create-generation-job.request';
import type {
  GenerationJobEnvelope,
  GenerationJobStatusEnvelope,
} from './jobs.types';
import { JobsService } from './jobs.service';

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
  async createGenerationJob(
    @Body() body: CreateGenerationJobRequestBody,
    @Headers('x-banyone-idempotency-key') idempotencyKey?: string,
  ): Promise<GenerationJobEnvelope> {
    return this.jobsService.createGenerationJob({
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
  @Get('generation-jobs/:id')
  getGenerationJobStatus(
    @Param('id') id: string,
  ): Promise<GenerationJobStatusEnvelope> {
    return this.jobsService.getGenerationJobStatus({ jobId: id });
  }
}
