# Story 2.4: Lifecycle Push Notifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,

I want notifications for key job events,

so that I can return at the right time without repeatedly checking manually.

## Acceptance Criteria

1. **Given** I have a submitted job

   **When** it reaches **accepted** (job acknowledged into the pipeline / **`queued`**), **ready**, or **failed** milestones

   **Then** I receive corresponding push notifications with copy appropriate to the milestone (failed payloads should carry **retry-oriented** context consistent with existing `failure` / `nextAction` semantics where applicable).

2. **And** tapping a notification **deep-links** into the correct in-app context for that job (e.g. history detail / status surface for the `jobId` — use project routing: `mobile` scheme, path aligned with `src/app/history-detail/[id].tsx`).

3. **And** if push delivery fails, permissions are denied, or the user disables OS notifications, **in-app status and API-backed history remain complete and authoritative** — no loss of lifecycle visibility (NFR5 / architecture “push is assistive only”).

4. **Verification:** Exercise **push disabled** and **delivery failure** scenarios on a device or realistic integration stub while confirming in-app polling/history still shows full lifecycle (see epics verification note).

## Tasks / Subtasks

- [x] **Contracts: notification payload + deep-link data (AC: 1, 2)**
  - [x] Define shared constants/types for lifecycle notification kinds (e.g. `job_queued` | `job_ready` | `job_failed`) and minimum `data` fields (`jobId`, `kind`, optional screen hint).

  - [x] Export from `packages/contracts` for backend + mobile.

- [x] **Backend: FCM adapter + notifications module + send on transitions (AC: 1, 3)**
  - [x] Add `apps/backend/src/adapters/fcm/` behind a small interface (architecture: isolate provider integrations); implement send using **firebase-admin** Cloud Messaging (HTTP v1 / admin SDK messaging API) with env-driven credentials (extend `.env.example` — no secrets in repo).

  - [x] Add `apps/backend/src/modules/notifications/`: register/store **FCM device tokens** per authenticated `userId` (architecture targets Firestore long-term; **file-backed or existing persistence pattern is acceptable for MVP** if Firestore is not yet introduced — document the migration hook).

  - [x] Expose `POST /v1/...` (versioned REST) for mobile to upsert/delete token; guard with existing Firebase auth.

  - [x] Invoke notification send from the **canonical lifecycle authority** when committed transitions occur — today transitions are committed in `JobsService` around `advanceJobLifecycleIfNeeded` / persistence (`telemetry.jobs.lifecycle.transition.v1`); **also** consider firing an “accepted” notification when a job is first persisted as **`queued`** on successful create (maps epic **accepted**). Avoid duplicate sends (idempotent per `(userId, jobId, kind)` or per transition edge).

- [x] **Mobile: permission, token registration, presentation, deep link (AC: 1–4)**
  - [x] Add **`expo-notifications`** (and any required Expo config plugins per SDK 55) to obtain push permissions and a token compatible with **FCM** for your build flavor (Expo Go limitations: **document**; use dev/EAS builds if required).

  - [x] Feature folder under `apps/mobile/src/features/notifications/` (or `infra/` for bare token plumbing + thin feature hooks) — **no Firebase SDK calls from dumb UI components** (architecture component boundaries).

  - [x] On sign-in / foreground, register/refreshed token with backend; handle sign-out by deleting token server-side if feasible.

  - [x] Handle notification tap → `expo-linking` / `expo-router` navigation to `history-detail/[id]` (or the screen that best matches current UX for job status).

  - [x] Stable `testID`s on any new settings-adjacent surfaces if touched; a11y labels for notification-driven entry.

- [x] **Testing (AC: 1–4)**
  - [x] Backend: unit tests with **mocked** FCM adapter — assert lifecycle transition triggers expected send calls; token registration auth tests.

  - [x] Mobile: tests for URL parsing / navigation handler and/or notification handler with mocks (avoid requiring real FCM in CI).

  - [x] Keep lint/typecheck/tests green.

## Dev Notes

### Story scope and dependency guardrails

- **FR20:** Lifecycle notifications for key job events. **UX-DR15** (epics traceability): push remains **assistive**; in-app status authoritative — align copy and behavior so users never need push to see truth.

- **Depends on:** Story **1.5** (lifecycle states), **2.1** (Firebase `uid` for targeting), **2.2** (history/detail destination for deep links).

- **Out of scope:** granular **notification preference toggles** (Story **2.5**) — for 2.4, acceptable to ship with **all lifecycle kinds enabled** server-side; do not block 2.5 from adding filters later.

### Milestone mapping (clarifies epic wording)

- **Accepted** (epic/PRD language) ↔ first durable success milestone: **`queued`** immediately after successful job creation (see `telemetry.jobs.generation.acknowledged.v1` `outcome: 'accepted'`).

- **Ready** ↔ `ready`.

- **Failed** ↔ `failed` (include retry guidance in notification body where it mirrors `failure.nextAction` / user-facing messaging).

- Do **not** invent extra states; stay on `GenerationJobStatus` in `apps/backend/src/modules/jobs/jobs.types.ts`.

### Previous story intelligence (Story 2.3)

- Reuse **`banyoneAuthenticatedFetch`**, `parseBanyoneApiEnvelopeResponse` / envelope-first parsing — **no second HTTP client** for token registration.

- Error envelope patterns and throttling already exist; new routes should participate in the same auth and error story.

- Rate-limit story touched `main.ts`, jobs module, `packages/contracts` — follow the same Nest/module registration hygiene.

### Architecture compliance (must follow)

- [Source: `_bmad-output/planning-artifacts/architecture.md` — State authority: backend job state canonical; mobile syncs from API; **push notification only**.]

- [Source: same — **FCM** via `adapters/fcm`; **modules/notifications**; integrations behind adapter interfaces.]

- [Source: same — REST `/v1`, OpenAPI-minded DTOs; contracts package for shared shapes.]

- [Source: `_bmad-output/planning-artifacts/epics.md` — Additional Requirements: “Push notifications are assistive only; in-app/backend status remains the source of truth.”]

- Event ordering: architecture notes **event publication after successful state transition commits** — align notification side-effects with **persisted** transitions, not speculative UI state.

### Technical requirements

- **Backend:** NestJS 11; **firebase-admin** already used for auth — extend for **FCM send** with fail-soft behavior (log + metrics; **do not** fail the job lifecycle commit if push fails).

- **Mobile:** Expo **~55**; `scheme` in `app.json` is **`mobile`** — deep links must use that scheme unless product standardizes a rename.

- **Idempotency:** polling calls `getGenerationJobStatus` frequently; ensure notifications fire **once per logical transition** or per milestone, not on every poll.

- **Security:** only send pushes to tokens registered by the same **`userId`** as the job owner; never leak other users’ job data in notification payloads.

### File structure requirements (likely touch points)

- New: `apps/backend/src/adapters/fcm/**`, `apps/backend/src/modules/notifications/**`

- Update: `apps/backend/src/app.module.ts`, `apps/backend/package.json`, `.env.example`

- Update: `apps/backend/src/modules/jobs/jobs.module.ts` / `jobs.service.ts` (inject notification orchestration; keep domthin)

- New: `apps/mobile/src/features/notifications/**` and/or `apps/mobile/src/infra/notifications/**`

- Update: `apps/mobile/app.json` plugins if `expo-notifications` requires config plugin

- `packages/contracts/src/**` + `index.ts`

### Library / framework requirements

- **firebase-admin** (Node): use supported Cloud Messaging API for server-side sends; pin consistent with existing admin usage.

- **expo-notifications**: use Expo’s documented SDK 55 integration path for device permissions, channels (Android), and FCM/APNs credentials. Verify at implementation time whether **EAS / dev build** is required vs Expo Go.

### Testing requirements

- Prefer **adapter mocking** for FCM in backend tests (no real sends in CI).

- Add lifecycle transition test coverage if new hooks increase regression risk (state machine already has invariant tests — extend thoughtfully).

### Git intelligence summary

- Recent work: Story **2.3** (`done 2-3`) — contracts + Nest filters + mobile envelope parsing; continue **small, story-scoped** commits and feature-folder layout.

### Latest technical information

- Before locking implementation details, confirm **Expo SDK 55 + expo-notifications + FCM** setup (Google services JSON, iOS push credentials, EAS project linkage). Firebase console must enable Cloud Messaging for the app IDs used by builds.

### Project context reference

- No `project-context.md` in repo; rely on this story, `epics.md`, `architecture.md`, and completed **2.3** / **2.2** artifacts.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.4]

- [Source: `_bmad-output/planning-artifacts/prd.md` — Push strategy, device permissions]

- [Source: `_bmad-output/planning-artifacts/architecture.md` — FCM, modules/notifications, state authority, folder layout]

- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR15 per epics traceability map]

- [Source: `_bmad-output/implementation-artifacts/2-3-user-facing-rate-limit-notices.md` — API client patterns]

- [Source: `apps/backend/src/modules/jobs/jobs.service.ts` — lifecycle transitions, telemetry]

- [Source: `apps/mobile/src/app/history-detail/[id].tsx` — deep-link target]

- [Source: `apps/mobile/app.json` — URL scheme `mobile`]

## Dev Agent Record

### Agent Model Used

Cursor agent (implementation).

### Debug Log References

—

### Implementation Plan

1. Add lifecycle push contracts in `@banyone/contracts` (kinds, FCM `data` shape, `mobile:///history-detail/{id}` helper).

2. Backend: shared `getOrInitializeFirebaseAdminApp`, FCM port + admin + noop (tests), file-backed token + dedupe stores, `JobLifecyclePushService`, `PushTokensController` (`POST`/`DELETE` `/v1/push-tokens`), wire `JobsModule` → `NotificationsModule` and call push only after persisted `queued` create and after `saveStore` on `ready`/`failed` transitions.

3. Mobile: `expo-notifications` + plugin, feature folder: token API via `banyoneAuthenticatedFetch`, hook for permission/device token registration, tap handling via `useLastNotificationResponse` + response listener → `router.push(/history-detail/...)`.

4. Tests: mocked FCM unit tests, push-tokens controller tests, mobile deep-link resolution unit tests.

### Completion Notes List

- Push sends are fail-soft (adapter catches init/send errors); `NODE_ENV=test` uses noop FCM. Dedupe file prevents duplicate `(userId, jobId, kind)` sends across polls.

- `DELETE /v1/push-tokens` with empty JSON body clears all tokens for the user (sign-out path on mobile is best-effort when the session is still valid for one last request).

- Expo Go / simulator: registration is skipped without a device or when permissions/token fail; history and polling remain authoritative.

### File List

- `.env.example`

- `packages/contracts/src/push-notifications.ts`

- `packages/contracts/src/index.ts`

- `apps/backend/src/infra/firebase-admin-app.ts`

- `apps/backend/src/modules/auth/firebase-auth.service.ts`

- `apps/backend/src/adapters/fcm/fcm-send.port.ts`

- `apps/backend/src/adapters/fcm/noop-fcm-send.adapter.ts`

- `apps/backend/src/adapters/fcm/firebase-admin-fcm-send.adapter.ts`

- `apps/backend/src/modules/notifications/notifications.module.ts`

- `apps/backend/src/modules/notifications/push-tokens.store.ts`

- `apps/backend/src/modules/notifications/push-notification-dedupe.store.ts`

- `apps/backend/src/modules/notifications/job-lifecycle-push.service.ts`

- `apps/backend/src/modules/notifications/push-tokens.controller.ts`

- `apps/backend/src/modules/notifications/job-lifecycle-push.service.spec.ts`

- `apps/backend/src/modules/notifications/push-tokens.controller.spec.ts`

- `apps/backend/src/modules/jobs/jobs.module.ts`

- `apps/backend/src/modules/jobs/jobs.service.ts`

- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`

- `apps/backend/src/modules/jobs/jobs-rate-limit.spec.ts`

- `apps/backend/test/jobs.e2e-spec.ts`

- `apps/mobile/app.json`

- `apps/mobile/package.json`

- `apps/mobile/.env.example`

- `apps/mobile/src/app/_layout.tsx`

- `apps/mobile/src/features/notifications/components/push-lifecycle-notifications-host.tsx`

- `apps/mobile/src/features/notifications/hooks/use-push-lifecycle-notifications.ts`

- `apps/mobile/src/features/notifications/services/push-tokens-api.ts`

- `apps/mobile/src/features/notifications/infra/resolve-history-detail-from-push-data.ts`

- `apps/mobile/src/features/notifications/infra/resolve-history-detail-from-push-data.test.ts`

- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Change Log

- 2026-03-31 — Story 2.4 implemented: contracts, backend FCM + token APIs + lifecycle hooks, mobile `expo-notifications` registration and deep link handling; tests and lint green.

---

**Story completion status:** review — Implementation complete; ready for code review.
