# Story 1.5: Real-Time Status Timeline with Retry Path

Status: done

## Story

As a casual creator,
I want transparent lifecycle status during processing,
so that I trust progress and can recover from failures.

## Acceptance Criteria

1. **Given** I have a submitted job,  
   **When** the backend state changes,  
   **Then** the app shows status stages (`queued`, `processing`, `ready`, `failed`) with ETA context.

2. **And** status updates are reflected in the UI within 2 seconds at p95 after backend state change.

3. **And** retry controls appear only when failure is retryable.

4. **And** the timeline never skips illegal transitions outside (`queued -> processing -> ready|failed`).

**Verification Note:** Validate state freshness and transition integrity via lifecycle telemetry assertions plus integration tests.

## Tasks / Subtasks

- [x] Backend: add lifecycle status retrieval for mobile timeline (AC: 1, 2, 4)
  - [x] Add `GET /v1/generation-jobs/:id` returning canonical envelope with `status`, `updatedAt`, and optional ETA fields.
  - [x] Include deterministic retry metadata for `failed` states (`retryable`, `reasonCode`, `nextAction`).
  - [x] Keep response format consistent with architecture contract:
    - success: `{ data, meta?, error: null }`
    - error: `{ data: null, error: { code, message, retryable, details?, traceId }, meta? }`

- [x] Backend: enforce lifecycle transition integrity (AC: 4)
  - [x] Centralize status transition rules in jobs domain and reject illegal transitions.
  - [x] Add explicit tests for allowed transitions:
    - `queued -> processing`
    - `processing -> ready`
    - `processing -> failed`
  - [x] Add explicit tests for forbidden transitions (for example `queued -> ready`, `ready -> processing`).

- [x] Mobile: implement reusable status timeline component and screen integration (AC: 1, 2)
  - [x] Implement/update a timeline UI component in `apps/mobile/src/features/create-job/components/` or `apps/mobile/src/features/job-status/components/`.
  - [x] Render stage labels exactly as lifecycle contract (`queued`, `processing`, `ready`, `failed`) with contextual ETA copy.
  - [x] Add accessible, non-color status cues (icon/text plus color).
  - [x] Ensure stage changes are screen-reader announced.

- [x] Mobile: implement status refresh strategy with app lifecycle awareness (AC: 2)
  - [x] Add a polling hook under `apps/mobile/src/features/job-status/hooks/` (or existing feature hooks) with deterministic interval and cleanup.
  - [x] Pause refresh when app is backgrounded and resume with immediate refetch on foreground.
  - [x] Reconcile server truth on every refresh; do not invent client-only states.
  - [x] Capture telemetry timestamps needed to verify 2-second p95 status freshness in test environments.

- [x] Mobile: retry UX for retryable failures only (AC: 3)
  - [x] Show retry CTA only when backend returns failure with `retryable: true`.
  - [x] Hide/disable retry control for non-retryable failures and show actionable guidance instead.
  - [x] Keep retry action routed through job submission/idempotency flow from Story 1.4 (reuse existing hook/service rather than duplicating submit logic).

- [x] Backend + Mobile: telemetry and observability for lifecycle freshness (AC: 2, 4)
  - [x] Emit lifecycle transition telemetry with transition timestamp and from/to states.
  - [x] Emit client receive/render telemetry for each stage update.
  - [x] Add an assertion-friendly metric/report query to validate p95 update freshness and illegal transition count = 0.

- [x] Testing: lifecycle, retry visibility, and UX accessibility gates (AC: 1, 2, 3, 4)
  - [x] Backend integration/e2e tests for status endpoint envelope, retry metadata, and transition invariant protection.
  - [x] Mobile tests for timeline rendering, stage updates, retry CTA visibility rules, and foreground resume refresh behavior.
  - [x] Add stable `testID`s:
    - `job-status.timeline.root`
    - `job-status.timeline.item.queued`
    - `job-status.timeline.item.processing`
    - `job-status.timeline.item.ready`
    - `job-status.timeline.item.failed`
    - `job-status.retry.button`

## Dev Notes

### Story Scope and Dependency Guardrails

- This story starts after Story 1.4 job submission acknowledgment and focuses on lifecycle visibility + failure recovery controls.
- Do not expand to preview/export/share behavior here (Story 1.6).
- Do not introduce new lifecycle states; canonical states remain `queued -> processing -> ready|failed`.

### Previous Story Intelligence (Story 1.4)

- Story 1.4 already introduced `POST /v1/generation-jobs`, idempotency handling, and accepted/rejected acknowledgment UI.
- Reuse the same jobs module and error envelope patterns; do not create parallel status APIs with a different schema.
- Reuse existing submission hook patterns for retry actions to avoid duplicate request/idempotency logic.

### Architecture Compliance (Must Follow)

- API remains REST-first under `/v1`, and all responses must use canonical envelope shape.
- Backend is source of truth for lifecycle state; mobile reconciles on refresh and never bypasses server truth.
- Retry controls must follow deterministic backend retryability metadata (`retryable`).
- Keep files within feature/module boundaries:
  - backend: `apps/backend/src/modules/jobs/*`
  - mobile: `apps/mobile/src/features/job-status/*` and relevant `create-job` integration points

### Technical Requirements

- Expose deterministic status payload fields sufficient for timeline rendering:
  - `jobId`, `status`, `updatedAt`
  - optional ETA context (`etaSeconds` or equivalent bounded representation)
  - failure metadata when `status=failed`: `reasonCode`, `message`, `retryable`, `nextAction`
- Enforce transition invariants in one domain location (service/state machine helper), not scattered conditionals.
- Keep status refresh implementation explicit by operation (for example, `isRefreshingStatus`) rather than generic loading booleans.

### File Structure Notes

- Backend likely touch points:
  - `apps/backend/src/modules/jobs/jobs.controller.ts`
  - `apps/backend/src/modules/jobs/jobs.service.ts`
  - `apps/backend/src/modules/jobs/jobs.types.ts`
  - `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
  - `apps/backend/test/jobs.e2e-spec.ts`
- Mobile likely touch points:
  - `apps/mobile/src/features/create-job/hooks/use-job-submission.ts` (retry integration)
  - `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` (navigation/entry to status tracking)
  - `apps/mobile/src/features/job-status/components/*` (timeline component)
  - `apps/mobile/src/features/job-status/hooks/*` (polling + lifecycle-aware refresh)
  - `apps/mobile/src/features/create-job/screens/*test.tsx` and/or `job-status` test files

### Testing Requirements

- Backend:
  - status endpoint contract + envelope tests
  - allowed/forbidden transition invariant tests
  - retryable vs non-retryable failure metadata tests
- Mobile:
  - timeline renders all canonical states
  - update propagation timing is measurable and asserted in integration-style tests
  - retry CTA visible only for retryable failure
  - accessibility assertions for labels/announcements and non-color cues

### Latest Technical Notes

- Keep lifecycle updates implementation transport-agnostic for MVP: polling is acceptable as long as p95 freshness target is met and app lifecycle pause/resume is handled.
- Avoid premature complexity (for example, introducing websocket/SSE infra) unless the 2-second p95 target is not achievable with measured polling.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Story 1.5 acceptance criteria and verification note]
- [Source: `_bmad-output/planning-artifacts/prd.md` - FR4 and status freshness NFR]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - canonical lifecycle, error envelope, backend source-of-truth, testID conventions]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` - Job Status Timeline Card, explicit stage labels, recovery-first feedback]
- [Source: `_bmad-output/implementation-artifacts/1-4-submit-job-with-immediate-acknowledgment.md` - existing jobs module, idempotency, and submission hook patterns]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex Low

### Debug Log References

- Story file generated via `/bmad-create-story` using sprint auto-discovery for next backlog item.

### Completion Notes List

- Consolidated Story 1.5 functional requirements, NFR freshness constraint, and transition invariants into implementation-ready tasks.
- Added explicit backend/mobile guardrails to prevent lifecycle contract drift and retry UX regressions.
- Included file targets and deterministic `testID` requirements to align with current repository conventions.
- Implemented backend `GET /v1/generation-jobs/:id` lifecycle retrieval with canonical envelope, `updatedAt`, bounded ETA (`etaSeconds`), and deterministic retry metadata for `failed` jobs.
- Added centralized lifecycle transition validator (`jobs.lifecycle.ts`) with explicit allowed/forbidden transition tests, and integrated it into `JobsService`.
- Implemented mobile `JobStatusTimeline` + `useJobStatusPolling` and integrated them into `CreateJobScreen`, including app lifecycle pause/resume refresh and retry UX gating for `retryable: true`.
- Added lifecycle telemetry: backend transition logs, mobile client receive/render + freshness sampling (p95), and a backend `getLifecycleInvariantReport()` diagnostic used by tests.
- Added backend Jest + E2E coverage for the status endpoint contract, retry metadata, and transition invariant protection; added mobile unit/integration tests for timeline rendering, p95 freshness, retry CTA rules, and foreground resume behavior.

### File List

- `_bmad-output/implementation-artifacts/1-5-real-time-status-timeline-with-retry-path.md`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.types.ts`
- `apps/backend/src/modules/jobs/jobs.lifecycle.ts`
- `apps/backend/src/modules/jobs/jobs.lifecycle.spec.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/features/job-status/types/job-status.ts`
- `apps/mobile/src/features/job-status/components/job-status-timeline.tsx`
- `apps/mobile/src/features/job-status/components/job-status-timeline.test.tsx`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-status-1-5-retry-ux.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
