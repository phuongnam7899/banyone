# Story 4.1: Job Diagnostics View for Support

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a support agent,  
I want searchable job diagnostics,  
so that I can identify failures quickly and respond accurately.

## Acceptance Criteria

1. **Support-only access (least privilege)**  
   **Given** an authenticated caller without support privileges  
   **When** they request support diagnostics endpoints  
   **Then** the API returns the canonical error envelope with a stable forbidden code and `retryable: false`.  
   **And** existing user-facing job endpoints keep owner-scoped behavior unchanged.

2. **Searchable diagnostics view**  
   **Given** a support user with access permissions  
   **When** they search by `jobId` (required MVP)  
   **Then** diagnostics return failure category, lifecycle timestamps, and trace identifier.  
   **And** the payload includes enough context for first-response triage (job status, owner/user id, latest update timestamp).

3. **Deterministic failure category mapping**  
   **Given** a job that has failed or was rejected in policy/validation gates  
   **When** diagnostics are returned  
   **Then** failure category is normalized to a documented taxonomy (for example: `validation`, `policy`, `processing-retryable`, `processing-non-retryable`, `abuse-restriction`, `unknown`) rather than ad-hoc strings.  
   **And** category mapping is contract-defined and test-covered.

4. **Traceability and timestamps**  
   **Given** support needs escalation-ready evidence  
   **When** diagnostics are viewed  
   **Then** timestamps are ISO-8601 UTC and include available lifecycle fields (`queuedAt`, `processingAt`, `readyAt`, `failedAt`, `updatedAt`).  
   **And** a stable `traceId` field is present for log correlation.

5. **Data visibility boundaries**  
   **Given** the diagnostics payload contains sensitive context  
   **When** support data is returned  
   **Then** it excludes unnecessary user media or PII and only returns troubleshooting-relevant metadata.  
   **And** access remains restricted to support/moderation scopes as defined by auth claims and guards.

6. **Contract alignment and API consistency**  
   Endpoints, query/response types, error codes, and diagnostic category enums are defined in `packages/contracts` and exported via `packages/contracts/src/index.ts`.  
   All responses use canonical envelopes (`{ data, error: null }` / `{ data: null, error: {...} }`).

7. **Testing**  
   - Unit tests for category mapping and diagnostics assembly logic.  
   - E2E coverage for support-authorized read, forbidden non-support caller, not-found job behavior, and envelope correctness.  
   - Regression checks to ensure existing user job history/detail endpoints are unchanged.

## Tasks / Subtasks

- [x] Contracts: support diagnostics API and types (AC: 2, 3, 4, 6)  
  - [x] Add support diagnostics contracts (query, payload, envelope, error codes, category enum) in a dedicated file (for example `packages/contracts/src/support-diagnostics.ts`).  
  - [x] Export new types/constants from `packages/contracts/src/index.ts`.

- [x] Backend auth and guarding (AC: 1, 5)  
  - [x] Extend auth user shape to include support scope (e.g. `isSupport`) without breaking existing moderator behavior.  
  - [x] Add `SupportGuard` (or equivalent) using the same envelope/error style as existing guards.

- [x] Backend support diagnostics module (AC: 2, 3, 4, 5, 6)  
  - [x] Implement `modules/support` controller/service with `GET /v1/support/job-diagnostics` (MVP: required `jobId` query).  
  - [x] Reuse existing `JobsService` internal read helper (`getJobSnapshotForModeration`) or extract a neutral internal diagnostics reader to avoid duplicate store reads.  
  - [x] Add deterministic category mapper and trace-id sourcing strategy (prefer persisted trace id; if unavailable, define a documented fallback).

- [x] Persistence updates for traceability (AC: 4)  
  - [x] Ensure job lifecycle/failure path stores trace identifier alongside diagnostics-relevant metadata.  
  - [x] Keep migration-safe behavior for existing persisted records (graceful fallback for missing trace id).

- [x] Tests (AC: 7)  
  - [x] Unit tests for mapper and service behavior.  
  - [x] E2E tests for support access control + positive diagnostics retrieval + not-found + envelope shape.

## Dev Notes

- **Business context:** Implements FR22 in Epic 4: support can quickly diagnose failures with consistent metadata to reduce time-to-resolution and improve user recovery outcomes.

- **Architecture fit:** Support tooling belongs in backend `modules/support`, with auth/guard boundaries and least-privilege enforcement from token claims. Keep API under `/v1/*`, canonical envelopes, and deterministic error/diagnostic taxonomy.

### Project Structure Notes

- Backend: `apps/backend/src/modules/support/*` for controller/service/types/tests.  
- Auth updates: `apps/backend/src/modules/auth/*` (user type + verifier + support guard).  
- Contracts: `packages/contracts/src/support-diagnostics.ts` + `packages/contracts/src/index.ts`.  
- E2E: `apps/backend/test/*.e2e-spec.ts` (extend existing suites or add a focused support diagnostics e2e file).

### Technical Requirements

- **Proposed endpoint (MVP):**  
  - `GET /v1/support/job-diagnostics?jobId=<id>`  
  - Response data includes: `jobId`, `status`, `failureCategory`, `traceId`, `updatedAt`, optional lifecycle timestamps, and optional normalized failure details.

- **Failure category source:**  
  - Map from existing `jobs.failure.reasonCode` and policy/validation/restriction outcomes to a closed enum in contracts.  
  - Avoid leaking raw internal implementation messages to support clients unless explicitly approved.

- **Trace-id strategy:**  
  - Use lifecycle/error trace id tied to the underlying failure/diagnostic event.  
  - If historical records predate trace persistence, return a deterministic fallback marker and include migration note.

### Architecture Compliance

- Enforce guard-level separation between user APIs and support diagnostics APIs.  
- Keep controllers orchestration-only; service layer assembles diagnostics.  
- Use contract-first types from `@banyone/contracts`; avoid literal string drift in handlers/tests.

### Library / Framework Requirements

- Continue with existing NestJS module/guard patterns and Jest test strategy.  
- Continue Firebase Admin token verification patterns (`verifyIdToken`) and claim-driven authorization.

### File Structure Requirements

- `apps/backend/src/modules/support/support.controller.ts`  
- `apps/backend/src/modules/support/support.service.ts`  
- `apps/backend/src/modules/support/support.module.ts`  
- `apps/backend/src/modules/auth/support.guard.ts`  
- `packages/contracts/src/support-diagnostics.ts`

### Testing Requirements

- Verify `403` forbidden envelope for authenticated non-support users.  
- Verify successful diagnostics payload includes required fields and normalized category.  
- Verify job-not-found returns deterministic, documented code with trace id.  
- Verify existing `/v1/generation-jobs*` routes behave unchanged for normal users.

### Previous Story Intelligence (Cross-Epic)

- Story 3.4 introduced moderator guard patterns and internal job snapshot access; reuse these access patterns instead of creating parallel ad-hoc readers.  
- Story 3.5 added abuse restriction error paths; diagnostics category mapping must account for those codes without collapsing into generic unknown failures.

### Git Intelligence Summary

- Current workspace already includes auth/moderation/abuse changes across Epic 3 stories; align with those patterns and avoid introducing alternate envelope or guard conventions.

### Latest Tech Information

- Current NestJS guidance still favors metadata-driven guards and controller/service separation for RBAC-style authorization.  
- Firebase Admin token verification remains `verifyIdToken` with server-side claim checks for scope-based access.

### Project Context Reference

- No `project-context.md` found in repository; planning artifacts + existing implementation artifacts are the authoritative context set.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.1, FR22]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR22/FR23/FR24, supportability requirements]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, API patterns, support tooling mapping, canonical envelopes]  
- [Source: `_bmad-output/implementation-artifacts/3-4-moderation-queue-and-actions.md` — guard patterns and internal diagnostics-style reads]  
- [Source: `_bmad-output/implementation-artifacts/3-5-abuse-throttling-controls.md` — error taxonomy additions relevant to diagnostics categorization]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex

### Debug Log References

 - Added contract-first support diagnostics schema with stable error codes and failure taxonomy.
 - Extended auth verification/guard pipeline with support scope while preserving moderator behavior.
 - Added support diagnostics module and neutralized internal jobs snapshot reader for reuse.
 - Persisted per-job trace identifiers with deterministic legacy fallback for pre-existing records.
 - Added unit and e2e coverage for support diagnostics endpoint behavior and envelope shape.

### Completion Notes List

- Story context generated for Epic 4.1 with implementation guardrails, acceptance criteria expansion, and task breakdown aligned to current repo patterns.
- Implemented `GET /v1/support/job-diagnostics` with support/moderator-only guard and canonical response envelopes.
- Added deterministic diagnostics category mapping and contract exports via `@banyone/contracts`.
- Updated jobs persistence and snapshot logic to carry stable trace IDs and legacy-safe fallback (`legacy-trace:<jobId>`).
- Validation completed:
  - `npm run build --workspace @banyone/contracts`
  - `npm run typecheck --workspace @banyone/contracts`
  - `npm run typecheck --workspace backend`
  - `npm run test --workspace backend -- support.service.spec.ts --runInBand`
  - `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts --runInBand -t "support diagnostics"`
  - `npm run test --workspace backend -- jobs.controller.spec.ts --runInBand`
  - IDE lint diagnostics checked via `ReadLints` on all edited files (no errors)

### File List

- `_bmad-output/implementation-artifacts/4-1-job-diagnostics-view-for-support.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `packages/contracts/src/support-diagnostics.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/auth/banyone-user.types.ts`
- `apps/backend/src/modules/auth/firebase-auth.service.ts`
- `apps/backend/src/modules/auth/firebase-auth.guard.ts`
- `apps/backend/src/modules/auth/support.guard.ts`
- `apps/backend/src/modules/auth/auth.module.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/support/support.controller.ts`
- `apps/backend/src/modules/support/support.service.ts`
- `apps/backend/src/modules/support/support.module.ts`
- `apps/backend/src/modules/support/support.service.spec.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/test/jobs.e2e-spec.ts`

### Change Log

- 2026-04-05: Story context generated (create-story workflow).
- 2026-04-05: Implemented support diagnostics endpoint, auth/guard updates, trace persistence, contracts, and tests; story moved to review.
