# Story 2.3: User-Facing Rate-Limit Notices

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,  
I want clear notices when account or device limits are reached,  
so that I understand why actions are temporarily blocked and what to do next.

## Acceptance Criteria

1. **Given** a rate policy threshold is exceeded  
   **When** I attempt a blocked action (e.g. job submission or another covered compute-heavy API call)  
   **Then** I receive a **deterministic** response: machine-readable `error.code`, plain-language `error.message`, `retryable: true`, and structured `error.details` that explain **cause** and **wait/recovery guidance** (e.g. retry window / approximate wait).

2. **And** the blocked state is **not** presented as a generic network or unknown system failure when the server returned a rate-limit response (must not map 429 + canonical body to `NETWORK_ERROR`).

3. **And** backend enforcement applies at minimum to **POST `/v1/generation-jobs`** (architecture: throttling on job creation and media-related operations); extend to **POST `/v1/generation-jobs/:id/export`** if the same “expensive action” policy should apply (recommended for consistency).

4. **And** mobile surfaces use **consistent feedback** (UX-DR10): proactive, contextual copy for rate limits—distinct visual/semantic treatment from validation violations and from hard failures—plus accessible labels / `testID`s for the rate-limit notice path.

5. **And** automated tests cover: backend returns canonical envelope on throttle trigger; mobile parses non-2xx responses that still carry the envelope and renders rate-limit guidance (not `NETWORK_ERROR`).

## Tasks / Subtasks

- [x] **Contracts: rate-limit error shape (AC: 1, 5)**
  - [x] Add shared types/constants for `RATE_LIMITED` (or chosen canonical code) and `error.details` (e.g. `scope`, `retryAfterSec` / `retryAfterMs`, optional `limit` + `windowMs` for transparency).
  - [x] Export from `packages/contracts` and consume in backend + mobile.

- [x] **Backend: enforce limits + canonical body (AC: 1, 3, 5)**
  - [x] Introduce request throttling (e.g. `@nestjs/throttler` or equivalent) with limits appropriate for dev/test (env-configurable).
  - [x] Key limits by **authenticated Firebase `uid`** (account scope). _Note:_ true device-scoped limits are not yet modeled in the codebase; document `details.scope: 'account'` for MVP. If product requires device bucket in the same story, add a minimal, explicit contract (header or token claim) rather than implicit heuristics—only if agreed in implementation.
  - [x] Ensure throttling does **not** return Nest’s default non-envelope body: use a **custom exception filter** (or guard/interceptor pattern) so **HTTP 429** responses use the same `{ data: null, error: { code, message, retryable, details?, traceId } }` shape as `FirebaseAuthGuard` uses for 401.
  - [x] Set `Retry-After` (seconds) when practical so clients and proxies align with `details`.

- [x] **Mobile: parse + UX (AC: 2, 4, 5)**
  - [x] Update `use-job-submission` (and any other fetch wrapper that assumes success body on 200 only) to treat **any response with JSON envelope** where `error != null` as a **domain error**, regardless of HTTP status, **before** falling through to generic network handling.
  - [x] Map `RATE_LIMITED` (and only ambiguous failures) to dedicated UI copy: cause + “try again after …” / countdown if `retryAfterSec` provided—**not** “Rejected” with empty violations.
  - [x] Add stable `testID`s: e.g. `create-job.submit.ack.rate-limited`, `create-job.submit.ack.rate-limited.message`.
  - [x] If export API is throttled, mirror handling in `preview-export-api` / calling surface so export failures are not generic.

- [x] **Testing (AC: 5)**
  - [x] Backend: unit/e2e test that simulates exceeding limit and asserts **429**, envelope shape, and `error.code` / `details`.
  - [x] Mobile: test fixture Response with `status 429` + envelope body lands in rate-limit UX path (not `NETWORK_ERROR`).
  - [x] Keep lint/typecheck/tests green for touched packages.

## Dev Notes

### Story scope and dependency guardrails

- **FR14:** User-facing notices when account/device rate limits are reached.
- **Depends on:** Story 2.1 (authenticated requests); existing canonical error envelope pattern (`FirebaseAuthGuard`).
- **Out of scope:** moderation/admin throttling (FR19), entitlement tiers (“trusted user” buckets), push notifications (2.4), notification preferences (2.5). Those may **extend** the same error pattern later—do not hardcode strings-only handling that blocks `details` evolution.

### Previous story intelligence (Story 2.2)

- History list/detail and contracts live under `apps/mobile/src/features/history/`, `packages/contracts/src/api-history.ts`, extended `jobs` module—**reuse** authenticated client `banyoneAuthenticatedFetch` and envelope parsing style; **do not** add a second HTTP client.
- `use-job-submission` currently assumes `res.json()` and branches on `json.error`; it does **not** branch on `res.ok`. Fixing rate-limit handling may require **explicit** handling when `!res.ok` but body is still JSON envelope (today, a 429 HTML body would incorrectly become `NETWORK_ERROR`).
- Create-job screen maps non-violation rejects to a bare `ack.code` line—**insufficient** for FR14; add a first-class rate-limit presentation.

### Architecture compliance (must follow)

- [Source: `_bmad-output/planning-artifacts/architecture.md` — API security: request throttling on job creation and media operations; error taxonomy with deterministic codes; REST `/v1`; canonical structured errors.]
- Preserve **deterministic error codes** and **user-actionable messages** alongside `retryable`.
- Mobile: **no Firebase SDK in UI components** for API calls; keep feature hooks/services pattern.
- **testID** convention: stable, language-independent identifiers on interactive and primary notice elements.

### Technical requirements

- Prefer **HTTP 429** for rate limit with **JSON envelope** body (consistent with 401 envelope pattern in `firebase-auth.guard.ts`).
- Throttle configuration must be **environment-driven** (e.g. high limits in test, stricter in prod) to avoid flaky CI.
- Idempotent retries: rate limit on **create** should still return a safe, deterministic envelope; do not leak other users’ data on idempotency collisions.
- Telemetry: optional `console.info` / existing telemetry patterns when rate-limited (non-blocking for MVP).

### File structure requirements (likely touch points)

- `apps/backend/src/main.ts` / `app.module.ts` — ThrottlerModule registration, global filter registration.
- `apps/backend/src/modules/jobs/jobs.controller.ts` — route-level throttle metadata or controller scope.
- New: `apps/backend/src/**` exception filter for throttle → envelope (location aligned with existing `modules/auth` patterns).
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts` — response / envelope handling.
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` — rate-limit UI.
- Optionally `apps/mobile/src/features/preview-export/**` if export is in scope.
- `packages/contracts/src/**` — shared rate-limit types; `index.ts` exports.

### Library / framework requirements

- NestJS 11: official **`@nestjs/throttler`** is the conventional choice; pin a current stable version compatible with Nest 11 and document in package-lock. If the team prefers a custom in-memory limiter, document the tradeoff (consistency vs maintenance).
- Do **not** add Redis for this story unless already present—architecture allows in-memory API limits until bottlenecks justify Redis.

### Testing requirements

- Backend tests mirror existing `jobs.controller.spec.ts` patterns (auth + envelope).
- Mobile tests mirror `authenticated-fetch.test.ts` / create-job screen tests; use `fetch` mocks with `status: 429` and JSON body.

### Git intelligence summary

- Historical commits follow `done story X.Y` granularity; keep changes scoped to rate-limit surfaces and shared contracts.

### Latest technical information

- `@nestjs/throttler` integrates with Nest guards; **customize the rejection** to emit project JSON instead of default `message` payloads. Verify Nest 11 compatibility for the chosen package version at implementation time.

### Project context reference

- No `project-context.md` found in repo root; primary guardrails are this story, `epics.md`, and `architecture.md`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR14, abuse/rate controls]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Rate limiting, error handling, API throttling]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — UX-DR10 consistent feedback patterns]
- [Source: `_bmad-output/implementation-artifacts/2-2-job-history-list-and-detail-views.md` — prior epic 2 patterns]
- [Source: `apps/backend/src/modules/auth/firebase-auth.guard.ts` — canonical HTTP error envelope precedent]
- [Source: `apps/mobile/src/features/create-job/hooks/use-job-submission.ts` — submission client behavior to extend]

## Dev Agent Record

### Agent Model Used

Cursor coding agent

### Debug Log References

- Throttling: `@nestjs/throttler` with per-route opt-in on `POST /v1/generation-jobs` and `POST /v1/generation-jobs/:id/export`; tracker = Firebase `uid` via `BanyoneUserThrottlerGuard`.
- `ThrottlerEnvelopeExceptionFilter` maps `ThrottlerException` → HTTP 429 + canonical envelope + `Retry-After`.
- Mobile: `parseBanyoneApiEnvelopeResponse` reads body via `text()` + JSON parse so non-OK responses with JSON envelopes are handled before `NETWORK_ERROR`.

### Completion Notes List

- Added `packages/contracts` rate-limit code, details type, and `isApiRateLimitDetails` guard.
- Backend: env-driven `BANYONE_THROTTLE_TTL_MS` / `BANYONE_THROTTLE_LIMIT`, user-scoped throttling, canonical 429 envelope, dedicated rate-limit Jest suite.
- Mobile: create-job submission and preview/export APIs parse envelopes on any HTTP status; dedicated rate-limit UX on create flow; preview panel shows server message for `RATE_LIMITED`.
- Validation: backend tests 32 passed, backend lint clean; mobile tests 65 passed, mobile lint clean.

### File List

- `_bmad-output/implementation-artifacts/2-3-user-facing-rate-limit-notices.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/backend/package.json`
- `package-lock.json`
- `apps/backend/.env.example`
- `apps/backend/src/banyone-throttle.config.ts`
- `apps/backend/src/main.ts`
- `apps/backend/src/modules/auth/banyone-user-throttler.guard.ts`
- `apps/backend/src/modules/auth/throttler-envelope.filter.ts`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs-rate-limit.spec.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/preview-export/services/preview-export-api.ts`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `apps/mobile/src/infra/api-client/parse-json-envelope.ts`
- `packages/contracts/src/api-rate-limit.ts`
- `packages/contracts/src/index.ts`

## Change Log

- 2026-03-30: Story context created (create-story). Status `ready-for-dev`. Ultimate context engine analysis completed - comprehensive developer guide created.
- 2026-03-30: Implemented Story 2.3 (contracts, backend throttle + 429 envelope, mobile parsing/UX, tests). Status `review`.

### Open questions / clarifications (non-blocking)

- Confirm whether **export** (`POST .../export`) must share the same rate-limit policy as create in MVP (recommended yes per architecture).
- Confirm desired **default limits** per environment (document in `.env.example`).
