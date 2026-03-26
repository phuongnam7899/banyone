export type CreateGenerationJobMediaInput = {
  uri: string | null;
  durationSec: number | null;
  widthPx: number | null;
  heightPx: number | null;
  mimeType: string | null;
};

export type CreateGenerationJobRequestBody = {
  idempotencyKey?: string;
  video: CreateGenerationJobMediaInput;
  image: {
    uri: string | null;
    widthPx: number | null;
    heightPx: number | null;
    mimeType: string | null;
  };
};
