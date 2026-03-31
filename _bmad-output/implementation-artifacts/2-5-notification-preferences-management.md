# Story 2.5: Notification Preferences Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,

I want control over notification preferences,

so that the app matches my communication preferences while preserving in-app visibility.

## Acceptance Criteria

1. **Given** I am in settings
   **When** I update lifecycle notification preferences
   **Then** backend/mobile settings are persisted.

2. **And** in-app status remains available regardless of push preference state.

## Tasks / Subtasks

- [x] **Contracts: preference schema and API shape (AC: 1, 2)**
  - [x] Add shared contract types in `packages/contracts/src/push-notifications.ts` for user notification preferences (at minimum lifecycle toggles used by story 2.4 events).
  - [x] Export new contracts from `packages/contracts/src/index.ts`.
  - [x] Keep API payload fields `camelCase` and compatible with canonical envelope responses.

- [x] **Backend: preferences persistence and enforcement (AC: 1, 2)**
  - [x] Add/extend backend notification preference model in `apps/backend/src/modules/notifications/` using existing storage pattern introduced in story 2.4.
  - [x] Implement authenticated endpoints under `/v1` for read/update preferences (for example `GET /v1/notification-preferences`, `PUT /v1/notification-preferences`).
  - [x] Validate DTOs at API boundary and return canonical success/error envelope.
  - [x] Apply preferences in lifecycle send path so disabled event types are not pushed, while job status/history persistence remains unchanged.

- [x] **Mobile: settings UI and persistence flow (AC: 1, 2)**
  - [x] Add notification preference surface in settings flow using feature path `apps/mobile/src/features/notifications/`.
  - [x] Load current preferences from backend and render deterministic toggle state.
  - [x] Save changes with optimistic-safe UX (loading, success, actionable error).
  - [x] Preserve architecture boundary: UI uses feature service/hook, not direct SDK calls.
  - [x] Add stable `testID` values for interactive controls.

- [x] **Behavior guardrail: push assistive only (AC: 2)**
  - [x] Verify disabling push notifications does not alter backend lifecycle transitions, history detail data, or in-app polling-driven status truth.
  - [x] Keep deep link and lifecycle history behavior intact for already delivered notifications.

- [x] **Testing (AC: 1, 2)**
  - [x] Backend unit tests for preference CRUD, DTO validation, and notification-send filtering behavior.
  - [x] Backend integration/e2e tests for authenticated preference read/update endpoints and envelope contract.
  - [x] Mobile tests for settings toggle rendering, save flows, and failure recovery messaging.
  - [x] Regression coverage to prove in-app status remains complete when all push lifecycle preferences are disabled.

## Dev Notes

### Story scope and dependency guardrails

- This story fulfills **FR21** and extends Epic 2's notification capabilities started in story **2.4**.
- Notification preferences control push delivery behavior only; they must not become a source of truth for lifecycle state visibility.
- Keep scope to lifecycle notification preference management. Do not introduce unrelated channel strategy, marketing notification systems, or broad account settings refactors.

### Previous story intelligence (Story 2.4)

- Reuse existing notification module and FCM adapter boundaries in `apps/backend/src/modules/notifications/` and `apps/backend/src/adapters/fcm/`.
- Build on existing mobile notification feature structure under `apps/mobile/src/features/notifications/`.
- Keep existing deep-link and push registration flows intact; this story should layer preference state, not replace 2.4 primitives.
- Continue using existing authenticated fetch and API envelope parsing patterns used in prior Epic 2 stories.

### Architecture compliance (must follow)

- Backend job state is canonical; push is assistive only.
- Keep REST endpoints versioned under `/v1`.
- Use shared contracts package to prevent mobile/backend drift.
- Respect feature-module boundaries in NestJS and feature-folder boundaries in Expo app.
- Keep deterministic error taxonomy and actionable messages.

### Technical requirements

- Enforce preference decisions server-side at send orchestration time to avoid client-only bypass.
- Persist preferences by `userId` with explicit defaults (new users receive deterministic baseline behavior).
- Handle unknown/missing preference keys safely (default, migrate, or reject with deterministic error).
- Maintain idempotent update behavior where repeated same payload writes do not produce inconsistent states.
- Ensure sign-in, sign-out, and multi-device usage do not produce stale or conflicting preference behavior.

### File structure requirements (likely touch points)

- `apps/backend/src/modules/notifications/**`
- `apps/backend/src/modules/jobs/jobs.service.ts` (only if notification orchestration hook requires preference-aware call path)
- `apps/backend/test/**` (integration/e2e coverage)
- `apps/mobile/src/features/notifications/**`
- `apps/mobile/src/app/settings.tsx` (or equivalent settings route)
- `packages/contracts/src/push-notifications.ts`
- `packages/contracts/src/index.ts`

### Library / framework requirements

- Continue with current NestJS + `firebase-admin` setup; no new push provider.
- Continue Expo SDK 55 notification stack and existing project plugin/configuration.
- Follow Firebase token management guidance already implemented in story 2.4; this story is preference filtering on top.

### Testing requirements

- API change: unit + integration/e2e + contract assertions.
- Mobile settings change: component/screen tests plus at least one flow-level test around toggle + save.
- Verify regression on "status remains visible even when push disabled" as a release gate for this story.

### Git intelligence summary

- Recent commits (`done 2-3`, `done story 1.6`, `done dev story 1.5`, `done story 1.2`, `done dev story 1.1`) show concise "done ..." commit style and incremental story-scoped delivery.
- Maintain the same pattern: small, focused updates across contracts, backend module, mobile feature, and tests.

### Latest technical information

- Expo notifications guidance indicates remote push on Android requires development builds instead of Expo Go for realistic validation; keep CI tests mocked and use device/dev build for manual verification.
- Firebase guidance emphasizes registration-token freshness and stale token cleanup; keep preference behavior independent from token cleanup logic but compatible with it.

### Project context reference

- No `project-context.md` detected. Story context is derived from `epics.md`, `architecture.md`, `prd.md`, `ux-design-specification.md`, and implemented story 2.4 artifact.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2, Story 2.5]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - status authority, module boundaries, API conventions, testing gates]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR21, push strategy and reliability context]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - notification preference UX intent]
- [Source: `_bmad-output/implementation-artifacts/2-4-lifecycle-push-notifications.md` - established notification architecture and patterns]

## Dev Agent Record

### Agent Model Used

Cursor agent (create-story workflow).

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- job-lifecycle-push.service.spec.ts`
- `npm run test:e2e --workspace backend -- push-tokens.e2e-spec.ts`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts`
- `npm run test --workspace mobile -- notification-preferences-screen.test.tsx`

### Completion Notes List

- Story created with implementation guardrails and dependencies from completed story 2.4.
- Added shared notification preference contracts and exported them for backend/mobile parity.
- Added backend preference persistence, authenticated read/update endpoints, payload validation, and preference-aware lifecycle push filtering.
- Added a mobile settings route and notification preferences feature (service + hook + screen) with deterministic toggle state, save UX, and stable `testID`s.
- Added unit/e2e/mobile regression coverage, including a guardrail test proving lifecycle/status visibility remains intact when all push preferences are disabled.

### File List

- `_bmad-output/implementation-artifacts/2-5-notification-preferences-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/contracts/src/push-notifications.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/notifications/notification-preferences.store.ts`
- `apps/backend/src/modules/notifications/notification-preferences.controller.ts`
- `apps/backend/src/modules/notifications/notifications.module.ts`
- `apps/backend/src/modules/notifications/job-lifecycle-push.service.ts`
- `apps/backend/src/modules/notifications/job-lifecycle-push.service.spec.ts`
- `apps/backend/test/push-tokens.e2e-spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/components/app-tabs.tsx`
- `apps/mobile/src/app/settings.tsx`
- `apps/mobile/src/features/notifications/services/notification-preferences-api.ts`
- `apps/mobile/src/features/notifications/hooks/use-notification-preferences.ts`
- `apps/mobile/src/features/notifications/screens/notification-preferences-screen.tsx`
- `apps/mobile/src/features/notifications/screens/notification-preferences-screen.test.tsx`

### Change Log

- 2026-03-31: Implemented Story 2.5 end-to-end (contracts, backend persistence/endpoints/enforcement, mobile settings UI + service/hook, and regression tests). Story moved to `review`.
