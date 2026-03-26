export type CreateGenerationJobRequestBody = {
  video: {
    uri: string | null;
    durationSec: number | null;
    widthPx: number | null;
    heightPx: number | null;
    mimeType: string | null;
  };
  image: {
    uri: string | null;
    widthPx: number | null;
    heightPx: number | null;
    mimeType: string | null;
  };
};

