import { Injectable } from '@nestjs/common';
import Replicate from 'replicate';

type ReplicatePredictionStatus =
  | 'starting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

type ReplicateCreateParams = {
  /** Video bytes — Replicate SDK uploads these like ai_video_demo (`Buffer` on `video` input). */
  video: Buffer;
  /** Character reference image bytes (local upload); same SDK file-input pattern. */
  characterImage: Buffer;
  prompt?: string;
};

type ReplicateCreateResult = {
  predictionId: string;
  status: ReplicatePredictionStatus;
};

type ReplicatePollResult = {
  status: ReplicatePredictionStatus;
  outputUrl?: string;
  errorMessage?: string;
};

function parseOptionalJsonObject(input: string | undefined): Record<string, unknown> {
  if (!input) return {};
  try {
    const parsed = JSON.parse(input) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function resolvePredictionTarget(model: string): { model?: string; version?: string } {
  const normalized = model.trim();
  const [base, maybeVersion] = normalized.split(':');
  if (maybeVersion && /^[a-f0-9]{64}$/i.test(maybeVersion)) {
    return { version: maybeVersion };
  }
  return { model: base };
}

function normalizeOutputUrl(output: unknown): string | undefined {
  if (typeof output === 'string' && output.trim().length > 0) return output.trim();
  if (Array.isArray(output)) {
    for (const row of output) {
      const nested = normalizeOutputUrl(row);
      if (nested) return nested;
    }
    return undefined;
  }
  if (typeof output === 'object' && output !== null) {
    const asRecord = output as Record<string, unknown>;
    if (typeof asRecord.url === 'string' && asRecord.url.trim().length > 0) {
      return asRecord.url.trim();
    }
  }
  return undefined;
}

@Injectable()
export class ReplicateGenerationProvider {
  private readonly apiToken = (process.env.REPLICATE_API_TOKEN ?? '').trim();
  private readonly model = (process.env.REPLICATE_MODEL ?? '').trim();
  private readonly videoInputKey =
    (process.env.REPLICATE_VIDEO_INPUT_KEY ?? 'video').trim() || 'video';
  private readonly characterImageInputKey =
    (process.env.REPLICATE_CHARACTER_IMAGE_KEY ?? 'character_image').trim() ||
    'character_image';
  private readonly promptInputKey =
    (process.env.REPLICATE_PROMPT_INPUT_KEY ?? 'prompt').trim() || 'prompt';
  private readonly extraInput = parseOptionalJsonObject(
    process.env.REPLICATE_EXTRA_INPUT_JSON,
  );

  private getClient(): Replicate {
    return new Replicate({ auth: this.apiToken });
  }

  getConfiguredModel(): string {
    return this.model;
  }

  isEnabled(): boolean {
    return this.apiToken.length > 0 && this.model.length > 0;
  }

  async createPrediction(params: ReplicateCreateParams): Promise<ReplicateCreateResult> {
    const replicate = this.getClient();
    const target = resolvePredictionTarget(this.model);
    const input: Record<string, unknown> = {
      ...this.extraInput,
      [this.videoInputKey]: params.video,
      [this.characterImageInputKey]: params.characterImage,
    };
    if (params.prompt && params.prompt.trim().length > 0) {
      input[this.promptInputKey] = params.prompt.trim();
    }
    const inputObj = input as object;
    const prediction =
      'version' in target && target.version
        ? await replicate.predictions.create({
            version: target.version,
            input: inputObj,
          })
        : await replicate.predictions.create({
            model: target.model as string,
            input: inputObj,
          });
    return {
      predictionId: prediction.id,
      status: prediction.status as ReplicatePredictionStatus,
    };
  }

  async getPrediction(predictionId: string): Promise<ReplicatePollResult> {
    const replicate = this.getClient();
    const prediction = await replicate.predictions.get(predictionId);
    const err = prediction.error;
    return {
      status: prediction.status as ReplicatePredictionStatus,
      outputUrl: normalizeOutputUrl(prediction.output),
      errorMessage:
        typeof err === 'string' && err.trim().length > 0 ? err : undefined,
    };
  }
}
