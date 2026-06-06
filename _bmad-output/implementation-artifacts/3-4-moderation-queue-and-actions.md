# Story 3.4: Moderation Queue and Actions

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an operations moderator,  
I want a queue of flagged jobs with moderation controls,  
so that I can review incidents and apply policy actions effectively.

## Acceptance Criteria

1. **Authorization (least privilege)**  
   **Given** a caller without moderation privileges  
   **When** they call moderator-only routes (queue, detail, actions)  
   **Then** the API returns the canonical error envelope with a **stable, documented** `error.code` (e.g. `FORBIDDEN` or `MODERATION_FORBIDDEN`) and `retryable: false`.  
   **And** regular user job APIs remain unchanged (no broadening of owner-only reads).

2. **Queue list**  
   **Given** one or more persisted output reports exist (from Story **3.3**, `OutputReportStore` / `output-reports.json`)  
   **When** a moderator requests the moderation queue  
   **Then** the response lists **queue items** sorted by report recency (newest first) with **pagination** (e.g. `page`/`pageSize` or `cursor`—pick one pattern and document in contracts).  
   **And** each item includes **report fields** (`reportId`, `jobId`, `reporterUserId`, `reasonCategory`, `createdAt`, `traceId`, optional `details`) **plus job context** sufficient for triage: at minimum `job` `status`, `userId` (job owner), and `updatedAt`, and lifecycle timestamps already exposed on history detail where available (`queuedAt`, `processingAt`, `readyAt`, `failedAt` as applicable) and `failure` when present.

3. **Detail view**  
   **Given** a valid `reportId`  
   **When** a moderator requests report detail  
   **Then** the response returns the same enriched shape as list (or a superset) **and** the **audit trail** of moderation actions for that report (see AC 5), ordered oldest → newest.

4. **Moderation actions + audit trail**  
   **Given** an open report  
   **When** a moderator submits a supported **action**  
   **Then** the system persists an **append-only** moderation action record with at minimum: `actionId`, `reportId`, `jobId`, `actorUserId` (moderator Firebase `uid`), `actionType`, `createdAt`, `traceId`, and optional `notes` (bounded length, same order of magnitude as output-report details).  
   **And** responses use the **canonical success/error envelope** pattern used elsewhere (`data` / `error: null` vs structured error).  
   **And** structured logs or telemetry lines include `traceId`, `reportId`, `jobId`, and `actionType` for operational alignment.

5. **Action types (MVP set)**  
   Define a **small closed enum** in `@banyone/contracts` (e.g. `DISMISS`, `ESCALATE`, `RESTRICT_RECOMMENDED`—exact names are up to PM/eng but must be **fixed and documented**).  
   **Out of scope for this story:** enforcing **account/device throttling** or automated restrictions—that is Epic **3.5**; this story may record a **recommendation** action type but must **not** silently change user entitlements unless an existing hook already exists (it likely does not—do **not** invent throttle storage here).

6. **Contract alignment**  
   Request/response bodies, enums, and error codes for moderator endpoints are defined in **`packages/contracts`** and exported via `packages/contracts/src/index.ts`. No ad-hoc string codes outside documented unions.

7. **Persistence (MVP)**  
   Follow the same MVP pattern as **3.3**: file-backed JSON under a configurable directory (e.g. `BANYONE_MODERATION_DATA_DIR`), with a **versioned** store document for **moderation actions** (separate from `output-reports.json` or clearly namespaced within the same directory). Shape should remain **easy to migrate** toward Firestore `moderation_events` [Source: `_bmad-output/planning-artifacts/architecture.md` — Data Architecture].

8. **Moderation tools (operator surface)**  
   **Given** the epic acceptance criterion (“moderator opens moderation tools”)  
   **When** a moderator signs in  
   **Then** they can open a **minimal internal moderation UI** that: lists queue items, shows detail context for one item, and submits at least one moderation action end-to-end against the real API (not mocked in production build).  
   **Suggested implementation:** new workspace `apps/moderation-console` (Vite + React + TypeScript) using Firebase client auth and the same bearer-token pattern as mobile, **or** an equivalently thin web surface agreed during implementation—**do not** put operator workflows inside the consumer mobile app. If scope pressure is extreme, ship **backend + contracts + e2e first**, then add the web shell in the same story only if timeboxed; the story is not satisfied without **some** operator-visible surface that exercises the queue (API-only with Postman is **not** sufficient for AC 8).

9. **Testing**  
   - Backend unit tests for new stores/services (moderator auth edge cases, action append, list ordering).  
   - E2E: moderator can list/detail/act; non-moderator receives documented forbidden code; missing report returns documented `NOT_FOUND` (or equivalent).  
   - Preserve regressions: Story **3.3** user report flow still passes.

## Tasks / Subtasks

- [x] Contracts (AC: 5, 6)  
  - [x] Define moderator queue list/detail response types, pagination params, moderation `actionType` enum, action request/response, and error codes.  
  - [x] Export from `packages/contracts/src/index.ts`; run `npm run build --workspace @banyone/contracts`.

- [x] Backend: authorization (AC: 1)  
  - [x] Extend Firebase verification so moderator routes can read **custom claims** (e.g. `moderation: true`) **and/or** support `BANYONE_MODERATOR_UIDS` (comma-separated) for dev/test—document security implications; test verifier must support a deterministic moderator path (similar to existing test tokens in `FirebaseAuthService`).  
  - [x] Add a `ModeratorGuard` (or equivalent) applied only to moderator controllers; keep `BanyoneAuthUser` minimal on normal routes unless you thread claims via request augmentation.

- [x] Backend: jobs read for moderators (AC: 2, 3)  
  - [x] Add **internal** read helpers on `JobsService` (or a dedicated collaborator) to load job snapshot **by `jobId` without owner check**, for use **only** from moderation module after moderator guard passes—avoid exposing this through user-facing controllers.

- [x] Backend: `OutputReportStore` (AC: 2, 3)  
  - [x] Add **list** / **get by id** capabilities (efficient enough for MVP file store; full scan acceptable at MVP scale).  
  - [x] Implement join/enrichment with job snapshot in `ModerationService` (or dedicated facade).

- [x] Backend: moderation actions store (AC: 4, 5, 7)  
  - [x] New store (e.g. `moderation-action.store.ts`) with append-only writes and read-by-report.  
  - [x] Wire `POST` action endpoint(s) and detail endpoint in `ModerationController` under `/v1/...` with OpenAPI-style comments matching `moderation.controller.ts` style.

- [x] Web: moderation console (AC: 8)  
  - [x] New app under `apps/moderation-console` (or agreed alternative): list, detail, action submit, error states.  
  - [x] Document local run and env vars in app README **only if** the repo convention expects it; otherwise `.env.example` at app or root as appropriate.

- [x] Tests (AC: 9)  
  - [x] Unit + e2e as above; extend or add `moderation.e2e-spec.ts` if cleaner than overloading `jobs.e2e-spec.ts`.

## Dev Notes

- **Business context:** Implements **FR18** — operations can review policy-flagged work and record moderation actions [Source: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/prd.md`]. Builds directly on **3.3** persisted reports; **3.5** will add abuse throttling—stay aligned but do not implement throttle enforcement here.

- **Architecture:** Trust/safety stays in `modules/moderation`; jobs remain the lifecycle authority; authorization uses Firebase token claims as described in architecture [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, API Boundaries, Requirements to Structure Mapping]. Use **canonical REST** `/v1/...`, kebab-case segments, camelCase query params.

### Project Structure Notes

- Backend: extend `apps/backend/src/modules/moderation/*`; register new providers in `moderation.module.ts`; avoid circular imports with `JobsModule` (use `forwardRef` only if strictly necessary).  
- Contracts: `packages/contracts/src/moderation-ops.ts` (or similar name—avoid clashing with existing `output-report.ts`).  
- Web: `apps/moderation-console/**` with workspace name aligned to `apps/*` in root `package.json`.  
- Do **not** store moderator-only business logic in `shared/` on mobile; ops UI is separate.

### Technical Requirements

- **REST shape (illustrative—finalize in contracts):**  
  - `GET /v1/moderation/output-reports` — queue list + pagination + optional filters (`reasonCategory`, …).  
  - `GET /v1/moderation/output-reports/:reportId` — detail + audit trail.  
  - `POST /v1/moderation/output-reports/:reportId/actions` — create action.  
  Use **envelopes** consistent with Stories **3.2**/**3.3**: success `{ data, error: null }`; errors `{ data: null, error: { code, message, retryable, traceId, details? } }`.

- **Moderator identity:** Prefer **custom claims** checked server-side; env allowlist is **dev/test only**, not a production substitute for claims.

- **Throttling:** Moderator routes should use `@SkipThrottle` where appropriate (read-heavy list/detail) to avoid blocking ops under load; align with `ModerationController` patterns from **3.3**.

### Architecture Compliance

- Separate **moderation** APIs from user job routes; internal job reads must stay behind moderator guard + service-layer encapsulation.  
- **Error taxonomy:** all codes in contracts; map domain failures to stable codes.  
- **Observability:** include `traceId` in responses and logs (pattern from `telemetry.moderation.outputReport.submitted.v1` in **3.3**—add sibling events for moderation actions).

### Library / Framework Requirements

- Backend: NestJS, Jest, existing Firebase auth stack; extend `firebase-admin` token decoding only where needed.  
- Web console: Vite + React + TypeScript; Firebase Auth JS SDK for sign-in; no new UI framework unless already in workspace—**prefer plain fetch** + contracts types.

### File Structure Requirements

- **Contracts:** `packages/contracts/src/*.ts`, `packages/contracts/src/index.ts`.  
- **Backend:** `apps/backend/src/modules/moderation/*`, `apps/backend/src/modules/auth/*` (guards/services as needed), `apps/backend/src/app.module.ts` if new imports.  
- **Tests:** co-located `*.spec.ts`, `apps/backend/test/*.e2e-spec.ts`.  
- **Console:** `apps/moderation-console/package.json`, `vite.config.ts`, entry HTML/TSX.

### Testing Requirements

- Prove **forbidden** path for non-moderator JWT.  
- Prove **happy path**: list → detail → action → detail shows new action.  
- Prove **idempotency is not required** for actions (multiple actions allowed) unless PM specifies otherwise—default: append-only history.

### Previous Story Intelligence (3.3)

- Reports are in `OutputReportStore` (`output-reports.json`); records use `snake_case` persisted fields—**stay consistent** for new stores.  
- User report endpoint: `POST /v1/generation-jobs/:jobId/reports` with `JOB_NOT_FOUND` / `JOB_NOT_READY` semantics—moderator endpoints must **not** reuse owner-only job error paths blindly; define moderator-specific not-found for unknown `reportId`.  
- File list from **3.3** for cross-reference: `moderation.controller.ts`, `moderation.service.ts`, `output-report.store.ts`, `packages/contracts/src/output-report.ts`, `jobs.e2e-spec.ts` report tests.  
- Reuse `makeErrorEnvelope`-style patterns where the module already centralizes them; extract shared helper if duplication grows.

### Git Intelligence

- Recent `git log` may not show **3.2**/**3.3** merges; treat **3.3** implementation artifact and current `main` files as authoritative for patterns.

### Latest Tech Information

- NestJS 11 + existing `firebase-admin` usage: use `verifyIdToken` to read `customClaims` when implementing moderator checks; keep verifier modes (`BANYONE_AUTH_VERIFIER=test`) working for CI.

### Project Context Reference

- No `project-context.md` located in repo; planning artifacts + this story + contracts are authoritative.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 3, Story 3.4, FR18]  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR18, Journey 3 (operations user), NFR audit/moderation]  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Authentication & Security, moderation module mapping, `moderation_events`, API envelopes]  
- [Source: `_bmad-output/implementation-artifacts/3-3-in-app-reporting-for-generated-outputs.md` — persistence, routes, telemetry, file list]

## Dev Agent Record

### Agent Model Used

- GPT-5.3 Codex

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- moderation.service.spec.ts output-report.store.spec.ts moderation-action.store.spec.ts`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts`
- `npm run typecheck --workspace backend`
- `npm run typecheck --workspace moderation-console`
- `npx eslint src/modules/auth/firebase-auth.service.ts src/modules/jobs/jobs.service.ts src/modules/moderation/*.ts test/jobs.e2e-spec.ts` (run from `apps/backend`)

### Completion Notes List

- Added moderation operator contracts (`moderation-ops.ts`) with queue/detail/action payloads, error codes, pagination shape, and fixed action enum.
- Implemented moderator authorization path with Firebase custom claim support (`moderation: true`) plus `BANYONE_MODERATOR_UIDS` allowlist fallback and deterministic test token path.
- Added `ModeratorGuard` and protected moderator endpoints: queue list, detail, and action submission.
- Extended moderation persistence with append-only `ModerationActionStore`; added `OutputReportStore` list/get APIs and enrichment with internal job snapshot reads from `JobsService`.
- Added minimal operator-facing web surface in `apps/moderation-console` (list, detail, action submit) using Firebase Auth and bearer-token API calls.
- Added unit + e2e coverage for moderation queue/detail/action flow, forbidden access for non-moderators, and missing-report handling.

### File List

- packages/contracts/src/moderation-ops.ts
- packages/contracts/src/index.ts
- apps/backend/src/modules/auth/banyone-user.types.ts
- apps/backend/src/modules/auth/firebase-auth.service.ts
- apps/backend/src/modules/auth/firebase-auth.guard.ts
- apps/backend/src/modules/auth/moderator.guard.ts
- apps/backend/src/modules/auth/auth.module.ts
- apps/backend/src/modules/jobs/jobs.service.ts
- apps/backend/src/modules/moderation/moderation.controller.ts
- apps/backend/src/modules/moderation/moderation.service.ts
- apps/backend/src/modules/moderation/moderation.module.ts
- apps/backend/src/modules/moderation/output-report.store.ts
- apps/backend/src/modules/moderation/moderation-action.store.ts
- apps/backend/src/modules/moderation/output-report.store.spec.ts
- apps/backend/src/modules/moderation/moderation.service.spec.ts
- apps/backend/src/modules/moderation/moderation-action.store.spec.ts
- apps/backend/test/jobs.e2e-spec.ts
- apps/moderation-console/package.json
- apps/moderation-console/tsconfig.json
- apps/moderation-console/tsconfig.app.json
- apps/moderation-console/vite.config.ts
- apps/moderation-console/index.html
- apps/moderation-console/src/main.tsx
- apps/moderation-console/src/App.tsx
- apps/moderation-console/.env.example
- apps/moderation-console/README.md

### Change Log

- 2026-04-05: Story context generated (create-story workflow).
- 2026-04-05: Implemented Story 3.4 moderation queue/actions end-to-end across contracts, backend authorization + APIs + persistence, moderation console UI, and tests.
