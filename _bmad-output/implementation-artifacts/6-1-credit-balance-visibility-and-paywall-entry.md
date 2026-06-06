# Story 6.1: Credit Balance Visibility and Paywall Entry

Status: in-progress

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a creator,  
I want to see my available credits and open paywall when needed,  
so that I understand when I can create and how to continue.

## Acceptance Criteria

1. **Pre-submit credits visibility in create flow**  
   **Given** FR29 requires users to see remaining credits before submission  
   **When** user opens the create flow  
   **Then** the UI displays current balance and compute-rate context (`videoCreditPerSecond`) from backend credits endpoint before submit decisions.

2. **Proactive paywall entry from creation flow**  
   **Given** FR30 allows proactive top-up  
   **When** user taps add-credits affordance from create flow  
   **Then** app navigates to paywall without losing selected draft inputs, and user can return to continue.

3. **Insufficient-credit guard at submission**  
   **Given** user submits a valid job with insufficient credits  
   **When** backend calculates required credits from duration  
   **Then** request is rejected with deterministic `INSUFFICIENT_CREDIT` details (`balance`, `required`, `shortfall`, `videoCreditPerSecond`) and mobile renders actionable message.

4. **Paywall contextual clarity and recovery UX**  
   **Given** user reaches paywall from create flow or insufficient-credit state  
   **When** plans/entitlements are loading or billing initialization fails  
   **Then** paywall shows clear loading, retry, and management guidance, and does not block unrelated app usage (NFR19).

5. **State refresh after billing actions and app foreground**  
   **Given** purchase/restore flow can mutate entitlement outside current screen lifecycle  
   **When** purchase/restore completes or app returns to foreground  
   **Then** app refreshes billing snapshot and generation credits so balance and paywall state converge quickly toward NFR17/NFR20 expectations.

6. **Test coverage and telemetry continuity**  
   **Given** story changes touch submit and paywall entry paths  
   **When** tests run  
   **Then** unit/component tests cover credit badge rendering, add-credits navigation, insufficient-credit messaging, and paywall retry paths; telemetry remains emitted for submit outcomes.

## Tasks / Subtasks

- [x] Verify and finalize credit badge + add-credits entry in create flow UI (AC: 1, 2)
  - [x] Ensure `create-job.credits.badge` and `create-job.credits.add-button` remain stable `testID`s.
  - [x] Confirm no draft-loss regression when navigating `create -> paywall -> create`.
- [ ] Ensure backend credits API and insufficient-credit envelope remain canonical (AC: 1, 3)
  - [ ] Validate `GET /v1/generation-jobs/credits` response shape and auth guard behavior.
  - [ ] Validate `POST /v1/generation-jobs` insufficient-credit error details contract.
- [x] Harden paywall entry/error/retry UX for recoverability (AC: 4, 5)
  - [x] Confirm paywall loading, retry CTA, and management fallback messages are deterministic.
  - [x] Confirm credits refresh runs after purchase/restore and foreground transitions.
- [ ] Add/adjust focused tests for create/paywall/submit credit paths (AC: 6)
  - [x] Mobile tests: create credits badge/button, insufficient-credit rendering, paywall retry.
  - [ ] Backend tests: credits endpoint + insufficient-credit envelope shape.

## Dev Notes

- **Business and FR context:** This story is the entry point for Epic 6 monetization experience and directly covers FR29 and FR30 while setting up FR31-FR36 flows.
- **Do not reinvent:** The repo already includes substantial billing and credits scaffolding. Treat this story as a correctness/hardening pass and gap closure, not a greenfield build.
- **Current implementation signals to reuse:**
  - Create flow credit UI and paywall routing already exist in `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`.
  - Credits context/provider and API fetch logic already exist in `apps/mobile/src/features/create-job/context/generation-credits-context.tsx` and `apps/mobile/src/features/create-job/services/generation-credits-api.ts`.
  - Paywall screen and billing hook flows already exist in `apps/mobile/src/features/billing/screens/paywall-screen.tsx` and `apps/mobile/src/features/billing/hooks/use-billing.ts`.
  - Backend credit gate and credits endpoint already exist in `apps/backend/src/modules/jobs/jobs.service.ts` and `apps/backend/src/modules/jobs/jobs.controller.ts`.
- **Architecture compliance guardrails (must follow):**
  - Keep API envelope contract (`{ data, error }`) and deterministic error codes.
  - Keep billing logic in billing/jobs services; UI/controllers must not directly mutate credits.
  - Maintain feature boundaries (`features/billing`, `features/create-job`, backend `modules/jobs` + `modules/billing`).
  - Preserve stable `testID` naming convention: `screen.element.action[.state]`.
- **Integration and regression risks:**
  - Avoid duplicate or conflicting credit refresh triggers that cause flicker/inconsistent badges.
  - Ensure insufficient-credit path does not get swallowed by generic rejected state handling.
  - Ensure paywall return path does not clear selected media or pending idempotency state unexpectedly.
- **Observability expectations:**
  - Keep submit-result telemetry for insufficient-credit outcomes.
  - Ensure backend rejection details remain structured for support diagnostics and downstream analytics.

### Technical Requirements

- Respect canonical constants/types from `@banyone/contracts` (`INSUFFICIENT_CREDIT_ERROR_CODE`, details parser helpers).
- Keep calculation authority server-side using `computeRequiredCredits(...)` and `UserCreditsStore`.
- Keep foreground refresh behavior for both billing (`useBilling`) and credits (`GenerationCreditsProvider`) to support entitlement drift recovery.
- Do not expose store-sensitive payloads to end-user surfaces.

### Architecture Compliance

- Follows architecture billing model: backend entitlement/credit truth, mobile reflected state.
- Follows API and error schema requirements in architecture patterns.
- Follows least-privilege boundaries: user endpoints for own credits only; support diagnostics deferred to later story.

### Library / Framework Requirements

- Expo/React Native stack remains compatible with project baseline (Expo SDK 55 currently in architecture docs; SDK 56 exists and should be considered separately, not mixed mid-story).
- RevenueCat integration should continue entitlement-first checks and robust `CustomerInfo` refresh behavior; avoid product-only gating logic.

### File Structure Requirements

- **Mobile**
  - `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
  - `apps/mobile/src/features/create-job/context/generation-credits-context.tsx`
  - `apps/mobile/src/features/create-job/services/generation-credits-api.ts`
  - `apps/mobile/src/features/billing/screens/paywall-screen.tsx`
  - `apps/mobile/src/features/billing/hooks/use-billing.ts`
- **Backend**
  - `apps/backend/src/modules/jobs/jobs.controller.ts`
  - `apps/backend/src/modules/jobs/jobs.service.ts`
  - `apps/backend/src/modules/jobs/jobs.types.ts`
  - `apps/backend/src/modules/jobs/user-credits.store.ts`

### Testing Requirements

- Mobile:
  - `create-job-credits-add-button` and submit-path tests cover insufficient-credit and paywall routing.
  - Paywall screen tests cover initialize/loading/retry and purchase outcome messaging.
- Backend:
  - Unit/integration tests verify credits endpoint envelope and insufficient-credit error details shape.
- Lint/typecheck must pass for all touched files.

### Latest Tech Information

- Expo SDK 55 is no longer latest (SDK 56 is released). For this story, avoid opportunistic SDK migration; keep feature work compatible with current project baseline and document migration separately.
- `react-native-purchases` current major line is 10.x; keep existing API usage patterns stable and verify SDK assumptions before upgrading.
- RevenueCat best-practice alignment to preserve:
  - Entitlement-based checks rather than product-only checks.
  - Foreground/customer-info refresh to limit stale subscription state.
  - Graceful handling of transient network errors to avoid false downgrades.

## References

- Epic and Story source: `_bmad-output/planning-artifacts/epics.md`
- FR29-FR30 and NFR17/NFR19/NFR20: `_bmad-output/planning-artifacts/prd.md`
- Architecture constraints and module boundaries: `_bmad-output/planning-artifacts/architecture.md`
- UX principles for low-friction async flows: `_bmad-output/planning-artifacts/ux-design-specification.md`
- Existing implementation anchors:
  - `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
  - `apps/mobile/src/features/create-job/context/generation-credits-context.tsx`
  - `apps/mobile/src/features/create-job/services/generation-credits-api.ts`
  - `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
  - `apps/mobile/src/features/billing/screens/paywall-screen.tsx`
  - `apps/mobile/src/features/billing/hooks/use-billing.ts`
  - `apps/backend/src/modules/jobs/jobs.controller.ts`
  - `apps/backend/src/modules/jobs/jobs.service.ts`
  - `apps/backend/src/modules/jobs/user-credits.store.ts`
  - `apps/backend/src/modules/billing/billing.service.ts`
  - `apps/backend/src/modules/billing/credit-grant-policy.ts`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- Artifact loading: config + epics + PRD + architecture + UX docs
- Source scans: billing/create-job/jobs modules
- Web checks: Expo SDK status and RevenueCat RN SDK updates
- Test run (pass): `npm run test --workspace mobile -- create-job-credits-add-button.test.tsx create-job-submit.test.tsx paywall-screen.test.tsx create-job-screen.story-1-7-draft-persistence.test.tsx`
- Backend test blocker: Firestore-backed backend tests require Firebase runtime configuration and currently time out/fail in local environment.

### Completion Notes List

- Story context generated for first backlog item in Epic 6.
- Acceptance criteria expanded with implementation guardrails for both mobile and backend.
- Existing code reuse map included to prevent duplicate implementation.
- Testing and regression guardrails included for paywall and credit gating flows.
- Added explicit credit-rate context in create flow (`videoCreditPerSecond`) and surfaced insufficient-credit rate details in UX.
- Restored draft persistence banners in create flow to remove existing regression and validate create/paywall/create continuity.
- Hardened paywall retry UX to refresh both billing snapshot and generation credits, plus deterministic recovery guidance copy.
- Added backend auth-guard coverage for `GET /v1/generation-jobs/credits`, but full backend suite execution remains blocked by local Firebase test configuration.

### File List

- `_bmad-output/implementation-artifacts/6-1-credit-balance-visibility-and-paywall-entry.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/billing/screens/paywall-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-credits-add-button.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/billing/screens/paywall-screen.test.tsx`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`

## Change Log

- 2026-05-31: Story context created (BMAD create-story workflow) — status `ready-for-dev`.
- 2026-05-31: Implemented credit-rate visibility, insufficient-credit messaging hardening, paywall retry/management UX updates, and focused mobile/backend test updates (status `in-progress`).

---

**Completion note:** Ultimate context engine analysis completed—comprehensive developer guide created for flawless implementation.
