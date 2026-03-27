# Story 1.6: Preview, Export, and Native Share

Status: review

## Story

As a casual creator,  
I want to preview output and complete export/share in minimal taps,  
so that I can reach first-success quickly.

## Acceptance Criteria

1. **Given** a job is in `ready` state,  
   **When** I open the result screen,  
   **Then** I can preview output and execute one-tap export.
2. **And** I can invoke native share after export completes.
3. **And** if preview loading fails, I receive a deterministic error message with retry guidance and traceable error code.
4. **And** if export fails, I receive an actionable recovery path without losing the ready output state.

**Verification Note:** Validate failure-path UX with deterministic error fixtures and confirm recovery without state loss.

## Tasks / Subtasks

- [x] Mobile: implement reusable preview/export surface and wire from ready status flow (AC: 1, 2)
  - [x] Add a `preview-export` feature slice under `apps/mobile/src/features/preview-export/` with `screens`, `components`, `hooks`, `services`, and `types`.
  - [x] Build a result screen/component with explicit states: `loading`, `ready`, `failed-preview` (no spinner-only long-running state).
  - [x] Ensure one dominant primary CTA for export and a secondary CTA for share after export success.

- [x] Backend: expose deterministic preview and export endpoints/contracts (AC: 1, 3, 4)
  - [x] Add/extend jobs endpoints under `/v1` to fetch ready-result preview metadata and trigger export/save preparation using canonical response envelopes.
  - [x] Return structured errors (`code`, `message`, `retryable`, `details?`, `traceId`) for preview and export failure paths.
  - [x] Keep lifecycle invariants intact (`queued -> processing -> ready|failed`); preview/export must not introduce new lifecycle states.

- [x] Mobile: export to local media library with platform-safe permission handling (AC: 1, 4)
  - [x] Use `expo-media-library` save flow (`saveToLibraryAsync`) on local `file:///` output URIs with proper permission checks.
  - [x] Request only required write/save permissions and show actionable fallback when permission is denied.
  - [x] Keep ready output state recoverable after export error (no user progress loss).

- [x] Mobile: native share integration after successful export (AC: 2)
  - [x] Use `expo-sharing` with `Sharing.isAvailableAsync()` gating before opening share sheet.
  - [x] Pass correct MIME type (`video/mp4` where applicable) and deterministic UX when sharing is unavailable.
  - [x] Enable share CTA only when an exported local file is available.

- [x] Error and recovery UX: deterministic, actionable, and traceable (AC: 3, 4)
  - [x] Map backend error taxonomy into plain-language user messages plus concrete next action.
  - [x] Display stable, support-traceable error code in preview/export failure UI.
  - [x] Provide retry actions that reuse existing submission/status patterns instead of creating duplicate flows.

- [x] Analytics/telemetry: instrument first-success outcomes and failures (AC: 1, 2, 3, 4)
  - [x] Emit client events for `preview_viewed`, `export_started`, `export_succeeded`, `export_failed`, `share_opened`, `share_completed|dismissed`.
  - [x] Keep event shape aligned with `packages/contracts` and existing telemetry layer conventions.
  - [x] Add assertions for first-export funnel and export reliability (supports Epic 5 downstream metrics).

- [x] Testing and quality gates (AC: 1, 2, 3, 4)
  - [x] Mobile tests for preview state rendering, one-tap export path, share gating, and failure recovery without state loss.
  - [x] Backend tests for preview/export envelopes, deterministic error codes, and lifecycle invariant safety.
  - [x] Add stable `testID` values for all new interactive elements:
    - `job-result.preview.root`
    - `job-result.preview.video`
    - `job-result.export.button`
    - `job-result.share.button`
    - `job-result.retry.button`
    - `job-result.error.code`

## Dev Notes

### Story Scope and Dependency Guardrails

- This story starts after Story 1.5 and focuses only on `ready` result handling: preview, export, and share.
- Do not expand to draft persistence/recovery across app restarts (Story 1.7 scope).
- Keep status authority in backend status endpoints; push remains assistive and not source of truth.

### Previous Story Intelligence (Story 1.5)

- Story 1.5 already established canonical lifecycle timeline UI, retryability metadata, and polling behavior.
- Reuse `jobs` module API patterns and canonical success/error envelope; avoid parallel endpoint schemas.
- Reuse existing `create-job` and `job-status` hooks where possible to avoid duplicate state logic.
- Continue deterministic `testID` conventions used in Story 1.5 for stable automation selectors.

### Architecture Compliance (Must Follow)

- API stays REST-first under `/v1`, with contract-first DTO/error schema alignment to `packages/contracts`.
- Backend lifecycle stays canonical (`queued -> processing -> ready|failed`), with no extra transitional states for export/share.
- Mobile feature structure remains feature-scoped (`features/<feature>/screens|components|hooks|services|types`).
- Screens/components must not call Firebase SDK directly; use infra/service boundaries.

### Technical Requirements

- Preview load must be deterministic and show explicit stage labels (`loading`, `ready`, `failed-preview`) with actionable copy.
- Export must target local device library, support permission-denied handling, and keep the `ready` artifact recoverable.
- Share must launch native share sheet only when available and only after exported local file exists.
- Error UX must display deterministic code + plain-language guidance + next action (retry or alternative path).

### File Structure Notes

- Mobile likely touch points:
  - `apps/mobile/src/features/preview-export/screens/*`
  - `apps/mobile/src/features/preview-export/components/*`
  - `apps/mobile/src/features/preview-export/hooks/*`
  - `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` (navigation handoff from ready state)
  - `apps/mobile/src/features/job-status/*` (integration with status completion)
- Backend likely touch points:
  - `apps/backend/src/modules/jobs/*` (result metadata + export trigger contracts)
  - `apps/backend/src/common/errors/*` (deterministic code mapping if additions needed)
- Shared contracts:
  - `packages/contracts/src/*` (result/export/share contract and error/event schema updates)

### Library / Framework Requirements

- Expo SDK baseline remains 55.
- `expo-media-library`:
  - `saveToLibraryAsync(localUri)` requires local file URI with extension (`file:///` on Android).
  - Request permissions explicitly via `requestPermissionsAsync` / `usePermissions` before save.
- `expo-sharing`:
  - Gate with `Sharing.isAvailableAsync()` before `shareAsync`.
  - Use local file URL and suitable MIME type for Android intent handling.
  - Web limitations are not in scope for this native mobile-first story.

### Testing Requirements

- Mobile:
  - preview state transitions (`loading -> ready`, `loading -> failed-preview`)
  - one-tap export success and error/retry paths
  - share CTA enabled only post-export and only when sharing is available
  - accessibility labels + non-color cues for status and failure messaging
- Backend:
  - preview/export contract envelope tests
  - deterministic error-code coverage for failure fixtures
  - lifecycle invariant tests ensure export/share handlers do not mutate status illegally

### Git Intelligence Summary

- Recent commits show a consistent story-driven cadence (`done dev story 1.5`, `done story 1.2`, `done dev story 1.1`) and strong preference for:
  - incremental feature slices in mobile under `features/*`
  - jobs-domain centralization in backend under `modules/jobs/*`
  - contract and deterministic test-ID coverage added with each story
- Continue this pattern to reduce integration risk and regression potential.

### Latest Technical Information

- Expo SDK 55 docs confirm `expo-sharing` requires availability checks and local file URLs for native file share.
- Expo SDK 55 docs confirm `expo-media-library` `saveToLibraryAsync` expects local URI with extension and explicit permission handling.
- Android granular media permissions are configurable; request minimal required scope to reduce policy friction.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.6 acceptance criteria and Epic 1 context]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR5/FR6/FR7 and first-export success framing]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - lifecycle invariants, error envelope, feature structure, testID rules]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - preview/export UX states and one-tap completion intent]
- [Source: `_bmad-output/implementation-artifacts/1-5-real-time-status-timeline-with-retry-path.md` - existing status/retry conventions]
- [Source: [Expo Sharing SDK 55 docs](https://docs.expo.dev/versions/v55.0.0/sdk/sharing/)]
- [Source: [Expo MediaLibrary SDK 55 docs](https://docs.expo.dev/versions/v55.0.0/sdk/media-library/)]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex Low

### Debug Log References

- Story file generated via `/bmad-create-story` using sprint auto-discovery for the first backlog story.

### Completion Notes List

- Consolidated Story 1.6 requirements into implementation-ready tasks with explicit backend/mobile boundaries.
- Added guardrails to prevent lifecycle contract drift, duplicate state logic, and non-deterministic failure UX.
- Included tested Expo SDK 55 export/share technical constraints to reduce integration mistakes.
- Implemented a mobile `preview-export` feature slice and wired it into the `ready` lifecycle state from the existing create-job screen.
- Added deterministic backend preview/export endpoints under `/v1/generation-jobs/:id/(preview|export)` with canonical envelopes and traceable error codes.
- Added telemetry event typing in `packages/contracts` and emitted aligned client-side preview/export/share events.
- Added tests for preview/export success and failure flows plus lifecycle invariant safety; validated with lint and targeted test runs.

### File List

- `_bmad-output/implementation-artifacts/1-6-preview-export-and-native-share.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.types.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/package.json`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/preview-export/screens/ready-result-screen.tsx`
- `apps/mobile/src/features/preview-export/services/preview-export-api.ts`
- `apps/mobile/src/features/preview-export/types/preview-export.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/telemetry.ts`

### Change Log

- 2026-03-27: Implemented Story 1.6 preview/export/share flow across mobile and backend with deterministic error handling, telemetry typing, and regression-safe tests.
