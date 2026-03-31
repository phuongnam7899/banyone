# Story 2.2: Job History List and Detail Views

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning user,  
I want to view recent jobs and statuses,  
so that I can revisit outputs and understand past attempts.

## Acceptance Criteria

1. **Given** I have previous jobs  
   **When** I open history  
   **Then** I see a list with status, timestamps, and quick actions.

2. **And** selecting a history item opens a detail view showing lifecycle information for that job (`queued`, `processing`, `ready`, `failed`), deterministic failure metadata when present, and actionable next steps.

3. **And** list and detail data are user-scoped to the authenticated identity from Story 2.1; unauthorized requests are rejected with canonical error envelope.

4. **And** an empty-state experience is provided when no jobs exist, with a direct CTA back to create flow.

5. **And** mobile and backend tests cover: happy path list/detail, empty-state rendering, unauthorized access handling, and route-level contract shape.

## Tasks / Subtasks

- [x] **Backend: user-scoped history endpoints (AC: 1, 2, 3, 5)**
  - [x] Add `GET /v1/generation-jobs` with user scoping from authenticated user context.
  - [x] Add `GET /v1/generation-jobs/:id` with ownership check; return deterministic not-found/forbidden behavior per project conventions.
  - [x] Return canonical envelopes only (`{ data, meta?, error: null }` or `{ data: null, error, meta? }`).
  - [x] Keep response payload restricted to story scope fields: status, timestamps, identifiers, retryability metadata.

- [x] **Mobile: history list and detail UX (AC: 1, 2, 4, 5)**
  - [x] Create `apps/mobile/src/features/history/` (`screens`, `components`, `hooks`, `services`, `types`) and route entry screen in app router.
  - [x] Build list UI showing status, timestamp, and quick actions using stable `testID` values (`history.list.item.<jobId>`, `history.list.open-detail.button`, etc.).
  - [x] Build detail UI showing lifecycle state, timestamps, failure context, and retry/view actions based on status.
  - [x] Implement first-use empty state with one dominant CTA to create flow.

- [x] **Reuse existing behavior; avoid reinvention (AC: 2, 5)**
  - [x] Reuse existing create/status/preview services for quick actions where possible (navigate to existing status/preview/export flows).
  - [x] Reuse existing lifecycle labels and deterministic error messaging patterns from Story 1.5 and 1.6.
  - [x] Do not duplicate auth header logic; route all requests through authenticated API client from Story 2.1.

- [x] **Testing and quality gates (AC: 5)**
  - [x] Backend controller/service tests for list/detail success, unauthorized, and non-owned job access.
  - [x] Mobile screen/hook tests for loading, empty, populated list, and detail rendering.
  - [x] Contract-level assertions that list/detail API fields remain compatible with shared contracts package.

## Dev Notes

### Story scope and dependency guardrails

- **Primary requirement:** FR13 (recent job history and status) with dependency on Story 2.1 auth/session binding.
- **Dependencies:** Story 2.1 stable user identity/session, Epic 1 lifecycle persistence.
- **Data scope constraint:** Include only fields required by history list/detail rendering; defer analytics-only attributes to Epic 5.
- **Out of scope:** notification preferences (2.5), push lifecycle triggers (2.4), explicit rate-limit notice UX (2.3), support diagnostics (Epic 4).

### Previous Story Intelligence (Story 2.1)

- Auth foundation is in place with `BanyoneAuthProvider`, authenticated fetch wrapper, and backend token guard. Build directly on this path.
- Jobs persistence already includes `userId` and per-user idempotency scoping. History must query by `userId` and never return cross-user records.
- Existing tests already validate auth failures and envelope shape in jobs controller; extend patterns instead of inventing new response forms.
- Existing create/status/preview flows have deterministic lifecycle semantics and established test approach. Reuse these signals and avoid duplicating lifecycle logic in history layer.

### Architecture compliance (must follow)

- **API style:** REST-first, versioned `/v1`, canonical response envelope.
- **State model:** History/detail must reflect canonical lifecycle (`queued -> processing -> ready|failed`) without adding new states.
- **Boundary rule:** mobile UI uses feature hooks/services; no direct Firebase SDK usage from components.
- **Structure rule:** implement under `apps/mobile/src/features/history/` and backend jobs/auth modules, aligned with documented project structure.
- **Test identity rule:** all primary interactive mobile elements must expose stable `testID` values, deterministic and language-independent.

### Technical Requirements

- Backend list/detail DTOs should expose ISO 8601 UTC timestamps and `camelCase` API fields.
- Ownership checks should produce deterministic user-facing error codes/messages aligned with contract taxonomy.
- Preserve existing idempotency/retry behavior in creation flow; history is read-focused and must not alter write semantics.
- Keep pagination strategy lightweight for MVP (simple cursor/page metadata optional) while ensuring no regression in current endpoint behavior.

### File Structure Requirements (likely touch points)

- **Backend**
  - `apps/backend/src/modules/jobs/jobs.controller.ts`
  - `apps/backend/src/modules/jobs/jobs.service.ts`
  - `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
  - Optional DTO/types additions under `apps/backend/src/modules/jobs/`

- **Mobile**
  - New: `apps/mobile/src/features/history/**`
  - Route wiring in `apps/mobile/src/app/` (history entry + detail route if needed)
  - Optional shared UI reuse from existing status/preview components

- **Contracts**
  - `packages/contracts/src/` updates only if new shared DTO/error shapes are required; avoid unnecessary contract churn.

### Library / Framework Requirements

- Continue Expo SDK 55 conventions (existing workspace baseline).
- Continue NestJS 11 + existing auth guard pattern using Firebase token verification.
- Keep fetch-based mobile API stack and existing authenticated wrapper; do not introduce a second networking abstraction.

### Testing Requirements

- Backend: unit/integration tests for auth scoping, ownership checks, and envelope shape.
- Mobile: list/detail + empty-state tests, and quick-action behavior tests for status-based actions.
- Ensure touched-module lint/typecheck/tests pass at workspace level.

### Git Intelligence Summary

- Recent commit style is story-completion oriented (`done story X.Y`); implementation has been incremental by story and module.
- Prior work concentrated in jobs/auth services and create/status/preview mobile features; this story should extend those modules rather than introducing parallel alternatives.

### Latest Technical Information

- Expo docs continue to support explicit SDK 55 template usage (`create-expo-app --template default@sdk-55`) and emphasize matching runtime constraints during auth integration.
- Firebase Admin token verification best practice remains Bearer ID token verification at backend guard boundary; history endpoints should use the same guard path as existing protected job routes.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2]
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR13]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — API/versioning/envelopes, lifecycle model, structure/testID conventions]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — empty-state and recovery clarity patterns]
- [Source: `_bmad-output/implementation-artifacts/2-1-lightweight-user-identity-and-session-binding.md` — auth/session implementation baseline]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex

### Debug Log References

- Added backend history list API and contract-safe payload/envelope types.
- Added mobile history feature (types/services/hooks/screens) and route wiring.
- Added backend/mobile tests for history list/detail success and edge flows.
- Validation: backend tests pass, mobile tests pass, backend lint pass, mobile lint pass.

### Completion Notes List

- Implemented user-scoped history list endpoint and deterministic ownership-safe detail behavior.
- Implemented mobile history list/detail UX with empty-state CTA and stable testIDs.
- Added shared contracts for history list/detail payload envelopes.
- Completed full backend and mobile test suites and lint gates successfully.

### File List

- `_bmad-output/implementation-artifacts/2-2-job-history-list-and-detail-views.md`
- `apps/backend/src/modules/jobs/jobs.controller.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.types.ts`
- `apps/mobile/src/components/app-tabs.tsx`
- `apps/mobile/src/app/history.tsx`
- `apps/mobile/src/app/history-detail/[id].tsx`
- `apps/mobile/src/features/history/types/history.ts`
- `apps/mobile/src/features/history/services/history-api.ts`
- `apps/mobile/src/features/history/hooks/use-job-history.ts`
- `apps/mobile/src/features/history/screens/history-list-screen.tsx`
- `apps/mobile/src/features/history/screens/history-detail-screen.tsx`
- `apps/mobile/src/features/history/screens/history-list-screen.test.tsx`
- `apps/mobile/src/features/history/screens/history-detail-screen.test.tsx`
- `packages/contracts/src/api-history.ts`
- `packages/contracts/src/index.ts`

## Change Log

- 2026-03-30: Implemented Story 2.2 history list/detail backend + mobile UX, tests, and contracts. Status moved to `review`.
