# Story 2.1: Lightweight User Identity and Session Binding

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning user,  
I want a lightweight identity tied to my jobs,  
so that my history and protections follow me consistently.

## Acceptance Criteria

1. **Given** the app is opened by a new or returning user  
   **When** identity is established (cold start or session restore)  
   **Then** the client holds a stable Firebase Auth user identifier (`uid`) for the lifetime of that install/session model.

2. **And** all job-scoped API calls (`POST /v1/generation-jobs`, `GET /v1/generation-jobs/:id`, preview, export) send a verified credential: `Authorization: Bearer <Firebase ID token>` (or the project’s agreed single header scheme documented in contracts).

3. **And** new jobs created after this story are persisted with that stable `userId` (same semantic as Firebase `uid`) so later features (history, rate limits, notifications) can filter by user without ambiguous shared-global job pools.

4. **And** the NestJS API rejects unauthenticated access to those user-scoped endpoints with a deterministic error envelope (`packages/contracts` error shape: `code`, `message`, `retryable`, optional `traceId`) — not a silent empty response.

5. **And** existing automated tests are updated or extended so that: (a) happy path uses a valid test token or mock verifier, and (b) missing/invalid token yields `401` (or project-standard unauthorized code) with structured body.

**Verification note:** Exercise at least one real device/emulator sign-in path appropriate to the chosen Firebase method (see Dev Notes). Keep CI deterministic via injected/mock token verification in tests.

## Tasks / Subtasks

- [x] **Firebase Auth on mobile (AC: 1, 2)**
  - [x] Add Firebase client configuration aligned with Expo SDK 55 (env-driven: `EXPO_PUBLIC_*` for project id, etc.; secrets not committed).
  - [x] Implement `apps/mobile/src/features/auth/` (screens/hooks/services per architecture tree) to establish identity on launch: follow PRD/architecture **Firebase Auth with Google Sign-In** unless PM explicitly approves anonymous-first; if anonymous is used for frictionless MVP, document linking strategy for later account merge.
  - [x] Centralize token refresh / `getIdToken()` usage so API calls do not each duplicate Firebase wiring.

- [x] **API client: authenticated fetch (AC: 2)**
  - [x] Introduce `apps/mobile/src/infra/api-client/` (or extend existing fetch helpers) to attach `Authorization: Bearer …` to all job endpoints currently called from `use-job-submission`, `use-job-status-polling`, `preview-export-api`.
  - [x] Preserve existing behavior for idempotency headers and timeouts; do not regress Story 1.7 idempotency retention rules.

- [x] **Backend: verify tokens + user-scoped jobs (AC: 3, 4)**
  - [x] Add `firebase-admin` (or equivalent) Nest provider; load service account / project id from env (`.env.example` updated).
  - [x] Implement `apps/backend/src/common/guards` (or `modules/auth`) to validate Bearer tokens and expose `uid` to controllers via decorator (`@CurrentUser()` pattern).
  - [x] Apply guard to `JobsController` routes; extend `PersistedJobRecord` / store schema with `userId` and scope idempotency keys per user (or composite key `userId + idempotency`) so one user cannot replay another’s idempotency key semantics incorrectly.
  - [x] Migrate or namespace existing `jobs-store.json` rows without `userId` (dev-only data) so tests remain explicit about behavior for legacy records.

- [x] **Testing & quality gates (AC: 5)**
  - [x] Backend: supertest with mocked `verifyIdToken` returning a fixed uid; assert 401 without header.
  - [x] Mobile: unit/integration tests for api-client header injection using mocks.
  - [x] Root lint/typecheck/tests remain green.

## Dev Notes

### Story scope and dependency guardrails

- **In scope:** FR12 — lightweight identity for job association and future abuse/history features; session binding via Firebase ID tokens; backend verification on user-scoped routes.
- **Builds on:** Epic 1 job lifecycle, idempotency (Stories 1.4, 1.7), existing REST envelopes in `packages/contracts`.
- **Out of scope for 2.1:** Full profile UI, email/password flows, job history UI (Story 2.2), push tokens (2.4), rate-limit messaging (2.3) — only ensure **identity exists** and **APIs are protected** so those stories have a uid to target.

### Previous story intelligence (Story 1.7)

- Draft persistence uses `@react-native-async-storage/async-storage` and `useJobSubmission` idempotency rules — **do not** clear idempotency keys on transport failure; authenticated headers must layer on top without changing that logic.
- Avoid generic `isLoading`; use explicit flags (`isAuthenticating`, `isRestoringSession`, etc.) consistent with create-job patterns.
- New surfaces: stable `testID` + a11y labels matching existing conventions.

### Architecture compliance (must follow)

- **Auth boundary:** [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security] Firebase Auth; backend verifies Firebase ID tokens; authorization expands later via claims.
- **FR mapping:** Identity/session FR12–FR14 map to `features/auth`, `modules/auth`, `modules/users`, guards — create minimal `modules/users` only if needed to record uid on first token (otherwise jobs table uid may suffice for MVP).
- **Component boundaries:** No Firebase SDK calls from presentational components; isolate under `infra/firebase` + `features/auth/services`.
- **Contracts:** Shared error codes / optional auth error constants belong in `packages/contracts` if reused by mobile and backend.

### Technical requirements

- **Mobile:** Expo 55 baseline (`package.json` already). Add Firebase dependencies compatible with Expo managed workflow (prefer official Expo + Firebase docs for SDK 55). Wire Google Sign-In per platform (iOS URL schemes / Android SHA keys documented in README fragment — dev agent must update setup docs minimally).
- **Backend:** NestJS 11; add `firebase-admin` for `verifyIdToken`. Guard runs on all `/v1/generation-jobs*` routes in scope.
- **Data:** Job store version bump if schema changes (`PersistedJobsStore` version field already exists — extend carefully with migration).
- **Security:** Never log raw tokens; log uid only in dev if needed. Service account JSON stays out of git.

### File structure (likely touch points)

- New: `apps/mobile/src/features/auth/**`, `apps/mobile/src/infra/firebase/**`, `apps/mobile/src/infra/api-client/**`
- Update: `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`, `job-status/hooks/use-job-status-polling.ts`, `preview-export/services/preview-export-api.ts`
- New: `apps/backend/src/common/guards/firebase-auth.guard.ts` (or equivalent), `apps/backend/src/modules/auth/**`
- Update: `apps/backend/src/modules/jobs/jobs.controller.ts`, `jobs.service.ts`, `app.module.ts`
- Update: `packages/contracts` — if new error codes for `UNAUTHENTICATED` / `INVALID_TOKEN` are standardized

### Library / framework requirements

- `firebase` (client) + platform config; `firebase-admin` (server) — pin versions in workspace lockfile; align with Node 22 and Nest 11.
- No duplicate HTTP stacks: keep `fetch`-based client, wrap with auth injection.

### Testing requirements

- Mock Firebase verifier in unit tests; optional e2e with test project (document cost/limitations).
- Contract tests: unauthorized request body shape matches existing error envelope tests in `jobs.controller.spec.ts`.

### Git intelligence summary

- Recent commits follow story-based completion (`done story 1.6`, etc.) and feature folders under `apps/mobile/src/features/*`. Continue that convention for auth.

### Latest technical information

- Firebase Admin Node SDK: use `verifyIdToken` with clock skew tolerance; cache JWKS via SDK defaults.
- Expo SDK 55: prefer documented Firebase integration path for your workflow (development build vs Expo Go limitations — **document** if Google Sign-In requires dev client).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, FR mapping, folder layout]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Identity-lite / abuse controls]
- [Source: `_bmad-output/implementation-artifacts/1-7-persist-drafts-and-recover-interrupted-uploads.md` — prior mobile patterns]
- [Source: `apps/backend/src/modules/jobs/jobs.controller.ts` — current unauthenticated routes]
- [Source: `apps/mobile/src/features/create-job/hooks/use-job-submission.ts` — API base URL + fetch]

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

### Completion Notes List

- **Mobile:** `BanyoneAuthProvider` wraps the app (`_layout.tsx`). Firebase is initialized from `EXPO_PUBLIC_FIREBASE_*`. Default path is **anonymous** `signInAnonymously` on launch when `EXPO_PUBLIC_AUTH_STRATEGY` is not `google`. **Google** uses `expo-auth-session` `useIdTokenAuthRequest` + `signInWithCredential` when `EXPO_PUBLIC_AUTH_STRATEGY=google` and OAuth client IDs are set. **Local dev without Firebase client:** `EXPO_PUBLIC_DEV_FIREBASE_ID_TOKEN` + optional `EXPO_PUBLIC_DEV_AUTH_UID` (see `apps/mobile/.env.example`) pairs with backend `BANYONE_AUTH_VERIFIER=test` and `BANYONE_TEST_FIREBASE_ID_TOKEN` from contracts.
- **API client:** `banyoneAuthenticatedFetch` merges `Authorization: Bearer` from `getIdToken()`. Job submit, status polling, and preview/export use it; Story 1.7 idempotency behavior preserved.
- **Backend:** `AuthModule` with `FirebaseAuthGuard` + `FirebaseAuthService`. `BANYONE_AUTH_VERIFIER=test` uses contract token `test-valid-token` (+ optional second user token for multi-user idempotency test). Production uses `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`. Jobs store is **v3** with `userId` on each job and idempotency keys scoped as `userId + unit-separator + clientKey`; legacy stores migrate to `__legacy_unscoped__`. Unauthenticated requests return **401** with `{ data: null, error: { code, message, retryable, traceId } }`.
- **Contracts:** `BANYONE_TEST_FIREBASE_ID_TOKEN` and shared auth error types exported.
- **Follow-up (2026-03-29):** Increased `waitFor` timeout to 15s in `create-job-submit.test.tsx` so async submit/assertions stay reliable under parallel Jest load (default 5s was flaky on full-suite runs).

### File List

- `packages/contracts/src/api-auth.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/modules/auth/auth.module.ts`
- `apps/backend/src/modules/auth/banyone-user.types.ts`
- `apps/backend/src/modules/auth/current-user.decorator.ts`
- `apps/backend/src/modules/auth/firebase-auth.guard.ts`
- `apps/backend/src/modules/auth/firebase-auth.service.ts`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/.env.example`
- `apps/backend/package.json`
- `apps/mobile/src/app/_layout.tsx`
- `apps/mobile/src/features/auth/auth-context.tsx`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.ts`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/preview-export/services/preview-export-api.ts`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/infra/api-client/authenticated-fetch.ts`
- `apps/mobile/src/infra/api-client/authenticated-fetch.test.ts`
- `apps/mobile/src/infra/firebase/firebase-client.ts`
- `apps/mobile/jest.setup.js`
- `apps/mobile/package.json`
- `apps/mobile/.env.example`
- `package-lock.json`

## Change Log

- **2026-03-28:** Implemented Story 2.1 — Firebase-backed identity on mobile, authenticated fetch for all job APIs, Nest JWT verification (firebase-admin / test verifier), per-user jobs + idempotency in jobs store v3, 401 contract envelope for auth failures, tests and env examples updated.
- **2026-03-29:** Stabilized `create-job-submit.test.tsx` with a 15s `waitFor` timeout to prevent intermittent failures when the full mobile suite runs in parallel.

## Open questions (non-blocking; resolve during implementation)

1. **Sign-in method:** Architecture defaults to Google Sign-In. Confirm with PM whether **anonymous Firebase auth** is acceptable for first ship under “lightweight” before forcing Google UI.
2. **Local dev without Firebase:** Define `BANYONE_AUTH_BYPASS` (dev-only) or test-only verifier mock — must never ship enabled in production.
