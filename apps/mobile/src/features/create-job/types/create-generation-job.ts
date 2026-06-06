export type CreateGenerationJobRequestBody = {
  /** Segments metrics (Story 5.2); defaults server-side when omitted. */
  qualityTier?: number;
  prompt?: string;
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

