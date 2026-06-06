# Story 3.2: Policy Screening at Job Acceptance

Status: done

<!-- Validation: optional `validate-create-story` before dev-story. -->

## Story

As the platform,  
I want policy checks at acceptance time,  
so that disallowed submissions are prevented before expensive processing.

## Acceptance Criteria

1. **Given** a user submits a job  
   **When** pre-acceptance policy checks run  
   **Then** disallowed jobs are deterministically rejected with documented codes  
   **And** allowed jobs continue through normal queue flow.
2. Policy screening runs only for requests that already passed the synthetic-media disclosure gate and shared input validation (`validateJobInputCompliance`); invalid inputs still return `INPUT_INVALID` without invoking policy logic (no change to validation semantics).
3. Rejection uses the canonical API error envelope with a **documented, stable machine-readable policy outcome** exported from `packages/contracts` (top-level `error.code` and structured `details` such as `policyCode` / rule identifier) and `retryable: false` for deterministic policy blocks.
4. Allowed submissions preserve existing behaviors: idempotency (`x-banyone-idempotency-key`), job lifecycle (`queued` first), push assist hooks, and disclosure ordering are unchanged except for the new guard position in the pipeline.
5. **Observability / audit foundation:** each policy rejection is attributable in backend logs (or existing trace metadata) with `traceId`, `policyCode`, and user id sufficient for support review—aligning with NFR10 direction without requiring the full moderation queue (Epic 3 Story 3.4).
6. Mobile submission flow handles policy rejections with **explicit, actionable** user messaging (not a generic failure), stable `testID`s for the policy-blocked state, and no regression for disclosure-required, rate limit, or validation paths.

## Tasks / Subtasks

- [x] Define policy error contract (AC: 1, 3, 6)
  - [x] Add shared constants/types in `packages/contracts` for policy rejection: top-level `error.code` value(s) and a small documented enum or union of `policyCode` values in `error.details`.
  - [x] Export from `packages/contracts/src/index.ts` and keep mobile/backend imports aligned.
- [x] Backend: policy evaluation service (AC: 1, 2, 4, 5)
  - [x] Introduce a focused module or service (e.g. `modules/job-policy` or `modules/jobs/policy-screening.service.ts`) that evaluates the normalized `CreateGenerationJobRequestBody` + `userId` and returns pass/fail with a deterministic `policyCode` and message on fail.
  - [x] Implement at least one concrete, testable rule (e.g. storage URI/path blocklist or configurable deny patterns read from env or file) so “disallowed” is not only theoretical; design the evaluator so additional rules can be added without changing the jobs controller contract.
  - [x] **Insert the guard in `JobsService.handleCreateForKey` after validation success and before `randomUUID()` / idempotency persistence** (see Dev Notes ordering diagram).
  - [x] On rejection, return canonical error envelope; on success, fall through to existing job creation path.
  - [x] Log structured policy rejection fields (policyCode, userId, traceId) at the service or jobs layer.
- [x] Backend tests (AC: 1–5)
  - [x] Unit tests for policy evaluator (allowed vs disallowed cases, stable codes).
  - [x] Controller/service tests or e2e extension: submission passes when policy passes; fails with expected envelope when rule triggers; disclosure and `INPUT_INVALID` paths unchanged.
- [x] Mobile: policy rejection UX (AC: 6)
  - [x] Extend `useJobSubmission` (or equivalent) to recognize the new `error.code` and map `details.policyCode` to user-visible copy with recovery guidance where applicable.
  - [x] Add UI state for policy-blocked acknowledgment (mirroring patterns used for `DISCLOSURE_REQUIRED` and validation rejection).
  - [x] Add `testID`s for policy-blocked surfaces; component/integration test covering handler branch.
- [x] Documentation sync (AC: 3)
  - [x] List new error codes in Dev Notes and ensure OpenAPI or inline API docs mention policy rejection if the repo documents `POST /v1/generation-jobs` errors.

## Dev Notes

- **Business context:** Implements **FR17** (policy-based rejection at job acceptance). Complements Story 3.1 (disclosure precondition); does not replace input validation from Epic 1.
- **Guard order in `handleCreateForKey` (do not reorder casually):**
  1. Disclosure acceptance (`DISCLOSURE_REQUIRED`).
  2. Idempotency hit → return existing job (no re-screening needed).
  3. Input validation → `INPUT_INVALID`.
  4. **Policy screening → policy error envelope if blocked.**
  5. Create job, persist idempotency row, enqueue/lifecycle as today.
- **Why after validation:** Policy logic should run on structurally valid payloads only, keeping `INPUT_INVALID` behavior and client copy unchanged and avoiding duplicate “fix your inputs” vs “policy” confusion.
- **Why before job row creation:** Ensures no `queued` job and no idempotency commitment for disallowed work—matches “prevent before expensive processing.”
- **Do not reinvent:** Reuse `makeErrorEnvelope`, existing Nest module patterns, Firebase-authenticated context, and contract-driven mobile error handling. Extend the same patterns used for `DISCLOSURE_REQUIRED` and `RATE_LIMITED`.

### Project Structure Notes

- Prefer new policy logic in its own injectable service and thin wiring from `JobsService` rather than embedding long rule lists in `jobs.service.ts`.
- Contracts remain the cross-repo source of truth for error codes and `details` shapes.
- If a file-backed or env-driven rule list is used, follow the same isolation style as other MVP persistence (e.g. disclosure store directory pattern) and document env vars in backend README or module comment only if introduced.

### Technical Requirements

- REST under `/v1`, canonical envelopes only:
  - Success: `{ data, meta?, error: null }`
  - Error: `{ data: null, error: { code, message, retryable, details?, traceId }, meta? }`
- **`POST /v1/generation-jobs` policy errors (Story 3.2):**
  - `error.code`: `POLICY_VIOLATION` (exported as `POLICY_VIOLATION_ERROR_CODE` from `@banyone/contracts`).
  - `error.details.policyCode`: `STORAGE_URI_BLOCKED` when a configured URI blocklist substring matches (`JOB_POLICY_CODE_STORAGE_URI_BLOCKED`).
  - `retryable`: `false`.
  - Server config (optional): `BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS` — comma-separated substrings; if unset or blank, no URI blocklist rules run.
- Policy rejections: `retryable: false` unless a future rule explicitly allows retry without input change (default false for MVP).
- DTO validation at API edge unchanged; policy consumes already-validated body shape.
- Preserve deterministic taxonomy: every policy failure maps to a documented `error.code` + `details.policyCode` (or agreed equivalent) — no free-form-only errors.

### Architecture Compliance

- Policy gate at pre-submit acceptance with auditable/logged outcomes per architecture “Policy gate insertion points” and “Error taxonomy.”
- Module boundaries: controller thin; domain/rules in policy service; jobs orchestration stays in jobs module.
- **Cross-story:** Story 3.4 will deepen moderation queues and audit storage; this story establishes **acceptance-time** rejection and **documented codes** only.

### Library / Framework Requirements

- Backend: NestJS DI, existing Jest tests, `@banyone/contracts` for shared types.
- Mobile: Expo/React Native stack, existing API client and submission hook patterns.

### File Structure Requirements

- **Contracts:** `packages/contracts/src/` (new policy error module), `packages/contracts/src/index.ts`.
- **Backend:** `apps/backend/src/modules/jobs/jobs.service.ts` (single insertion point), new policy module/service files under `apps/backend/src/modules/...`, tests alongside.
- **Mobile:** `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`, create-job screen/tests as needed.

### Testing Requirements

- Cover matrix: policy pass → job accepted; policy fail → no new job row, stable envelope; disclosure block unchanged; invalid input unchanged; idempotent replay after prior success unchanged.
- Mobile: assert new branch does not clear idempotency incorrectly and shows correct copy/`testID`.

### Previous Story Intelligence (3-1)

- Disclosure gate lives **before** idempotency check; policy gate lives **after** idempotency miss and **after** validation success—do not conflate with disclosure.
- Implemented paths: `SyntheticMediaDisclosureStore`, `DISCLOSURE_REQUIRED`, contracts in `packages/contracts/src/synthetic-media-disclosure.ts`, mobile handling in `useJobSubmission` for `DISCLOSURE_REQUIRED_ERROR_CODE`.
- Files touched in 3-1 (reference patterns only): `jobs.service.ts`, disclosure module, `use-job-submission.ts`, `create-job-screen.tsx`, `jobs.e2e-spec.ts`, contract exports.

### Git Intelligence

- Recent epic work: commit `caa56ac` (“done 3-1”) — disclosure and job guard patterns; extend that code path rather than branching new submission endpoints.

### Latest Tech Notes

- No mandatory third-party moderation API for this story: rule-based MVP is acceptable if deterministic and test-covered; keep adapter-shaped interface if external screening is introduced later.

### Project Context Reference

- No `project-context.md` found in repo; use this story + planning artifacts as authority.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.2, FR17]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Trust/Safety FR17, safety checks at job acceptance]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — policy pre-checks, error envelope, error taxonomy, `packages/contracts` as source of truth]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — actionable errors, recovery-first messaging, accessibility]
- [Source: `_bmad-output/implementation-artifacts/3-1-synthetic-media-disclosure-gate.md` — prior gate patterns and file list]

## Dev Agent Record

### Agent Model Used

Cursor Agent (GPT-5.1)

### Debug Log References

—

### Completion Notes List

- Added `@banyone/contracts` policy surface: `POLICY_VIOLATION_ERROR_CODE`, `JOB_POLICY_CODE_STORAGE_URI_BLOCKED`, `isJobPolicyViolationDetails`, and `JobPolicyViolationErrorDetails`.
- Implemented `JobPolicyScreeningService` + `JobPolicyModule` with env-driven URI substring blocklist (`BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS`); wired into `JobsService.handleCreateForKey` after validation and before job/idempotency persistence.
- Policy rejections return canonical envelope with structured `details.policyCode`, `telemetry.jobs.policy.rejected.v1` logging, and acknowledgment telemetry includes policy codes in `rejectionCodes` when applicable.
- Mobile: `useJobSubmission` handles `POLICY_VIOLATION`; create-job screen shows dedicated policy-blocked panel with stable `testIDs` and trace/policy code for support.
- **Build note:** run `npm run build --workspace @banyone/contracts` (or full workspace build) so backend resolves new exports from `dist`.

### File List

- `_bmad-output/implementation-artifacts/3-2-policy-screening-at-job-acceptance.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/contracts/src/job-policy.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/job-policy/job-policy.module.ts`
- `apps/backend/src/modules/job-policy/job-policy-screening.service.ts`
- `apps/backend/src/modules/job-policy/job-policy-screening.service.spec.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`

### Change Log

- 2026-04-02: Implemented policy screening at job acceptance (contracts, backend service + guard, observability, mobile UX/tests, controller inline docs, Dev Notes error taxonomy).
