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

export type {
  CreateJobDraftTelemetryEvent,
  CreateJobDraftTelemetryEventName,
  PreviewExportEvent,
  PreviewExportEventName,
} from './telemetry.js';

export {
  CREATE_JOB_DRAFT_SCHEMA_VERSION,
  isCreateJobDraftV1,
} from './create-job-draft.js';

export type { CreateJobDraftSelectionV1, CreateJobDraftV1 } from './create-job-draft.js';

export {
  BANYONE_TEST_FIREBASE_ID_TOKEN,
} from './api-auth.js';

export type {
  ApiAuthErrorCode,
  ApiAuthErrorEnvelope,
} from './api-auth.js';

export type {
  GenerationJobFailureMetadata as HistoryJobFailureMetadata,
  GenerationJobHistoryDetailEnvelope,
  GenerationJobHistoryDetailPayload,
  GenerationJobHistoryListEnvelope,
  GenerationJobHistoryListItem,
  GenerationJobHistoryListPayload,
  GenerationJobStatus as HistoryJobStatus,
} from './api-history.js';

export {
  API_RATE_LIMIT_ERROR_CODE,
  isApiRateLimitDetails,
} from './api-rate-limit.js';

export type {
  ApiRateLimitErrorCode,
  ApiRateLimitErrorDetails,
  ApiRateLimitScope,
} from './api-rate-limit.js';

export {
  BANYONE_MOBILE_URL_SCHEME,
  DEFAULT_NOTIFICATION_PREFERENCES,
  JOB_LIFECYCLE_DEEP_LINK_SCREEN,
  JOB_LIFECYCLE_NOTIFICATION_KINDS,
  buildJobHistoryDetailDeepLink,
  buildJobLifecyclePushDataFields,
  isJobLifecycleNotificationKind,
  jobLifecyclePushDataToFcmData,
} from './push-notifications.js';

export type {
  JobLifecycleNotificationKind,
  JobLifecycleNotificationScreenHint,
  JobLifecyclePushDataFields,
  NotificationLifecyclePreferences,
  NotificationPreferences,
} from './push-notifications.js';

export { DISCLOSURE_REQUIRED_ERROR_CODE } from './synthetic-media-disclosure.js';

export type {
  DisclosureRequiredErrorCode,
  RecordSyntheticMediaDisclosureRequest,
  SyntheticMediaDisclosureAcceptance,
  SyntheticMediaDisclosureStatus,
} from './synthetic-media-disclosure.js';
