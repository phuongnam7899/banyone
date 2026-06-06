# Story 4.2: Standard Recovery Guidance Playbooks

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a support agent,  
I want predefined guidance mapped to failure categories,  
so that users receive consistent, actionable recovery instructions.

## Acceptance Criteria

1. **Taxonomy alignment (single source of truth)**  
   **Given** the closed failure taxonomy from Story 4.1 (`SupportDiagnosticsFailureCategory` in `@banyone/contracts`)  
   **When** recovery playbooks are defined or served  
   **Then** every playbook maps to one of those categories (and documents optional finer keys such as `reasonCode` where product UI surfaces them).  
   **And** playbook identifiers and user-facing summary lines do not contradict `failure.retryable` or the job’s normalized `failure.reasonCode` semantics.

2. **Structured playbook content**  
   **Given** a failure category (and optional reason sub-key where applicable)  
   **When** support retrieves playbook content  
   **Then** the payload includes at minimum: short title, user-facing explanation (plain language), explicit retry vs no-retry guidance aligned with category semantics, and suggested next steps (bulleted or newline-separated).  
   **And** content is suitable to paste into email/chat without internal jargon.

3. **Support-only API**  
   **Given** an authenticated caller without support privileges  
   **When** they request recovery playbook endpoints  
   **Then** the API returns the same canonical error envelope pattern as other support routes with a stable forbidden code and `retryable: false`.  
   **And** `SupportGuard` (or equivalent) is used consistently with `GET /v1/support/job-diagnostics`.

4. **Discoverability from diagnostics workflow**  
   **Given** support has loaded job diagnostics for a job (including `failureCategory` and optional `failure` block)  
   **When** they request playbooks for that category (or use a combined response if you extend diagnostics)  
   **Then** they obtain the correct playbook without manual category guessing.  
   **And** if diagnostics return `unknown` category, playbook behavior is defined (e.g. generic fallback playbook + warning to escalate).

5. **Moderation console surfacing (MVP)**  
   **Given** the internal moderation console (`apps/moderation-console`) exists for ops workflows  
   **When** a support/moderator user is signed in  
   **Then** they can look up a job by id, see key diagnostic fields (reuse or lightly duplicate `SupportJobDiagnosticsPayload` fields), and view/copy the matching recovery playbook text.  
   **And** the UI remains dev-lean (consistent with existing `App.tsx` patterns: fetch with bearer token, minimal layout).

6. **Contracts and exports**  
   New types, constants, and envelope shapes for recovery playbooks live in `packages/contracts` (dedicated file, e.g. `recovery-playbooks.ts`) and are exported from `packages/contracts/src/index.ts`.  
   Responses use canonical envelopes (`{ data, error: null }` / `{ data: null, error: {...} }`).

7. **Testing**  
   - Unit tests for playbook registry resolution (category → playbook, unknown fallback, optional reason-code refinement).  
   - Unit/integration tests for support controller guard and envelope shape.  
   - E2E: forbidden for non-support; success path returns playbook payload for a representative category.

## Tasks / Subtasks

- [x] Contracts: recovery playbook types and support API envelope (AC: 1, 2, 6)  
  - [x] Define `RecoveryPlaybook`, list/query response types, and error codes in `packages/contracts`.  
  - [x] Export from `packages/contracts/src/index.ts`.

- [x] Backend: playbook registry + endpoint(s) (AC: 2–4, 6, 7)  
  - [x] Implement a pure registry (category → playbook content), optionally keyed by `reasonCode` where product distinguishes sub-cases.  
  - [x] Add `GET /v1/support/recovery-playbooks` (e.g. optional `failureCategory` query) or category-scoped route under `SupportController`; reuse `SupportGuard` + same throttle/skip patterns as job-diagnostics.  
  - [x] Optionally extend `getJobDiagnostics` to include `recoveryPlaybookId` or embedded playbook summary—only if it reduces round-trips without blurring separation of concerns.

- [x] Moderation console: diagnostics + playbook panel (AC: 5)  
  - [x] Add job id input, call `GET /v1/support/job-diagnostics?jobId=…` then fetch playbook for returned `failureCategory`.  
  - [x] Render title, retry guidance, and copy-friendly body.

- [x] Tests (AC: 7)  
  - [x] Backend unit tests for registry and controller.  
  - [x] E2E additions alongside existing support diagnostics tests in `apps/backend/test/`.

## Dev Notes

- **Business context:** Implements FR23 (standardized recovery guidance by failure category). Builds directly on Story 4.1 diagnostics and the same failure taxonomy—avoid introducing a parallel category enum.

- **Reuse:**  
  - `mapFailureCategoryFromReasonCode` in `apps/backend/src/modules/support/support.service.ts` defines how backend maps stored reason codes to categories; playbooks must stay consistent with that mapping.  
  - `SupportJobDiagnosticsPayload.failure` already exposes `retryable`, `reasonCode`, `nextAction`—playbook text should reinforce those signals, not conflict.

- **Product UI alignment:** Mobile surfaces `reasonCode`, retry UI, policy messages (`policyGuidanceForCode`, rejection violations). Playbook copy should reference the same conceptual buckets (validation, policy, processing retryable/non-retryable, abuse restriction) using contract category ids for support-facing labels where helpful.

### Project Structure Notes

- Backend: extend `apps/backend/src/modules/support/*` (registry module or static map colocated with `SupportService`).  
- Contracts: `packages/contracts/src/recovery-playbooks.ts` (name may vary; keep one focused file).  
- Moderation console: `apps/moderation-console/src/App.tsx` or small extracted components if needed—prefer minimal file split to match current style.  
- Do not duplicate moderator-only routes under `/v1/moderation/*` for this feature unless an existing pattern forces it; support-scoped `/v1/support/*` is the right home.

### Technical Requirements

- **Endpoints (proposed):**  
  - `GET /v1/support/recovery-playbooks?failureCategory=<SupportDiagnosticsFailureCategory>`  
  - Response `data`: playbook document(s) with stable `id` per category (and optional variant id for reason sub-keys).

- **Registry:**  
  - Implement as typed constant map or small class with exhaustive handling for all `SUPPORT_DIAGNOSTICS_FAILURE_CATEGORIES` entries; TypeScript should fail if a category is missing when categories change.

- **Fallback:**  
  - `unknown` category: generic playbook that tells the user to retry later if appropriate and to contact support with trace id—aligned with diagnostics `traceId`.

### Architecture Compliance

- Contract-first types from `@banyone/contracts`; canonical API envelopes everywhere.  
- NestJS: thin controller, logic in service/registry; guards match `support.controller.ts` patterns.  
- No PII in playbook APIs beyond what diagnostics already exposes.

### Library / Framework Requirements

- Existing NestJS, Jest, Firebase auth verification—no new runtime dependencies unless strictly necessary.

### File Structure Requirements

- `packages/contracts/src/recovery-playbooks.ts`  
- `apps/backend/src/modules/support/support.controller.ts` (new route)  
- `apps/backend/src/modules/support/support.service.ts` or `recovery-playbook.registry.ts`  
- `apps/moderation-console/src/App.tsx` (or `support-playbooks-panel.tsx` if split)  
- `apps/backend/test/jobs.e2e-spec.ts` or dedicated support e2e file—follow existing layout

### Testing Requirements

- Mirror 4.1 e2e patterns: authenticated non-support → forbidden envelope; support token → success.  
- Unit test: each category returns non-empty playbook; `unknown` has fallback.

### Previous Story Intelligence (Epic 4)

- **Story 4.1** established `SupportGuard`, `GET /v1/support/job-diagnostics`, `SupportJobDiagnosticsPayload`, and deterministic `mapFailureCategoryFromReasonCode`. Extend that module; do not fork auth or envelope conventions.  
- Story file: `_bmad-output/implementation-artifacts/4-1-job-diagnostics-view-for-support.md` lists completed files and validation commands—reuse the same verification workflow after implementation.

### Git Intelligence Summary

- Recent Epic 4 work touched `support.service.ts`, `support-diagnostics.ts`, and `jobs` trace metadata; keep playbook work additive and regression-safe for diagnostics consumers.

### Latest Tech Information

- No new framework versions required; follow existing NestJS 10+ guard and `@banyone/contracts` import patterns used in `support.controller.ts`.

### Project Context Reference

- No `project-context.md` in repo; this file plus planning artifacts and 4.1 story are authoritative for Epic 4.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4, Story 4.2, FR23]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR23, Journey 3 support playbooks]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `modules/support`, FR22–FR24 mapping]  
- [Source: `packages/contracts/src/support-diagnostics.ts` — failure category enum]  
- [Source: `apps/backend/src/modules/support/support.service.ts` — category mapping]  
- [Source: `_bmad-output/implementation-artifacts/4-1-job-diagnostics-view-for-support.md` — prior story]

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- support.service.spec.ts`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts -t "support recovery playbooks endpoint|support diagnostics endpoint"`
- `npm run typecheck --workspace @banyone/contracts`
- `npm run typecheck --workspace backend`
- `npm run typecheck --workspace moderation-console`
- `npx eslint "src/modules/support/support.controller.ts" "src/modules/support/support.service.ts" "src/modules/support/support.service.spec.ts" "test/jobs.e2e-spec.ts"`

### Completion Notes List

- Added contract-first recovery playbook types and query/response envelopes in `packages/contracts/src/recovery-playbooks.ts` with exports wired through `packages/contracts/src/index.ts`.
- Implemented exhaustive support recovery playbook registry in `SupportService` with reason-code overrides and category fallback behavior, including unknown-category generic guidance.
- Added `GET /v1/support/recovery-playbooks` in `SupportController` behind `SupportGuard` and matching throttle-skip behavior used by existing support diagnostics routes.
- Implemented moderation console MVP support panel in `apps/moderation-console/src/App.tsx` to look up diagnostics by job ID and render copy-friendly playbook content.
- Added unit coverage for playbook resolution and invalid query handling, plus e2e coverage for forbidden non-support access and successful support response payloads.

### File List

- `packages/contracts/src/recovery-playbooks.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/modules/support/support.service.ts`
- `apps/backend/src/modules/support/support.controller.ts`
- `apps/backend/src/modules/support/support.service.spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/moderation-console/src/App.tsx`
- `_bmad-output/implementation-artifacts/4-2-standard-recovery-guidance-playbooks.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-05: Implemented Story 4.2 recovery playbook contracts, support API endpoint + registry, moderation console MVP panel, and supporting unit/e2e coverage.
