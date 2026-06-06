# Story 3.3: In-App Reporting for Generated Outputs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,  
I want to report outputs that violate policy,  
so that unsafe or abusive content can be reviewed promptly.

## Acceptance Criteria

1. **Given** I am viewing a completed generation output (`job` in `ready` state with preview/export available)  
   **When** I open the report flow and submit a policy report with a **reason category** (and optional short details where permitted)  
   **Then** the client calls an authenticated API that persists the report with **required metadata** (at minimum: `reportId`, `jobId`, `reporterUserId`, `reasonCategory`, `createdAt`, and correlation `traceId` from the response envelope).  
   **And** I see **explicit confirmation** that the report was received (not a silent success).

2. **Authorization / scope:** Only the **owning user** of the job may create a report for that job (same ownership rule as `GET /v1/generation-jobs/:id`). Attempts for other users’ jobs return a deterministic, documented error code (e.g. `NOT_FOUND` or `FORBIDDEN`—pick one and document it in contracts) with `retryable: false`.

3. **Contract alignment:** Request/response bodies and reason categories are defined in **`@banyone/contracts`** and exported through `packages/contracts/src/index.ts`. Success uses the **canonical envelope** (`data`, `error: null`); failures use the canonical error envelope with stable `error.code` values.

4. **Persistence (MVP):** Reports are **durable for moderation handoff**—stored in backend persistence consistent with current MVP patterns (file-backed store under a configurable data dir, analogous to `BANYONE_JOBS_DATA_DIR`, **or** an extendable repository abstraction if Firestore is introduced later). Story **3.4** will consume this data for queues; do **not** build full moderator UI here.

5. **Observability:** Successful report creation emits structured log (or existing telemetry pattern) including `traceId`, `jobId`, `reportId`, and `reasonCategory` for support alignment (NFR / audit direction).

6. **Mobile UX:** Reporting entry point is available from the **output viewing surface**—minimum scope: **`PreviewExportPanel`** / ready-result path when status is `ready` (see `ReadyResultScreen`). Use **stable `testID`s** on report entry, category selection, submit, and confirmation per project convention (`screen.element.action`). Accessibility: buttons use `accessibilityRole="button"`; loading and error states are explicit.

7. **Out of scope for this story:** Moderator queue UI, automated takedown, push notifications to staff, and abuse throttling (Epic **3.4** / **3.5**). Duplicate-submit deduplication is optional; if omitted, document that multiple reports per job/user are allowed.

## Tasks / Subtasks

- [x] Contracts (AC: 1, 3)
  - [x] Define `OutputReportReasonCategory` (or equivalent) union/enum and zod/types as used elsewhere in contracts.
  - [x] Define request/response types for `POST` report (e.g. `CreateOutputReportRequest`, `CreateOutputReportResponse`).
  - [x] Export from `packages/contracts/src/index.ts`; build contracts package after changes.
- [x] Backend: moderation report API + persistence (AC: 1–5)
  - [x] Add `modules/moderation` (or nested under jobs if team prefers thin moderation—prefer **separate module** per architecture) with controller route under `/v1/...`, service, and file-backed store (or repository) for report records.
  - [x] Validate job exists, status is `ready` (or product-approved subset), and `userId` matches job owner before accept.
  - [x] Return success envelope with `reportId` and timestamps; map failures to canonical codes.
  - [x] Unit tests for store/service; controller/integration or e2e test for happy path + forbidden case.
- [x] Mobile (AC: 1, 3, 6)
  - [x] Add feature folder `apps/mobile/src/features/moderation-report/` (screens/components/hooks) **or** colocate a compact hook + sheet under `preview-export` if reporting UI is minimal—prefer feature folder if more than one screen.
  - [x] Wire `authenticated-fetch` + Firebase token; handle envelope errors consistently with `useJobSubmission`-style parsing where applicable.
  - [x] Component tests covering submit + confirmation + error branch `testID`s.
- [x] Documentation (AC: 3)
  - [x] Inline OpenAPI-style comment on new route in controller (match `jobs.controller.ts` style for `POST /v1/generation-jobs`).

## Dev Notes

- **Business context:** Implements **FR16** (report policy-violating outputs). Builds on **3.1** (disclosure) and **3.2** (acceptance policy)—this is **post-generation** trust/safety, not pre-submit.
- **Architecture mapping:** Trust/safety FR15–FR19 → mobile `moderation-report`, backend `modules/moderation` [Source: `_bmad-output/planning-artifacts/architecture.md` — Requirements to Structure Mapping]. Firestore collection name `moderation_events` is the **target** long-term model; MVP file store should use a shape **easy to migrate** (plain objects with `snake_case` persistence fields if stored as JSON rows).
- **Do not reinvent:** Reuse `FirebaseAuthGuard`, `makeErrorEnvelope` / global exception filter patterns, `authenticated-fetch`, and contracts-first DTOs. Mirror **jobs** module patterns for test isolation (`BANYONE_*_DATA_DIR` env for store path in tests).

### Project Structure Notes

- Backend NestJS feature module with thin controller.
- Mobile: feature-first under `features/moderation-report` **or** shared report sheet consumed by `preview-export`—either is acceptable if boundaries stay clear (UI in features, no business logic in `shared/`).
- Contracts remain the cross-repo source of truth; mobile/backend import types from `@banyone/contracts` only.

### Technical Requirements

- **REST:** New route under `/v1`, e.g. `POST /v1/generation-jobs/:jobId/reports` (nested resource) **or** `POST /v1/moderation/output-reports` with `jobId` in body—prefer **nested** route for clarity and ownership checks by `:jobId`.
- **Canonical envelopes only** (same as Story 3.2):
  - Success: `{ data, meta?, error: null }`
  - Error: `{ data: null, error: { code, message, retryable, details?, traceId }, meta? }`
- **Request body (illustrative—finalize in contracts):**
  - `reasonCategory`: required enum from contracts.
  - `details`: optional string with max length (e.g. 500–1000 chars) to reduce abuse; empty string treated as omitted.
- **Success `data` (illustrative):**
  - `reportId: string`
  - `jobId: string`
  - `createdAt: string` (ISO 8601 UTC)
- **Reason categories (MVP set—adjust only with PM alignment):** e.g. `HARASSMENT`, `HATE`, `SEXUAL_CONTENT`, `VIOLENCE`, `ILLEGAL`, `COPYRIGHT`, `SPAM`, `OTHER` — keep the list **small and documented** so Story 3.4 queue filters stay simple.

### Architecture Compliance

- Separate **moderation** API from jobs orchestration where practical; jobs module may **inject** a read-only check for “job exists + ready + owner” or moderation service calls `JobsService`—avoid circular modules (use forwardRef or shared domain port only if necessary).
- **Error taxonomy:** All errors documented in contracts; no ad-hoc string codes.
- **Test IDs:** Follow `job-result.*` / `history.detail.*` patterns; new IDs should be namespaced e.g. `job-result.report.*` or `moderation-report.*`.

### Library / Framework Requirements

- Backend: NestJS, Jest, existing guards/throttler—consider `@SkipThrottle` default for read routes; POST may inherit user throttler (align with other mutating routes).
- Mobile: Expo/React Native, existing theme/components (`ThemedText`, `Pressable`).
- No new heavy dependencies unless required for modal/sheet; prefer existing RN primitives.

### File Structure Requirements

- **Contracts:** `packages/contracts/src/` (new file e.g. `output-report.ts`), `packages/contracts/src/index.ts`.
- **Backend:** `apps/backend/src/modules/moderation/*`, register in `app.module.ts`; tests co-located.
- **Mobile:** `apps/mobile/src/features/moderation-report/**` and integration touch points in `preview-export/components/preview-export-panel.tsx` (or parent `ready-result-screen`).
- **E2E:** extend `apps/backend/test/jobs.e2e-spec.ts` **or** add `moderation.e2e-spec.ts` if cleaner.

### Testing Requirements

- Backend: create report for owned `ready` job → 200 + persisted record; wrong user → 4xx documented code; non-ready job → 4xx; validation errors for bad category/body.
- Mobile: render test for report flow + confirmation; optional integration test with mocked fetch.
- Preserve regression: existing job list/detail/preview flows still pass.

### Previous Story Intelligence (3-2)

- Policy at **acceptance** uses `POLICY_VIOLATION` + `details.policyCode`; **output reporting** is a **different** concern—do not overload `POLICY_VIOLATION` for user reports; use distinct routes and codes (e.g. `OUTPUT_REPORT_ACCEPTED` is not an error—success data only).
- **3.2 file list** for patterns: `jobs.service.ts`, `job-policy-screening.service.ts`, `use-job-submission.ts`, contracts `job-policy.ts`.
- Logging: Story 3.2 used `telemetry.jobs.policy.rejected.v1`; add a **new** telemetry event name for reports (e.g. `telemetry.moderation.outputReport.submitted.v1`) rather than overloading job policy events.

### Git Intelligence

- Recent epic commits in log are older labeled milestones (`done 3-1`, etc.); implementation should follow current `main` patterns in `jobs` and contracts.

### Latest Tech Notes

- No third-party moderation SaaS required for MVP; storage + API only. Queue processing is Story **3.4**.

### Project Context Reference

- No `project-context.md` in repo; this story and planning artifacts are authoritative.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.3, FR16]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR16, trust/safety reporting]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Trust/safety module mapping, `moderation_events`, API envelopes, test ID conventions]
- [Source: `_bmad-output/implementation-artifacts/3-2-policy-screening-at-job-acceptance.md` — envelope patterns, contracts, logging]

## Dev Agent Record

### Agent Model Used

—

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- moderation`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts`
- `npm run test --workspace mobile -- output-report-panel`
- `npm run test --workspace mobile -- preview-export-panel`

### Completion Notes List

- Added contracts-first output reporting types/reason categories and exported them via `@banyone/contracts`.
- Implemented `POST /v1/generation-jobs/:jobId/reports` in new backend `moderation` module with file-backed persistence and ownership/status checks.
- Enforced deterministic canonical errors: `JOB_NOT_FOUND` for non-existent/non-owned jobs and `JOB_NOT_READY` for non-ready jobs.
- Added structured telemetry event `telemetry.moderation.outputReport.submitted.v1` with `traceId`, `jobId`, `reportId`, and `reasonCategory`.
- Added mobile in-app reporting UI in ready-result flow (`job-result.report.*` testIDs), using authenticated fetch and canonical envelope parsing.
- Added backend unit tests (service/store), backend e2e coverage for report flow, and mobile component tests for confirmation and error branches.

### File List

- `packages/contracts/src/output-report.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/modules/moderation/moderation.module.ts`
- `apps/backend/src/modules/moderation/moderation.controller.ts`
- `apps/backend/src/modules/moderation/moderation.service.ts`
- `apps/backend/src/modules/moderation/output-report.store.ts`
- `apps/backend/src/modules/moderation/moderation.service.spec.ts`
- `apps/backend/src/modules/moderation/output-report.store.spec.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/features/moderation-report/hooks/use-output-report-submission.ts`
- `apps/mobile/src/features/moderation-report/components/output-report-panel.tsx`
- `apps/mobile/src/features/moderation-report/components/output-report-panel.test.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-05: Implemented Story 3.3 end-to-end (contracts, backend moderation reporting API + persistence, mobile reporting flow, and tests).
