# Story 3.5: Abuse Throttling Controls

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the platform,  
I want account/device abuse throttling controls,  
so that runaway misuse and cost spikes are contained.

## Acceptance Criteria

1. **Enforcement surface (compute-heavy actions)**  
   **Given** an account or device is under an active abuse restriction  
   **When** the user attempts a **policy-defined restricted action** (minimum: **POST `/v1/generation-jobs`** and **POST `/v1/generation-jobs/:id/export`**—align with architecture: throttling on job creation and media/export operations)  
   **Then** the request is **blocked before** new job/export work is queued (same failure ordering as other policy gates: fail fast, no partial side effects).  
   **And** the API returns the **canonical error envelope** with a **stable, documented** `error.code` (distinct from **`RATE_LIMITED`** / Story **2.3** and from **`POLICY_VIOLATION`** / Story **3.2**) and `retryable` semantics that match the restriction type (e.g. permanent moderator action → `retryable: false`; optional time-bound restriction → `retryable: true` with coherent `details` if product chooses TTL).

2. **Manual operations path (FR19)**  
   **Given** a caller with **moderation privileges** (same foundation as Story **3.4**: Firebase custom claim and/or `BANYONE_MODERATOR_UIDS` for dev/test)  
   **When** they apply or clear a restriction for a **subject** (at minimum **Firebase `uid`** / account scope)  
   **Then** the restriction is **persisted** and becomes visible to enforcement on subsequent user requests.  
   **And** **Story 3.4**’s `RESTRICT_RECOMMENDED` action may remain a recommendation-only record **or** be wired to **auto-apply** a default restriction—pick **one** explicit behavior in contracts/README and implement consistently (do not leave ambiguous double meaning).

3. **Automated or threshold-based triggers (epic wording)**  
   **Given** configurable **abuse signals** exist (MVP: define at least **one** automated rule, e.g. rolling job count per account over a window, and/or automatic apply when a moderator uses a specific action type—see AC 2)  
   **When** a threshold is crossed  
   **Then** a **restriction is created or escalated** with `reason` / `source` metadata (`automated` vs `manual`) for audit.  
   **Out of scope for MVP:** ML-based abuse classifiers; keep rules deterministic and testable.

4. **Audit and support logging**  
   **Given** any restriction is **created, updated, or cleared**  
   **When** the operation completes  
   **Then** an **append-only or append-oriented** audit record exists (separate document or clearly namespaced section in the abuse store) with at minimum: `recordId`, `subjectType` (`account` minimum; `device` optional if implemented), `subjectId`, `action` (`apply` | `clear` | `update`), `actorUserId` (or `system`), `createdAt`, `traceId`, `reason`, `source` (`manual` | `automated`), and optional `expiresAt`.  
   **And** structured logs (e.g. `console.info` telemetry lines) include `traceId`, `subjectId`, and `action` for operational search.

5. **Identity scopes**  
   **Given** the PRD/architecture call for **device/account** controls  
   **When** implementing MVP  
   **Then** **account (`uid`) enforcement is mandatory**.  
   **And** **device** scope is **optional but recommended**: if added, use an **explicit** client-provided stable identifier (e.g. header such as `x-banyone-device-id`—follow architecture custom header prefix) validated for format/length; **do not** infer device from IP alone. Document contract in `@banyone/contracts` and mobile fetch layer.

6. **User-facing clarity (extends FR14 / Story 2.3 patterns)**  
   **Given** a blocked request due to **abuse restriction** (not rolling rate limit)  
   **When** the mobile client parses the envelope  
   **Then** the UI does **not** treat it as a generic network failure and **does not** reuse the **rate-limit countdown** UX unless `details` intentionally mirror that pattern—use copy appropriate to **account/usage abuse** (support/contact guidance as needed).  
   **Add/extend tests** analogous to **2.3** for the new code path.

7. **Contract alignment**  
   Request/response bodies, enums, and error codes for abuse restriction and moderator endpoints are defined in **`packages/contracts`** and exported via `packages/contracts/src/index.ts`. No ad-hoc string codes outside documented unions.

8. **Persistence (MVP)**  
   Follow the same MVP pattern as **3.3**/**3.4**: file-backed JSON under a configurable directory (e.g. `BANYONE_ABUSE_DATA_DIR` or a subfolder of existing moderation data—document choice), versioned document shape, **easy migration** toward Firestore collections later [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture].

9. **Operator surface**  
   **Given** moderators need to act without raw API calls  
   **When** implementing  
   **Then** extend **`apps/moderation-console`** with minimal UI to **view** active restrictions for a looked-up subject and **apply/clear** (or link to detail view)—keep scope thin; API-first is acceptable only if console ships in the same story with working buttons against real endpoints.

10. **Testing**  
    - Backend unit tests for store + enforcement ordering + moderator-only mutations.  
    - E2E: restricted user cannot create job/export; non-moderator cannot mutate restrictions; audit records append as expected.  
    - Preserve regressions: **2.3** rate-limit behavior unchanged; **3.2** policy screening unchanged for non-restricted users.

## Tasks / Subtasks

- [x] Contracts (AC: 1, 5, 7)  
  - [x] Define abuse restriction error code(s), `details` shape, subject types, moderator request/response DTOs, and audit record types.  
  - [x] Export from `packages/contracts/src/index.ts`; `npm run build --workspace @banyone/contracts`.

- [x] Backend: abuse restriction store + service (AC: 2, 4, 8)  
  - [x] New store module (e.g. `modules/abuse` or nested under `modules/moderation`—prefer **separate `abuse` module** to keep moderation “reporting” vs “enforcement” boundaries clear; use `forwardRef` if needed).  
  - [x] Implement apply/clear/read APIs; deterministic file locking or single-writer pattern consistent with other JSON stores.

- [x] Backend: enforcement (AC: 1, 5)  
  - [x] Inject check in `JobsService` early in `handleCreateForKey` (after disclosure, before idempotency return is acceptable; before validation/policy) and in export path.  
  - [x] Optional: read device header in controller and pass to service for device-scoped restrictions.

- [x] Backend: automated thresholds (AC: 3)  
  - [x] Implement at least one rule (config via env: window size, max jobs) using existing job store counts or a lightweight counter—document limitations at MVP scale.

- [x] Backend: moderator routes (AC: 2, 7)  
  - [x] `ModeratorGuard` + REST under `/v1/...` (e.g. `/v1/moderation/abuse-restrictions` or nested resource) with canonical envelopes.

- [x] Web: moderation console (AC: 9)  
  - [x] Minimal forms/list for restriction lifecycle.

- [x] Mobile (AC: 6)  
  - [x] Map new error code in `use-job-submission` / export flows; testIDs for accessibility.

- [x] Tests (AC: 10)  
  - [x] Unit + e2e as above.

## Dev Notes

- **Business context:** Implements **FR19** — operations can apply throttling or restrictions to abusive accounts/devices [Source: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`]. Completes the loop from **3.4** moderation actions to **enforceable** platform restrictions.

- **Differentiation from Story 2.3:** `BanyoneUserThrottlerGuard` + `ThrottlerEnvelopeExceptionFilter` implement **rolling per-window request limits** (`RATE_LIMITED`, HTTP 429). Story **3.5** is **discretionary abuse policy** (moderator/system), persisted state, and should use a **different** `error.code` and product copy—do not overload `RATE_LIMITED` for account bans.

- **Differentiation from Story 3.2:** `JobPolicyScreeningService` evaluates **content/policy** rules on submission. Abuse restrictions are **identity-based entitlements**—evaluate in a dedicated service or clearly named helper to avoid mixing concerns.

### Project Structure Notes

- Backend: `apps/backend/src/modules/abuse/*` (suggested) or `apps/backend/src/modules/moderation/abuse-*` if you must colocate; register in `app.module.ts`.  
- Contracts: `packages/contracts/src/abuse-restrictions.ts` (or similar).  
- Console: extend `apps/moderation-console/src/**`.  
- Tests: co-located `*.spec.ts`, `apps/backend/test/*.e2e-spec.ts`.

### Technical Requirements

- **REST shape (illustrative—finalize in contracts):**  
  - `GET /v1/moderation/abuse-restrictions?subjectType=&subjectId=` — read active restriction (or 404 / empty payload pattern—document one).  
  - `POST /v1/moderation/abuse-restrictions` — apply.  
  - `DELETE` or `POST .../clear` — clear.  
  Use envelopes consistent with **3.2**/**3.3**/**3.4**.

- **Moderator routes:** `@SkipThrottle` on read-heavy list endpoints if needed; mutation endpoints may stay throttled per global policy—align with **3.4** notes.

- **Order of checks in `handleCreateForKey`:** disclosure → **abuse restriction** → idempotency → input validation → job policy → persist job.

### Architecture Compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Abuse controls: device/account throttling; auditable moderation actions; API `/v1`; structured errors; rate limiting per identity class (future tiers).]  
- Separate **abuse enforcement** from **content policy** and from **generic rate limits**.  
- Observability: include `traceId` in error envelopes and telemetry lines.

### Library / Framework Requirements

- Backend: NestJS, Jest, existing Firebase auth stack; no Redis required for MVP file store.  
- Reuse `firebase-admin` / `ModeratorGuard` patterns from **3.4**.

### File Structure Requirements

- **Contracts:** `packages/contracts/src/*.ts`, `packages/contracts/src/index.ts`.  
- **Backend:** `apps/backend/src/modules/jobs/jobs.service.ts` (enforcement hooks), new abuse module, `apps/backend/src/modules/auth/moderator.guard.ts` (reuse).  
- **Tests:** `apps/backend/test/jobs.e2e-spec.ts` or dedicated `abuse.e2e-spec.ts`.

### Testing Requirements

- Prove restricted user receives documented error code on create/export.  
- Prove moderator can apply/clear; prove audit trail append-only semantics for apply/clear.  
- Prove automated rule fires in a controlled test (env-tuned thresholds).

### Previous Story Intelligence (3.4)

- Moderation uses `ModeratorGuard`, `BANYONE_MODERATOR_UIDS`, custom claim `moderation: true`; `OutputReportStore` / `ModerationActionStore` under configurable dirs; `moderation-console` exists—**extend** rather than duplicate auth wiring.  
- `RESTRICT_RECOMMENDED` was explicitly **not** enforcing entitlement in **3.4**—**3.5** must define what happens when a moderator wants real restriction (new endpoint and/or auto-apply).  
- Files for cross-reference: `moderation.controller.ts`, `moderation-action.store.ts`, `moderation.service.ts`, `packages/contracts/src/moderation-ops.ts`.

### Previous Story Intelligence (2.3)

- Mobile must parse JSON **envelope** on non-2xx responses before falling through to `NETWORK_ERROR`; add parallel path for the new abuse code—see `use-job-submission.ts` and `create-job-screen.tsx` patterns.

### Git Intelligence Summary

- Recent commits on `main` may not reflect **3.2**–**3.4** merges; treat implementation artifacts and current workspace files as authoritative for patterns.

### Latest Tech Information

- NestJS `@nestjs/throttler` v6+ with Nest 11: keep **existing** throttle config; abuse restriction is **orthogonal** (application-level check, not `ThrottlerGuard`).

### Project Context Reference

- No `project-context.md` in repo; planning artifacts + this story + contracts are authoritative.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.5, FR19]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR14, FR19, Trust and Safety Operations]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, Abuse controls, API error handling, Rate limiting]  
- [Source: `_bmad-output/implementation-artifacts/3-4-moderation-queue-and-actions.md` — moderator auth, stores, console]  
- [Source: `_bmad-output/implementation-artifacts/2-3-user-facing-rate-limit-notices.md` — RATE_LIMITED UX, envelope parsing]

## Dev Agent Record

### Agent Model Used

GPT-5.3 Codex

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- abuse.service.spec.ts`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts`
- `npm run test --workspace mobile -- create-job-submit.test.tsx preview-export-panel.test.tsx`

### Completion Notes List

- Added abuse throttling contracts (`ABUSE_RESTRICTION_ACTIVE`, DTOs, audit types, envelopes) and exported them via contracts index.
- Implemented backend abuse module with file-backed restriction store + append-oriented audit trail (`BANYONE_ABUSE_DATA_DIR`) and moderator-protected apply/clear/get APIs under `/v1/moderation/abuse-restrictions`.
- Implemented deterministic automated threshold rule (`BANYONE_ABUSE_THRESHOLD_MAX_JOBS`, `BANYONE_ABUSE_THRESHOLD_WINDOW_MS`) with explicit MVP limitation (in-memory rolling counter).
- Enforced abuse restrictions in `JobsService` for create and export paths before policy screening/export side effects using canonical envelope errors.
- Kept Story 3.4 `RESTRICT_RECOMMENDED` as recommendation-only behavior, documented in contracts + moderation console README.
- Extended moderation console UI with lookup/apply/clear controls for active restrictions.
- Extended mobile create/export error handling to render dedicated abuse-restriction UX (not rate-limit countdown UX).
- Added/updated tests for store/service behavior, enforcement ordering, moderator-only mutations, audit append semantics, and mobile parsing/rendering paths.

### File List

- `packages/contracts/src/abuse-throttling.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/moderation-ops.ts`
- `apps/backend/src/modules/abuse/abuse-restriction.store.ts`
- `apps/backend/src/modules/abuse/abuse.service.ts`
- `apps/backend/src/modules/abuse/abuse.controller.ts`
- `apps/backend/src/modules/abuse/abuse.module.ts`
- `apps/backend/src/modules/abuse/abuse.service.spec.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.module.ts`
- `apps/backend/src/app.module.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `apps/moderation-console/src/App.tsx`
- `apps/moderation-console/README.md`

### Change Log

- 2026-04-05: Story context generated (create-story workflow).
- 2026-04-05: Implemented abuse throttling controls end-to-end (contracts, backend enforcement/routes/audit, moderation console operator flow, mobile error UX, and test coverage).
