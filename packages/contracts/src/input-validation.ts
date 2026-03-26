import {
  MAX_REFERENCE_IMAGE_HEIGHT_PX,
  MAX_REFERENCE_IMAGE_WIDTH_PX,
  MAX_SOURCE_VIDEO_DURATION_SEC,
  MAX_SOURCE_VIDEO_HEIGHT_PX,
  MAX_SOURCE_VIDEO_WIDTH_PX,
  getCreateJobConstraintBullets,
  SUPPORTED_IMAGE_FORMAT_DESCRIPTORS,
  SUPPORTED_VIDEO_FORMAT_DESCRIPTORS,
} from './input-constraints.js';

export type MediaValidationStatus = 'pending' | 'valid' | 'invalid-with-fix';

export type InputViolationCode =
  | 'INPUT_VIDEO_DURATION_EXCEEDS_MAX'
  | 'INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX'
  | 'INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX'
  | 'INPUT_VIDEO_FORMAT_UNSUPPORTED'
  | 'INPUT_IMAGE_FORMAT_UNSUPPORTED'
  | 'INPUT_METADATA_UNAVAILABLE';

export type InputViolation = {
  code: InputViolationCode;
  message: string;
  fixAction: string;
};

export type SlotValidationResult = {
  status: MediaValidationStatus;
  violations: InputViolation[];
};

export type VideoValidationInput = {
  uri: string | null;
  durationSec: number | null;
  widthPx: number | null;
  heightPx: number | null;
  mimeType: string | null;
};

export type ImageValidationInput = {
  uri: string | null;
  widthPx: number | null;
  heightPx: number | null;
  mimeType: string | null;
};

export type JobInputValidationResult = {
  video: SlotValidationResult;
  image: SlotValidationResult;
};

const formatsConstraintText = (() => {
  const bullet = getCreateJobConstraintBullets().find((b) => b.key === 'formats');
  return bullet?.body ?? '';
})();

function parseMimeCandidates(mimeType: string | null): { candidates: string[]; isMetadataAvailable: boolean } {
  if (!mimeType) return { candidates: [], isMetadataAvailable: false };

  const trimmed = mimeType.trim();
  if (!trimmed) return { candidates: [], isMetadataAvailable: false };

  // Handle comma-separated alternatives and ignore MIME params.
  const parts = trimmed.split(',');
  const candidates: string[] = [];

  let hadNonEmptyToken = false;
  for (const part of parts) {
    const withoutParams = part.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!withoutParams) continue;
    hadNonEmptyToken = true;

    // A valid MIME token must have a type/subtype shape.
    if (!withoutParams.includes('/')) continue;
    candidates.push(withoutParams);
  }

  return { candidates, isMetadataAvailable: hadNonEmptyToken && candidates.length > 0 };
}

function isFinitePositive(value: number | null): boolean {
  if (value == null) return false;
  if (!Number.isFinite(value)) return false;
  return value > 0;
}

function metadataUnavailableViolation(slotLabel: 'source video' | 'reference image'): InputViolation {
  return {
    code: 'INPUT_METADATA_UNAVAILABLE',
    message: `We couldn't read the required metadata from your selected ${slotLabel}.`,
    fixAction: `Pick the ${slotLabel} again (use a supported file from your library).`,
  };
}

export function validateVideoInputCompliance(input: VideoValidationInput): SlotValidationResult {
  if (!input.uri) {
    return { status: 'pending', violations: [] };
  }

  const violations: InputViolation[] = [];

  const durationMissing = !isFinitePositive(input.durationSec);
  const resolutionMissing = !isFinitePositive(input.widthPx) || !isFinitePositive(input.heightPx);
  const mime = parseMimeCandidates(input.mimeType);
  const formatMissing = !mime.isMetadataAvailable;
  const anyMetadataMissing = durationMissing || resolutionMissing || formatMissing;

  // Deterministic ordering: metadata-unavailable first, then duration/resolution/format.
  if (anyMetadataMissing) {
    violations.push(metadataUnavailableViolation('source video'));
  }

  if (!durationMissing && input.durationSec! > MAX_SOURCE_VIDEO_DURATION_SEC) {
    violations.push({
      code: 'INPUT_VIDEO_DURATION_EXCEEDS_MAX',
      message: `Source video duration must be <= ${MAX_SOURCE_VIDEO_DURATION_SEC} seconds.`,
      fixAction: `Pick a shorter video (<= ${MAX_SOURCE_VIDEO_DURATION_SEC} seconds).`,
    });
  }

  if (!resolutionMissing && (input.widthPx! > MAX_SOURCE_VIDEO_WIDTH_PX || input.heightPx! > MAX_SOURCE_VIDEO_HEIGHT_PX)) {
    violations.push({
      code: 'INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX',
      message: `Source video resolution must be <= ${MAX_SOURCE_VIDEO_WIDTH_PX}×${MAX_SOURCE_VIDEO_HEIGHT_PX} pixels.`,
      fixAction: `Pick a smaller video (<= ${MAX_SOURCE_VIDEO_WIDTH_PX}×${MAX_SOURCE_VIDEO_HEIGHT_PX} pixels).`,
    });
  }

  if (!formatMissing) {
    const supported = SUPPORTED_VIDEO_FORMAT_DESCRIPTORS.some((d) =>
      mime.candidates.some((c) => d.mimeHints.map((s) => s.toLowerCase()).includes(c.toLowerCase())),
    );

    if (!supported) {
      violations.push({
        code: 'INPUT_VIDEO_FORMAT_UNSUPPORTED',
        message: `Source video format is not supported. Supported: ${formatsConstraintText}`,
        fixAction: `Use a supported video format. Supported: ${formatsConstraintText}`,
      });
    }
  }

  return violations.length === 0
    ? { status: 'valid', violations: [] }
    : { status: 'invalid-with-fix', violations };
}

export function validateImageInputCompliance(input: ImageValidationInput): SlotValidationResult {
  if (!input.uri) {
    return { status: 'pending', violations: [] };
  }

  const violations: InputViolation[] = [];

  const resolutionMissing = !isFinitePositive(input.widthPx) || !isFinitePositive(input.heightPx);
  const mime = parseMimeCandidates(input.mimeType);
  const formatMissing = !mime.isMetadataAvailable;
  const anyMetadataMissing = resolutionMissing || formatMissing;

  if (anyMetadataMissing) {
    violations.push(metadataUnavailableViolation('reference image'));
  }

  if (!resolutionMissing && (input.widthPx! > MAX_REFERENCE_IMAGE_WIDTH_PX || input.heightPx! > MAX_REFERENCE_IMAGE_HEIGHT_PX)) {
    violations.push({
      code: 'INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX',
      message: `Reference image resolution must be <= ${MAX_REFERENCE_IMAGE_WIDTH_PX}×${MAX_REFERENCE_IMAGE_HEIGHT_PX} pixels.`,
      fixAction: `Pick a smaller image (<= ${MAX_REFERENCE_IMAGE_WIDTH_PX}×${MAX_REFERENCE_IMAGE_HEIGHT_PX} pixels).`,
    });
  }

  if (!formatMissing) {
    const supported = SUPPORTED_IMAGE_FORMAT_DESCRIPTORS.some((d) =>
      mime.candidates.some((c) => d.mimeHints.map((s) => s.toLowerCase()).includes(c.toLowerCase())),
    );

    if (!supported) {
      violations.push({
        code: 'INPUT_IMAGE_FORMAT_UNSUPPORTED',
        message: `Reference image format is not supported. Supported: ${formatsConstraintText}`,
        fixAction: `Use a supported image format. Supported: ${formatsConstraintText}`,
      });
    }
  }

  return violations.length === 0
    ? { status: 'valid', violations: [] }
    : { status: 'invalid-with-fix', violations };
}

export function validateJobInputCompliance(input: {
  video: VideoValidationInput;
  image: ImageValidationInput;
}): JobInputValidationResult {
  return {
    video: validateVideoInputCompliance(input.video),
    image: validateImageInputCompliance(input.image),
  };
}

