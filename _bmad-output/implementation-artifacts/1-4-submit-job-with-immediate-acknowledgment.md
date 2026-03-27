# Story 1.4: Submit Job with Immediate Acknowledgment

Status: done

## Story

As a casual creator,
I want to submit a valid job and receive immediate acceptance or rejection feedback,
so that I know the system has handled my request.

## Acceptance Criteria

1. **Given** all inputs are valid (per the same shared constraint rules used by the UI),
   **When** I tap `Submit`,
   **Then** the app receives a submission acknowledgment response within 3 seconds at p95 under normal load.

2. **And** after the acknowledgment response,
   **Then** the app shows an accepted or rejected state, including:
   - the reason (deterministic and user-actionable)
   - a next action (e.g., view status next, or fix specific inputs)

3. **And** duplicate submissions with the same idempotency key do not create duplicate jobs.

**Verification Note:** Validate p95 acknowledgment time with API telemetry from representative load tests (non-cached, in-cap jobs).

## Tasks / Subtasks

- [x] Backend: implement canonical job submission REST endpoint (AC: 1, 2, 3)
  - [x] Create a `apps/backend/src/modules/jobs/` feature module (controller, service, dto/types, and tests) as the home for the job creation endpoint.
  - [x] Add `POST /v1/generation-jobs` that:
    - verifies/normalizes idempotency key input (see idempotency requirements below)
    - validates the request payload using the same constraint validators as the mobile UI (so rejection reasons/codes match exactly)
    - creates a job record and sets initial job lifecycle state to `queued`
    - enqueues async processing (or schedules a placeholder worker action) but does NOT wait for processing completion before responding
  - [x] Ensure the REST response uses the canonical envelope pattern:
    - success: `{ data: { jobId: string, status: 'queued' }, error: null }`
    - error: `{ data: null, error: { code, message, retryable, details?, traceId } }`
  - [x] Add OpenAPI documentation for the new endpoint (if the repo already has openapi generation scaffolding; otherwise implement the minimal inline docs pattern used elsewhere in the repo).

- [x] Backend: implement deterministic idempotency for job creation (AC: 3)
  - [x] Accept an idempotency key via a custom header, consistent with architecture conventions (recommended: `x-banyone-idempotency-key`).
  - [x] Persist an idempotency mapping so that repeated requests with the same key:
    - return the same `jobId` and the same resulting `status` (or the last known status after server restarts)
    - do not create additional job records
  - [x] Define idempotency behavior for concurrent requests (at least: first request wins, others resolve deterministically to the same result).
  - [x] Add tests that send the same request twice with the same idempotency key and assert only one job record is created (or that the returned jobId is identical).

- [x] Backend: implement server-side validation with shared violation codes/messages (AC: 2)
  - [x] Reuse `validateJobInputCompliance()` from `@banyone/contracts` (or refactor/extend contracts with any shared mapping helpers if needed).
  - [x] When validation fails, return:
    - deterministic error code(s) that reflect the input violation(s)
    - user-actionable `message` and a recovery/fix guidance in `details`
    - `retryable: false` for non-retryable input constraint issues (and `true` only when a retry makes sense without changing inputs)
  - [x] Ensure any format-related copy is string-identical to what the mobile UI shows from the contracts constants (avoid magic numbers and avoid rewording).

- [x] Mobile: add `Submit` UI + acknowledgment handling (AC: 1, 2)
  - [x] Update `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` to include:
    - a primary `Submit` action (must respect existing CTA hierarchy expectations)
    - a staged acknowledgment UI that displays accepted vs rejected immediately after the POST response returns
  - [x] Introduce a dedicated hook (e.g. `useJobSubmission()`) responsible for:
    - generating a single idempotency key per submission attempt
    - sending the request to the backend
    - handling in-flight submission state and disabling repeated taps while awaiting the acknowledgment response
  - [x] Add stable `testID`s for:
    - the submit button: `create-job.submit.button`
    - accepted state: `create-job.submit.ack.accepted`
    - rejected state: `create-job.submit.ack.rejected`
    - (optional but recommended) a breakdown of rejection reasons using deterministic identifiers aligned with input violation codes.

- [x] Mobile: duplicate submission safety with idempotency key (AC: 3)
  - [x] Ensure rapid double taps and automatic network retries do not generate different idempotency keys for the same user-visible submission attempt.
  - [x] Store the submission attempt idempotency key in local state until the acknowledgment response is received and rendered.

- [x] Backend + Mobile: telemetry for acknowledgment latency and outcome (AC: 1)
  - [x] Add a lightweight telemetry event for submission acknowledgment:
    - include `jobId`, `status` (queued), and rejection reason codes (if rejected)
  - [x] Instrument the timestamping necessary to measure p95 acknowledgment latency (server-side request handling time; avoid including upload time if upload is implemented outside this endpoint).

- [x] Testing: contract correctness, envelopes, idempotency, and UI states (AC: 1, 2, 3)
  - [x] Backend integration/e2e tests:
    - `POST /v1/generation-jobs` happy path returns success envelope + `status: queued`
    - validation failure returns error envelope with deterministic codes/messages (matching contracts)
    - idempotency: same key returns same `jobId` and does not create duplicates
  - [x] Mobile component tests (Jest + RTL):
    - submitting triggers the request with an `x-banyone-idempotency-key` header
    - accepted state is rendered on success
    - rejected state is rendered on validation error
    - `testID`s exist for submit and ack states

## Dev Notes

### Story Type and Scope Guardrails

- In scope:
  - implementing job submission acknowledgment (accepted/rejected)
  - enforcing idempotency safety for duplicate submission
  - server-side validation that matches the UI constraint rules exactly
- Out of scope for this story:
  - the real-time lifecycle timeline and retry controls (Story 1.5)
  - preview, export, and native share (Story 1.6)
  - draft persistence across app restarts and interrupted uploads beyond what is required to submit once (Story 1.7)

### Previous Story Intelligence (from Story 1.3)

- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` currently only handles:
  - selecting video + reference image
  - displaying constraint guidance and the inline input compliance checker
  - running `validateJobInputCompliance()` from `@banyone/contracts`
- Therefore, do NOT reinvent validation logic:
  - backend rejection details must reuse the same violation codes and strings from `@banyone/contracts`
  - UI should continue to treat the constraint display as source-of-truth for input limits

### Technical Requirements (Developer Guardrails)

#### Backend contract requirements

- Endpoint: `POST /v1/generation-jobs`
- Idempotency key:
  - accept via `x-banyone-idempotency-key` (custom header, prefixed with `x-banyone-`)
  - ensure repeated requests with the same key do not create duplicate jobs
- Response:
  - success returns immediately with `{ data: { jobId, status: 'queued' }, error: null }`
  - error returns deterministic envelope `{ data: null, error: { code, message, retryable, details?, traceId } }`

#### Mobile integration requirements

- Keep the acknowledgment latency expectation tied to the backend response time:
  - the app should render accepted/rejected as soon as the POST response returns
  - do not block the acknowledgment UI on preview/export/inference completion (those are later stories)

### Architecture Compliance

- Follow architecture boundaries from `planning-artifacts/architecture.md`:
  - mobile UI calls backend via an API client layer (if `infra/api-client` does not exist yet, create it in a minimal way for this story and keep screens/components free of direct third-party SDK calls)
  - backend job creation logic lives in `apps/backend/src/modules/jobs`
  - implement deterministic error taxonomy consistently with the API envelope pattern

### File Structure Requirements

- Backend (minimum):
  - `apps/backend/src/modules/jobs/jobs.controller.ts`
  - `apps/backend/src/modules/jobs/jobs.service.ts`
  - `apps/backend/src/modules/jobs/dto/*`
  - `apps/backend/src/modules/jobs/jobs.types.ts` (if needed)
  - `apps/backend/src/modules/jobs/jobs.controller.spec.ts` or integration tests under `apps/backend/test`
- Mobile (minimum):
  - update `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
  - add a hook under `apps/mobile/src/features/create-job/hooks/` for submission
  - add a lightweight UI component for ack state if it keeps the screen clean

### Testing Requirements

- Enforce deterministic `testID`s for:
  - the submit button
  - accepted vs rejected acknowledgment states
- Add backend tests that assert:
  - envelope shape correctness
  - deterministic error code/message content for validation failures
  - idempotency mapping behavior

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.4 acceptance criteria]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR3 (immediate submission acknowledgment)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - REST contract, error envelope, idempotency, lifecycle model]
- [Source: `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` - current UI + contracts-based validation integration]
- [Source: `apps/mobile/src/features/create-job/components/input-compliance-checker.tsx` - violation code/message expectations and testID conventions]
- [Source: `packages/contracts/src/input-validation.ts` - deterministic violation codes + user-visible message/fixAction strings]

## Dev Agent Record

### Agent Model Used

GPT-5.4 Nano

### Debug Log References

- Story file generated via `/bmad-create-story` with sprint auto-discovery (next backlog story).

### Completion Notes List

- Implemented backend `POST /v1/generation-jobs` with canonical success/error envelopes, contract-aligned validation via `validateJobInputCompliance()`, deterministic file-persisted idempotency (including restart behavior), and server-side acknowledgment telemetry (latency + outcome).
- Updated mobile `CreateJobScreen` with a primary `create-job.submit.button`, immediate accepted/rejected acknowledgment UI, and a `useJobSubmission()` hook that generates and stores a stable idempotency key per attempt while enforcing in-flight locking to prevent rapid duplicate submissions.
- Added/updated automated tests:
  - Backend Jest + supertest for success, `INPUT_INVALID` validation failures (exact contract-aligned violation details), and idempotency behavior.
  - Mobile RTL component tests verifying `x-banyone-idempotency-key`, accepted/rejected rendering, and deterministic `testID`s.

### File List

- `apps/backend/src/app.module.ts`
- `apps/backend/src/modules/jobs/dto/create-generation-job.request.ts`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.types.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/create-job/types/create-generation-job.ts`
