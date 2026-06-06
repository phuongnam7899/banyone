# Story 4.3: Escalation Workflow with Context Handoff

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a support agent,  
I want to escalate unresolved incidents with complete context,  
so that technical teams can resolve issues without repeating triage.

## Acceptance Criteria

1. **Support-only access (consistent with 4.1 / 4.2)**  
   **Given** an authenticated caller without support privileges  
   **When** they call escalation create, read, or status-update endpoints  
   **Then** the API returns the canonical error envelope with a stable forbidden code and `retryable: false`.  
   **And** `SupportGuard` and the same throttle-skip patterns as `GET /v1/support/job-diagnostics` apply.

2. **Create escalation with attached context**  
   **Given** a support user triggers an escalation for a job  
   **When** the create request is valid  
   **Then** the persisted record includes at minimum:  
   - Stable `escalationId`, `jobId`, `createdAt`, `traceId` (for correlation), `actorUserId` (support user who filed).  
   - A **snapshot** of diagnostics context equivalent to `SupportJobDiagnosticsPayload` at creation time (failure category, status, lifecycle timestamps, normalized failure block when present).  
   - A **user impact summary** field: support-authored plain-language text (required min length defined in contracts, e.g. ≥ 20 chars) describing customer impact / urgency.  
   **And** the snapshot is immutable after creation (subsequent job changes do not rewrite the escalation record’s stored context).

3. **Timeline evidence**  
   **Given** an escalation is created  
   **When** the record is retrieved  
   **Then** the stored diagnostics snapshot includes the lifecycle timestamp fields returned by diagnostics (`queuedAt`, `processingAt`, `readyAt`, `failedAt`, `updatedAt` as applicable) so engineering sees the same timeline support saw.  
   **And** optional `recoveryPlaybookId` (or category-level playbook reference) may be included if the client passed it or the server resolves it—do not duplicate full playbook bodies if already available via `GET /v1/support/recovery-playbooks`.

4. **Trackable status until resolution**  
   **Given** an escalation exists  
   **When** support (or same support scope) updates lifecycle  
   **Then** status follows a closed enum (for example: `open`, `in_progress`, `resolved`, `cancelled`) with `statusUpdatedAt` and optional `resolutionNotes`.  
   **And** clients can fetch a single escalation by id and list/filter by `jobId` and/or `status` for MVP operations tooling.

5. **Moderation console MVP**  
   **Given** the internal moderation console (`apps/moderation-console`) already loads diagnostics and playbooks  
   **When** a support user is signed in  
   **Then** they can create an escalation from the current job context (pre-fill job id + diagnostics-derived fields) and view recent escalations for that job or see status on the created record.  
   **And** UI stays dev-lean (reuse existing `App.tsx` fetch + token patterns).

6. **Contracts and exports**  
   New types, constants, and envelope shapes for escalations live in `packages/contracts` (dedicated file, e.g. `support-escalations.ts`) and are exported from `packages/contracts/src/index.ts`.  
   Responses use canonical envelopes (`{ data, error: null }` / `{ data: null, error: {...} }`).

7. **Testing**  
   - Unit tests for store/repository and status transitions.  
   - Unit/integration tests for support controller: forbidden non-support, happy-path create + get + patch/list.  
   - E2E: align with existing `jobs.e2e-spec.ts` support sections—non-support forbidden, support create/list/get/update.

## Tasks / Subtasks

- [x] Contracts: escalation types, status enum, create/list/get/patch payloads, error codes (AC: 2, 4, 6)  
  - [x] Define `SupportEscalationRecord`, `SupportEscalationDiagnosticsSnapshot` (may alias or extend fields from `SupportJobDiagnosticsPayload` without circular imports—prefer composition).  
  - [x] Export from `packages/contracts/src/index.ts`.

- [x] Backend: persistence + service (AC: 2–4, 6, 7)  
  - [x] Add JSON file store under configurable dir (e.g. `BANYONE_SUPPORT_DATA_DIR` or `.banyone-support-data`) following `ModerationActionStore` / `OutputReportStore` patterns: versioned JSON, snake_case on disk, camelCase in contracts at API boundary.  
  - [x] Implement `SupportEscalationStore` (or service-internal persistence) with create, getById, list (filter by `jobId`, `status`), updateStatus.  
  - [x] On create, build diagnostics snapshot by reusing `SupportService.getJobDiagnostics` logic or a shared internal assembler—**must not** fork category mapping; import/use `mapFailureCategoryFromReasonCode` / existing diagnostics assembly.

- [x] Backend: HTTP API (AC: 1–4, 7)  
  - [x] `POST /v1/support/escalations` — body: `jobId`, `userImpactSummary`, optional `notes`, optional `recoveryPlaybookId`.  
  - [x] `GET /v1/support/escalations/:escalationId`  
  - [x] `GET /v1/support/escalations?jobId=&status=` (pagination optional MVP: simple limit)  
  - [x] `PATCH /v1/support/escalations/:escalationId` — body: `status`, optional `resolutionNotes`  
  - [x] Wire routes in `SupportController` with `SupportGuard`, `FirebaseAuthGuard`, `BanyoneUserThrottlerGuard` + `@SkipThrottle` matching existing support routes.

- [x] Moderation console (AC: 5)  
  - [x] Add “Escalate” flow after diagnostics load: POST with pre-filled snapshot fields; show returned `escalationId` and status.  
  - [x] Optional: list escalations for current `jobId` query.

- [x] Tests (AC: 7)  
  - [x] Unit: store + service.  
  - [x] E2E: extend support tests in `apps/backend/test/jobs.e2e-spec.ts` or dedicated support e2e file.

## Dev Notes

- **Business context:** Implements **FR24** and Epic 4 Story 4.3—escalations carry diagnostic context so engineering does not re-triage from scratch.

- **Reuse (do not reinvent):**  
  - Diagnostics assembly and `SupportJobDiagnosticsPayload` shape from `SupportService` / `packages/contracts/src/support-diagnostics.ts`.  
  - Recovery playbook identifiers from `packages/contracts/src/recovery-playbooks.ts` if you store a reference.  
  - Auth: `SupportGuard`, support user shape in `banyone-user.types.ts`.  
  - Audit field patterns from `ModerationActionRecord` (`actorUserId`, `traceId`, ISO timestamps).

- **Immutability:** Store a **point-in-time** diagnostics snapshot on create; do not refresh from live job on GET (that would violate AC2). If product later needs “current job state,” add an explicit separate field or a follow-up story.

### Project Structure Notes

- Backend: `apps/backend/src/modules/support/*` — new store file + service methods + controller routes.  
- Contracts: `packages/contracts/src/support-escalations.ts`.  
- Moderation console: `apps/moderation-console/src/App.tsx` (or small extracted component if file grows).  
- Keep escalation data in **support** module storage, not mixed into moderation JSON, to preserve least-privilege and module boundaries—even if the console is shared UI.

### Technical Requirements

- **Error codes (suggested):** `SUPPORT_ESCALATION_FORBIDDEN`, `SUPPORT_ESCALATION_INVALID_BODY`, `SUPPORT_ESCALATION_NOT_FOUND`, `SUPPORT_ESCALATION_JOB_NOT_FOUND` (if job missing at create time—align with diagnostics not-found behavior).  
- **Id generation:** `randomUUID()` from `crypto` (consistent with other modules).  
- **Validation:** Reject create if `jobId` does not exist or diagnostics cannot be assembled; return canonical not-found/invalid envelope.

### Architecture Compliance

- Contract-first DTOs; canonical API envelopes; NestJS thin controllers; no PII beyond what diagnostics already expose (owner user id as opaque id is acceptable per 4.1).  
- File-backed store matches existing MVP persistence pattern documented in architecture as transitional; structure the store so a future Firestore migration can map 1:1.

### Library / Framework Requirements

- No new runtime dependencies unless strictly necessary; reuse NestJS + existing guards.

### File Structure Requirements

- `packages/contracts/src/support-escalations.ts`  
- `apps/backend/src/modules/support/support-escalation.store.ts` (or equivalent)  
- `apps/backend/src/modules/support/support.service.ts` (extend)  
- `apps/backend/src/modules/support/support.controller.ts` (extend)  
- `apps/backend/src/modules/support/support.service.spec.ts` (extend)  
- `apps/backend/test/jobs.e2e-spec.ts` or `support.e2e-spec.ts`  
- `apps/moderation-console/src/App.tsx`

### Testing Requirements

- Mirror 4.1/4.2 e2e: mock or seed job data as existing tests do; assert envelope shape and status codes.  
- Unit test: invalid status transition rejected (optional if enum-only).

### Previous Story Intelligence (Epic 4)

- **4.1** introduced `SupportGuard`, `GET /v1/support/job-diagnostics`, and `SupportJobDiagnosticsPayload`.  
- **4.2** added `GET /v1/support/recovery-playbooks` and exhaustive playbook registry—escalation may reference playbook id only.  
- Story files: `4-1-job-diagnostics-view-for-support.md`, `4-2-standard-recovery-guidance-playbooks.md` list verification commands—reuse the same contract/backend/moderation-console checks after implementation.

### Git Intelligence Summary

- Recent Epic 4 work centers on `support.service.ts`, `support.controller.ts`, and moderation console `App.tsx`; extend those files with additive changes and regression-safe tests.

### Latest Tech Information

- No version bumps required; follow existing NestJS 10+ and `@banyone/contracts` import patterns.

### Project Context Reference

- No `project-context.md` in repo; planning artifacts + Epic 4 story files are authoritative.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.3, FR24]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR24, Journey 3 escalation with diagnostic context]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Support tooling FR22–FR24, module boundaries]  
- [Source: `packages/contracts/src/support-diagnostics.ts` — diagnostics payload / categories]  
- [Source: `packages/contracts/src/recovery-playbooks.ts` — playbook ids]  
- [Source: `apps/backend/src/modules/moderation/moderation-action.store.ts` — JSON store pattern]  
- [Source: `_bmad-output/implementation-artifacts/4-2-standard-recovery-guidance-playbooks.md` — prior story]

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run typecheck --workspace @banyone/contracts`
- `npm run typecheck --workspace backend`
- `npm run test --workspace backend -- support.service.spec.ts support-escalation.store.spec.ts --runInBand`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts --runInBand -t "support escalation"`
- `npm run typecheck --workspace moderation-console`
- `npx eslint "src/modules/support/support.controller.ts" "src/modules/support/support.service.ts" "src/modules/support/support.module.ts" "src/modules/support/support.service.spec.ts" "src/modules/support/support-escalation.store.ts" "src/modules/support/support-escalation.store.spec.ts" "test/jobs.e2e-spec.ts"` (from `apps/backend`)

### Completion Notes List

- Added contract-first support escalation models/envelopes and exported them from contracts index.
- Implemented `SupportEscalationStore` with file-backed persistence (`BANYONE_SUPPORT_DATA_DIR`) and snake_case disk schema.
- Extended `SupportService` and `SupportController` with create/get/list/patch support escalation endpoints using the existing support auth/throttle pattern.
- Reused diagnostics assembly (`getJobDiagnostics`) when creating escalation snapshots to preserve failure-category mapping and timeline fields.
- Added backend unit coverage for escalation service/store and e2e coverage for forbidden + support happy-path + invalid/missing job errors.
- Added moderation-console escalation UI flow (create + list) using existing token/fetch patterns and diagnostics context.

### File List

- `packages/contracts/src/support-escalations.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/support/support-escalation.store.ts`
- `apps/backend/src/modules/support/support-escalation.store.spec.ts`
- `apps/backend/src/modules/support/support.service.ts`
- `apps/backend/src/modules/support/support.service.spec.ts`
- `apps/backend/src/modules/support/support.controller.ts`
- `apps/backend/src/modules/support/support.module.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/moderation-console/src/App.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-escalation-workflow-with-context-handoff.md`

### Change Log

- 2026-04-05: Implemented Story 4.3 support escalation workflow across contracts, backend persistence/service/API, moderation console flow, and automated tests; story moved to `review`.
