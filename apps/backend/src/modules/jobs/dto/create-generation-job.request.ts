export type CreateGenerationJobMediaInput = {
  uri: string | null;
  durationSec: number | null;
  widthPx: number | null;
  heightPx: number | null;
  mimeType: string | null;
};

export type CreateGenerationJobRequestBody = {
  idempotencyKey?: string;
  /** Product quality tier for metrics segmentation; defaults server-side when omitted. */
  qualityTier?: number;
  prompt?: string;
  video: CreateGenerationJobMediaInput;
  image: {
    uri: string | null;
    widthPx: number | null;
    heightPx: number | null;
    mimeType: string | null;
  };
};
