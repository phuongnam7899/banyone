# Story 1.3: Pre-Submit Validation and Fixable Errors

Status: ready-for-dev

## Story

As a casual creator,
I want inline validation with exact failure reasons and fix guidance,
so that I can correct invalid inputs quickly and continue.

## Acceptance Criteria

1. **Given** the user has selected a source video and a reference image,
   **When** the app runs pre-submit validation,
   **Then** the UI shows specific, plain-language error details for every violated constraint (duration, video resolution, reference image resolution, and supported formats) before any submit action exists.

2. **And** for each shown error,
   **Then** the message includes a direct recovery action the user can take (e.g. “Pick a shorter video (<= X seconds)”, “Pick a smaller image (<= WxH)”, “Use an MP4 (H.264/AAC) video container” / “Use a JPG/PNG/HEIC image”).

3. **And** validation is field-linked:
   - video errors appear next to/under the `Source video` slot
   - image errors appear next to/under the `Reference image` slot
   - format errors clearly indicate whether they apply to the video slot, the image slot, or both.

4. **And** error copy is deterministic and consistent with the shared constraint source of truth:
   - constraint text must match the values from `packages/contracts/src/input-constraints.ts` (`MAX_SOURCE_VIDEO_DURATION_SEC`, `MAX_*_WIDTH_PX`, `MAX_*_HEIGHT_PX`, and supported format descriptors via `getCreateJobConstraintBullets()`).
   - error “max” values shown to users must come from those constants (no magic numbers in UI).

5. **And** the UI includes deterministic testing identifiers and accessibility:
   - each error text block and each recovery action button exposes stable `testID`s following `screen.element.action[.state]`
   - recovery actions use real buttons (or Pressable with accessibilityRole) and include screen-reader-friendly `accessibilityLabel`s.

## Tasks / Subtasks

- [ ] Extend input selection state to carry media metadata needed for validation (AC: 1, 4)
  - [ ] Update `apps/mobile/src/features/create-job/types/selection.ts` to add optional metadata fields for:
    - video: duration (sec), widthPx, heightPx, mimeType/type
    - image: widthPx, heightPx, mimeType/type
  - [ ] Update `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.ts` to store the new metadata alongside `uri` and `label` (keep existing behavior for re-pick/clear).
  - [ ] Update `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts` to capture `ImagePickerAsset` metadata from `expo-image-picker` (use these properties when available):
    - `duration` (video)
    - `width`/`height`
    - `mimeType` and/or `type`
    - fallback to parsing file extension from `fileName`/uri when `mimeType` is missing.
  - [ ] Update `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.test.ts` to cover metadata persistence and replacement semantics on re-pick.
  - [ ] Update any existing test mocks for `useJobInputSelection` (notably `create-job-screen.test.tsx`) so they compile with the expanded state type.

- [ ] Implement deterministic validation logic with exact failure reasons (AC: 1, 2, 4)
  - [ ] Add pure validation helpers (preferably in `packages/contracts`) that validate the selected media metadata against:
    - `MAX_SOURCE_VIDEO_DURATION_SEC`
    - `MAX_SOURCE_VIDEO_WIDTH_PX` / `MAX_SOURCE_VIDEO_HEIGHT_PX`
    - `MAX_REFERENCE_IMAGE_WIDTH_PX` / `MAX_REFERENCE_IMAGE_HEIGHT_PX`
    - `SUPPORTED_VIDEO_FORMAT_DESCRIPTORS` / `SUPPORTED_IMAGE_FORMAT_DESCRIPTORS`
  - [ ] The validation layer must return structured results for each slot, including:
    - `status`: `pending` | `valid` | `invalid-with-fix`
    - `violations`: list of violations, each with:
      - deterministic `code` (example: `INPUT_VIDEO_DURATION_EXCEEDS_MAX`, `INPUT_VIDEO_RESOLUTION_EXCEEDS_MAX`, `INPUT_IMAGE_RESOLUTION_EXCEEDS_MAX`, `INPUT_VIDEO_FORMAT_UNSUPPORTED`, `INPUT_IMAGE_FORMAT_UNSUPPORTED`, `INPUT_METADATA_UNAVAILABLE`)
      - `message`: exact plain-language explanation using shared constants
      - `fixAction`: plain-language recovery instruction
  - [ ] Ensure “missing metadata” is handled deterministically:
    - if required fields are missing to validate a constraint, return `invalid-with-fix` with code `INPUT_METADATA_UNAVAILABLE` and a recovery action to re-pick/use a supported file (no crashing, no silent acceptance).

- [ ] Create the reusable Input Compliance Checker UI (AC: 1, 2, 3, 5)
  - [ ] Add `apps/mobile/src/features/create-job/components/input-compliance-checker.tsx` (or similarly named) with these behaviors:
    - **Pending**: show when metadata is not yet available (e.g. before selection, or when metadata is missing)
    - **Valid**: show a compact success/“looks good” state (must still be accessible)
     - **Invalid-with-fix**: show field-linked error text + a direct recovery action button per affected slot
  - [ ] Field-linking:
    - video violations render under the video slot and include testIDs that clearly identify the video slot
    - image violations render under the image slot and include testIDs that clearly identify the image slot
  - [ ] Add deterministic `testID`s for:
    - the component container
    - each violation message block (per code)
    - each recovery action button (per code)
  - [ ] Accessibility:
    - error blocks are screen-reader accessible (no “color-only” states)
    - use `accessibilityLabel`s matching the user-visible message (or a clear equivalent)
    - avoid spinner-only feedback; prefer explicit short stage labels (“Validating…”, “Ready”, “Needs fix”).

- [ ] Integrate checker into Create Job screen (AC: 3)
  - [ ] Wire checker into `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` so it re-renders when selection metadata changes.
  - [ ] Place the checker immediately after the two media slots so errors appear “in context” before the next story’s submit flow.

- [ ] Add/extend tests for validator + component rendering (AC: 1, 2, 5)
  - [ ] Add unit tests for the pure validation helpers to verify:
    - exact messages include the shared max values
    - correct violation codes are returned for each constraint breach
    - metadata-missing path returns `INPUT_METADATA_UNAVAILABLE`
  - [ ] Add component tests using React Native Testing Library asserting:
    - pending state when video/image metadata is absent
    - invalid-with-fix state renders exact error message + recovery action button
    - `testID`s exist for error blocks and recovery actions
  - [ ] Update existing `create-job-screen.test.tsx` expectations to include new component `testID`(s).

- [ ] Quality gates (AC: 5)
  - [ ] Ensure repo root `npm run lint`, `npm run typecheck`, and `npm run test` pass after the type/test updates.

## Dev Notes

### Story Type and Scope Guardrails

- **In scope:** pre-submit inline validation + fix guidance for duration, resolution, and supported formats, using the same constraint source of truth as Story 1.2.
- **Out of scope for this story:** job submission endpoints, backend/API integration, storage upload, real-time lifecycle timeline, Firebase Auth/session, and async worker/inference execution (those come in later stories).

### Previous Story Intelligence (1.2)

- Story 1.2 already implemented:
  - the `create-job` screen with `ConstraintGuidance` (uses `getCreateJobConstraintBullets()`)
  - video/image slots via `MediaSlotPicker` and selection state via `useJobInputSelection()`
  - stable testIDs for the media slot pickers and requirement section.
- Do not duplicate constraint text in the UI. The exact “max” values must be derived from `packages/contracts/src/input-constraints.ts` so Story 1.3 never contradicts Story 1.2 guidance.

### Technical Requirements

- Use `expo-image-picker` selected asset metadata for validation without adding heavy new dependencies:
  - video duration via `asset.duration`
  - resolution via `asset.width` / `asset.height`
  - formats via `asset.mimeType` (and/or `asset.type`) with an extension fallback from `asset.fileName` / uri parsing.

### Architecture Compliance

- Follow the `Frontend Test Identity Convention` for deterministic `testID`s:
  - `screen.element.action[.state]`
  - never derive test IDs from visible text.
- Keep validation logic pure and reusable (validator functions should not rely on React Native component state).

### Library / Framework Requirements

- Must remain compatible with Expo SDK 55:
  - use `expo install` for any new dependencies required by validation (if any). Prefer using the already-returned `expo-image-picker` metadata instead of new packages.

### File Structure Requirements

- Add new feature code under `apps/mobile/src/features/create-job/`:
  - `components/input-compliance-checker.tsx`
  - `validation/validate-job-inputs.ts` (optional) or helper functions under existing `hooks/` if consistent with repo patterns
- Prefer putting validation helpers in `packages/contracts` so mobile and future backend validation can share the same constants/messages.

### Testing Requirements

- Unit tests:
  - pure validator returns deterministic violation codes + messages
- Component tests:
  - pending/valid/invalid-with-fix rendering
  - field-linked error blocks and recovery actions
  - deterministic `testID`s
- Avoid network/filesystem dependencies; tests should construct fake selection metadata.

### Latest Technical Information

- `expo-image-picker` returns `ImagePickerAsset` metadata including:
  - `duration` (video)
  - `width` / `height`
  - `mimeType` and/or `type`
  - `fileName` (native/web differences apply; extension fallback is required).
- Sources:
  - [Expo ImagePicker docs - ImagePickerAsset fields](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker)

### Project Structure Notes

- `CreateJobScreen` currently renders:
  - `ConstraintGuidance`
  - `MediaSlotPicker` for video + image
- Story 1.3 should insert the compliance checker without rearranging unrelated UI structure.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.3 / Acceptance Criteria and UX-DR mapping]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR8 Input Compliance Checker states]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend Test Identity Convention, deterministic error taxonomy]
- [Source: `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` — current create screen structure]
- [Source: `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts` — current picker integration]
- [Source: `apps/mobile/src/features/create-job/components/constraint-guidance.tsx` — constraint bullets derived from contracts]
- [Source: `packages/contracts/src/input-constraints.ts` — MVP constraint constants and supported format descriptors]

## Dev Agent Record

### Agent Model Used

GPT-5.4 Nano

### Debug Log References

- None recorded for Story 1.3 yet.

### Completion Notes List

- None yet (story is `ready-for-dev`).

### File List

- Expected new/updated files:
  - `packages/contracts/src/input-constraints.ts` (extend with validation helpers + exports, if chosen)
  - `packages/contracts/src/index.ts` (export new validation helpers/types)
  - `apps/mobile/src/features/create-job/types/selection.ts`
  - `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.ts`
  - `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts`
  - `apps/mobile/src/features/create-job/components/input-compliance-checker.tsx`
  - `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
  - `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.test.ts` (update)
  - `apps/mobile/src/features/create-job/screens/create-job-screen.test.tsx` (update)
  - new unit tests for validation helpers
  - new component tests for input compliance checker

## Change Log

- 2026-03-25: Story 1.3 generated via `/bmad-create-story` — comprehensive developer guide created and sprint status updated to `ready-for-dev`.

