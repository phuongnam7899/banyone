/**
 * MVP input limits for source video + reference image (Story 1.2 / prep for 1.3 validation).
 *
 * Stakeholder decisions still needed for final go-live numbers:
 * - MAX_SOURCE_VIDEO_DURATION_SEC — confirm max clip length (e.g. 60 vs 120 vs 300).
 * - MAX_SOURCE_VIDEO_WIDTH_PX / HEIGHT_PX — confirm pixel caps or switch to tier labels (720p/1080p).
 * - ALLOWED_REFERENCE_IMAGE_* — confirm max still resolution and whether HEIC must stay in/out.
 */
export const MAX_SOURCE_VIDEO_DURATION_SEC = 120;

export const MAX_SOURCE_VIDEO_WIDTH_PX = 1920;
export const MAX_SOURCE_VIDEO_HEIGHT_PX = 1080;

export const MAX_REFERENCE_IMAGE_WIDTH_PX = 4096;
export const MAX_REFERENCE_IMAGE_HEIGHT_PX = 4096;

/** Product-facing labels for video container/codec families (FR10). */
export const SUPPORTED_VIDEO_FORMAT_DESCRIPTORS = [
  {
    id: "mp4-h264",
    headline: "Video",
    detail:
      "MP4 or QuickTime-style containers with H.264/AVC video (common .mp4 / .m4v files).",
    extensionHints: [".mp4", ".m4v", ".mov"],
    mimeHints: ["video/mp4", "video/quicktime"],
  },
  {
    id: "webm-vp9-optional",
    headline: "WebM (when supported)",
    detail: "VP8/VP9 in .webm may be supported on some devices; prefer MP4 for best results.",
    extensionHints: [".webm"],
    mimeHints: ["video/webm"],
  },
] as const;

/** Product-facing labels for still/reference images. */
export const SUPPORTED_IMAGE_FORMAT_DESCRIPTORS = [
  {
    id: "jpeg-png-heic",
    headline: "Images",
    detail: "JPEG, PNG, or HEIC stills from your photo library.",
    extensionHints: [".jpg", ".jpeg", ".png", ".heic", ".webp"],
    mimeHints: ["image/jpeg", "image/png", "image/heic", "image/webp"],
  },
] as const;

export type ConstraintBullet = {
  key: string;
  title: string;
  body: string;
};

/** Plain-language lines derived from constants — keep Story 1.3 validators in sync with this source. */
export function getCreateJobConstraintBullets(): ConstraintBullet[] {
  return [
    {
      key: "duration",
      title: "Source video length",
      body: `Up to ${MAX_SOURCE_VIDEO_DURATION_SEC} seconds per clip (longer files will need trimming in a later step).`,
    },
    {
      key: "video-size",
      title: "Source video resolution",
      body: `Up to ${MAX_SOURCE_VIDEO_WIDTH_PX}×${MAX_SOURCE_VIDEO_HEIGHT_PX} pixels.`,
    },
    {
      key: "image-size",
      title: "Reference image resolution",
      body: `Up to ${MAX_REFERENCE_IMAGE_WIDTH_PX}×${MAX_REFERENCE_IMAGE_HEIGHT_PX} pixels.`,
    },
    {
      key: "formats",
      title: "Formats",
      body: [
        ...SUPPORTED_VIDEO_FORMAT_DESCRIPTORS.map((d) => `${d.headline}: ${d.detail}`),
        ...SUPPORTED_IMAGE_FORMAT_DESCRIPTORS.map((d) => `${d.headline}: ${d.detail}`),
      ].join(" "),
    },
  ];
}
