export interface HealthCheckContract {
  status: "ok";
}

export {
  getCreateJobConstraintBullets,
  MAX_REFERENCE_IMAGE_HEIGHT_PX,
  MAX_REFERENCE_IMAGE_WIDTH_PX,
  MAX_SOURCE_VIDEO_DURATION_SEC,
  MAX_SOURCE_VIDEO_HEIGHT_PX,
  MAX_SOURCE_VIDEO_WIDTH_PX,
  SUPPORTED_IMAGE_FORMAT_DESCRIPTORS,
  SUPPORTED_VIDEO_FORMAT_DESCRIPTORS,
} from "./input-constraints.js";

export type { ConstraintBullet } from "./input-constraints.js";

export {
  validateImageInputCompliance,
  validateJobInputCompliance,
  validateVideoInputCompliance,
} from "./input-validation.js";

export type {
  ImageValidationInput,
  InputViolation,
  InputViolationCode,
  JobInputValidationResult,
  MediaValidationStatus,
  SlotValidationResult,
  VideoValidationInput,
} from "./input-validation.js";

export type { PreviewExportEvent, PreviewExportEventName } from './telemetry.js';
