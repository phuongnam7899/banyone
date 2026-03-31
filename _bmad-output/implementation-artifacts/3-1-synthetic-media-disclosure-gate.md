# Story 3.1: Synthetic Media Disclosure Gate

Status: review

## Story

As a new user,  
I want to review synthetic-media disclosures before first generation,  
so that I understand acceptable use and platform expectations.

## Acceptance Criteria

1. **Given** I have not accepted disclosure terms  
   **When** I attempt first submission  
   **Then** disclosure content is shown with explicit acknowledgment action  
   **And** generation is blocked until acknowledgment is completed.
2. Disclosure acceptance is persisted per user identity so the gate appears only until first successful acknowledgment.
3. Re-attempting submission after acknowledgment proceeds through the existing submission flow without regression to validation, idempotency, or status behaviors.
4. Disclosure UI follows accessibility baselines: clear labels, non-color-only cues, and touch targets meeting minimum size expectations.
5. Protected API behavior remains deterministic and contract-compliant, including canonical success/error envelopes and stable error codes for blocked submissions.

## Tasks / Subtasks

- [x] Add backend disclosure policy gate support (AC: 1, 2, 5)
  - [x] Add a user disclosure acceptance field in the user profile domain/persistence layer (timestamp + version string).
  - [x] Add a protected endpoint to record disclosure acknowledgment for the authenticated user.
  - [x] Add a pre-submit guard/check in job acceptance flow to block first submission when disclosure is not accepted.
  - [x] Return deterministic policy error code and actionable message when blocked.
- [x] Add mobile first-submit disclosure gate UX (AC: 1, 3, 4)
  - [x] Show disclosure screen/sheet before first submission attempt when backend indicates missing acceptance.
  - [x] Provide explicit acknowledgment CTA; disable submit continuation until acknowledged.
  - [x] After successful acknowledgment, continue with existing submit flow and preserve prior user context.
  - [x] Add stable `testID` values for all primary gate interactions.
- [x] Keep contracts synchronized (AC: 5)
  - [x] Add/update shared API contracts in `packages/contracts` for disclosure status and acknowledgment endpoints.
  - [x] Ensure mobile/backend consume the same contract types.
- [x] Validate behavior with automated tests (AC: 1-5)
  - [x] Backend unit tests for guard logic and deterministic error mapping.
  - [x] Backend integration/e2e tests for blocked submission and successful post-acknowledgment submission.
  - [x] Mobile screen/component tests for gate display and acknowledgment progression.

## Dev Notes

- **Business context:** This story implements FR15 and UX-DR16, and is required for app-store compliance posture around synthetic media disclosures.
- **Do not reinvent existing flows:** Reuse current auth/session, job submission, and error-envelope infrastructure from Epic 1/2. Insert gate checks at submission boundary; do not fork job lifecycle logic.
- **Policy behavior:** Treat the disclosure as a precondition to first generation, not as a generic validation error.

### Technical Requirements

- Keep backend API under `/v1` and return canonical envelopes:
  - Success: `{ data, meta?, error: null }`
  - Error: `{ data: null, error: { code, message, retryable, details?, traceId }, meta? }`
- Use authenticated user context (verified Firebase token) for disclosure status and acknowledgment persistence.
- Maintain deterministic policy-related error code for blocked submission (for example `DISCLOSURE_REQUIRED`) and `retryable=false` until acknowledged.
- Keep controller thin; domain logic in services; persistence through repository/adapter boundaries.
- Follow DTO validation at API edge (`class-validator` patterns already used in backend).

### Architecture Compliance

- Backend feature-module boundaries apply (`controller`, `service`, `dto`, `repository/adapter`, tests).
- Mobile feature code should live in feature surfaces and call backend through infra/api client; no direct Firebase SDK use in UI components.
- Keep shared contract definitions in `packages/contracts` as source of truth between mobile/backend.
- Preserve job state machine semantics (`queued -> processing -> ready|failed`) by gating before acceptance rather than introducing new lifecycle states.

### Library / Framework Requirements

- Mobile: Expo React Native app conventions already established in repo.
- Backend: NestJS module/service/guard conventions already established in repo.
- Auth and data baseline: Firebase Auth token verification, Firestore-backed user metadata.
- Continue with existing monorepo tooling and test stack (Jest, existing e2e setup).

### File Structure Requirements

- Mobile likely touchpoints:
  - `apps/mobile/src/features/...` for disclosure UI and hooks/services
  - `apps/mobile/src/infra/api-client/...` for disclosure endpoint calls
  - `apps/mobile/app/...` only for route-level wiring if needed
- Backend likely touchpoints:
  - `apps/backend/src/modules/auth` or `apps/backend/src/modules/users` for user disclosure state
  - `apps/backend/src/modules/jobs` for pre-submit gate enforcement
  - `apps/backend/src/common/errors` for deterministic policy error mapping
- Shared contracts:
  - `packages/contracts/src/...` and `packages/contracts/src/index.ts`

### Testing Requirements

- API change minimum matrix: unit + contract/integration + e2e coverage.
- Add tests for:
  - Blocked first submission when disclosure not acknowledged.
  - Successful acknowledgment recording for authenticated user.
  - Submission acceptance path after acknowledgment.
  - Error envelope/code stability for disclosure-required rejection.
- Mobile tests should assert gate interaction via deterministic `testID` selectors.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.1, FR15, UX-DR16)]
- [Source: `_bmad-output/planning-artifacts/prd.md` (Trust, Safety, and Policy FR15)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` (API envelope, module boundaries, auth/guard patterns, structure mapping)]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` (trust/policy transparency, accessibility and clarity principles)]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex (Cursor agent mode)

### Debug Log References

- Story generated from `bmad-create-story` workflow using epic/story key `3-1`.
- Added `disclosure` backend module with file-backed per-user acceptance persistence and guarded disclosure endpoints.
- Added first-submit precondition in jobs service returning deterministic `DISCLOSURE_REQUIRED` canonical error envelope.
- Added mobile disclosure gate with explicit acknowledgment CTA and submit continuation after successful acknowledgment.
- Verified behavior using targeted backend unit tests, backend e2e tests, and mobile create-job submit tests.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- No prior story in epic 3 exists, so previous-story learnings are not applicable yet.
- Implemented disclosure status/acknowledgment backend endpoints under `/v1/synthetic-media-disclosure`.
- Persisted disclosure acceptance per authenticated user as timestamp + version, and enforced disclosure gate at submission boundary.
- Preserved canonical error envelopes and deterministic policy error behavior via `DISCLOSURE_REQUIRED`.
- Extended mobile submit flow to display disclosure gate, require explicit acknowledgment, and automatically continue submission.
- Added/updated contract definitions, backend tests, and mobile tests to cover blocked and post-acknowledgment flows.

### File List

- `_bmad-output/implementation-artifacts/3-1-synthetic-media-disclosure-gate.md`
- `apps/backend/src/modules/disclosure/disclosure.module.ts`
- `apps/backend/src/modules/disclosure/synthetic-media-disclosure.controller.ts`
- `apps/backend/src/modules/disclosure/synthetic-media-disclosure.store.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs-rate-limit.spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `packages/contracts/src/synthetic-media-disclosure.ts`
- `packages/contracts/src/index.ts`

### Change Log

- 2026-03-31: Implemented synthetic-media disclosure gate end-to-end (contracts, backend policy/ack endpoints, mobile UX flow, and automated tests).
