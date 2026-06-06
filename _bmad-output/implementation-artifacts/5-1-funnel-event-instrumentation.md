# Story 5.1: Funnel Event Instrumentation

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a product manager,  
I want event tracking across the creation funnel,  
so that I can identify drop-offs from input to export.

## Acceptance Criteria

1. **Canonical funnel model**  
   **Given** product analytics needs to reason about conversion by stage  
   **When** events are defined for this story  
   **Then** there is a **single canonical ordered list of funnel stages** from first meaningful intent through export completion (aligned with architecture: select input → validation outcomes → submit → queued → processing → preview-ready → export/share outcomes).  
   **And** each emitted event references a **stable `funnelStage` identifier** from shared contracts (string union or const object—not ad-hoc strings in feature code).

2. **Standard schema and identifiers**  
   **Given** a user moves through core flow steps  
   **When** each key action or terminal outcome occurs  
   **Then** emitted payloads include at minimum: `schemaVersion`, `funnelStage`, `occurredAt` (ISO-8601), `platform` (e.g. `ios` | `android` | `web`), and **correlation ids** where applicable: `jobId` when a job exists, and a **client session id** (opaque, non-PII; stable for the app session) for pre-job and cross-screen stitching.  
   **And** existing contract types in `packages/contracts/src/telemetry.ts` are **extended or composed** (e.g. preview/export and draft events either map into the funnel model or remain as typed sub-events with a mandatory `funnelStage`) so there is no duplicate competing schemas.

3. **Segmentation dimensions**  
   **Given** dashboards need to segment conversion  
   **When** events are recorded  
   **Then** payloads include dimensions suitable for breakdown: at minimum **submission outcome class** on submit-related events (e.g. `accepted` | `validation_rejected` | `rate_limited` | `disclosure_required` | `policy_blocked` | `abuse_restricted` | `network_error`), and **terminal job status class** where relevant (`queued` | `processing` | `ready` | `failed` transitions—not raw provider strings).  
   **And** no raw file paths or media content are logged (follow existing draft telemetry privacy note in contracts).

4. **Single mobile telemetry entry point**  
   **Given** multiple features today call `console.info(\`telemetry._\`)`directly  
**When** this story is implemented  
**Then** funnel-oriented product events flow through a **small shared module** under`apps/mobile/src/infra/telemetry/`(per architecture) with one exported`emit_` (or similarly named) API used by feature hooks.  
   **And** feature code does not invent new stringly-typed event names for funnel stages outside contracts.

5. **Coverage across the funnel**  
   **Given** the end-to-end path in the mobile app  
   **When** implementation is complete  
   **Then** instrumentation covers at minimum: **draft/selection** (reuse or wrap existing draft events), **submit attempt outcomes** (including disclosure gate path), **job lifecycle transitions observed client-side** (align with existing `use-job-status-polling` signals), and **preview/export/share** (reuse or wrap `PreviewExportEvent` flows).  
   **And** gaps are documented explicitly if any stage is technically unreachable in the current build.

6. **Testing**  
   **Given** telemetry must not regress silently  
   **When** tests run  
   **Then** unit or component tests assert that key user flows emit the **expected `funnelStage` and outcome class** (mock the infra emitter).  
   **And** existing tests that snapshot console output are updated to the new emitter pattern without weakening assertions on user-visible behavior.

## Tasks / Subtasks

- [x] Contracts: funnel stage enum/const, base payload `FunnelTelemetryEventV1` (or equivalent), outcome/submission enums, export from `packages/contracts/src/index.ts` (AC: 2, 3)
- [x] Contracts: reconcile `PreviewExportEvent`, `CreateJobDraftTelemetryEvent`, and job lifecycle client events with funnel model—either nest under a union or add `funnelStage` to each (AC: 2)
- [x] Mobile: add `apps/mobile/src/infra/telemetry/` module—session id helper, platform resolution, canonical `emitFunnelTelemetry` (or name aligned with codebase) with `__DEV__`-safe logging default (AC: 4)
- [x] Mobile: refactor `use-job-input-selection`, `use-job-submission`, `use-job-status-polling`, `use-preview-export` to use the shared emitter for funnel-class events; remove duplicated `console.info` patterns where replaced (AC: 4, 5)
- [x] Mobile: add funnel events for disclosure-required and acknowledgment path if not already represented by structured events (AC: 5)
- [x] Tests: mock emitter in feature tests; add/adjust assertions for funnel stages on critical paths (AC: 6)
- [x] Documentation: short “Funnel stages → events” table in Dev Notes below for PM/analytics consumers (AC: 1, 3)

## Dev Notes

- **Business context:** Delivers **FR25** and Epic 5 Story 5.1—foundational **schema + emission** so later stories (5.2–5.4) can align latency, cost, and tier metrics to the same identifiers without renaming events.

- **Intentionally out of scope for 5.1:** Server-side `modules/analytics` persistence, BigQuery pipelines, and third-party analytics SDK wiring (e.g. GA4/Segment). Architecture maps those to FR25–28 overall; this story establishes **contracts + client emission** so a transport can be added without renaming fields. If you add a backend ingest endpoint, do it only when product requires server-side storage in the same sprint—otherwise defer to avoid scope creep.

- **Reuse (do not reinvent):**
  - Existing patterns: `packages/contracts/src/telemetry.ts`, `console.info(\`telemetry.${event}.v1\`)` payloads in create-job, job-status, preview-export.
  - Error/outcome codes already surfaced in submission flow (`@banyone/contracts` job policy, rate limit, abuse). Map these to **submission outcome class** for analytics—do not fork business logic.
  - Privacy: keep “no raw paths” rule from `CreateJobDraftTelemetryEvent` comments.

- **Architecture compliance:** [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability & Cost Governance, Requirements to Structure Mapping]
  - Funnel steps called out: “select input, validation pass/fail, submit, queued, processing, preview-ready, export.”
  - Target locations: `apps/mobile/src/infra/telemetry`, shared contracts, eventual `modules/analytics` on backend for later epics.

- **Downstream alignment:** Story **5.2** will standardize time-to-preview and reliability metrics—preserve **`jobId`**, **timestamps**, and **stage** names so aggregation can join without breaking changes.

**Funnel stages → events (canonical targets—adjust names only via contracts):**

| Order | `funnelStage` (example)                            | Where to emit from                                               |
| ----: | -------------------------------------------------- | ---------------------------------------------------------------- |
|     1 | `input_selected` / draft persisted                 | `use-job-input-selection` (draft saved/loaded/discarded)         |
|     2 | `validation_completed`                             | Pre-submit validation result (pass / fixable violations)         |
|     3 | `disclosure_presented` / `disclosure_acknowledged` | Create job screen + `use-job-submission` disclosure path         |
|     4 | `submit_result`                                    | Submission ACK outcome class                                     |
|     5 | `job_status_transition`                            | `use-job-status-polling` (queued → processing → ready/failed)    |
|     6 | `preview_export`                                   | `use-preview-export` (maps existing preview/export/share events) |

### Project Structure Notes

- **New:** `apps/mobile/src/infra/telemetry/*` — keep free of React hooks; features pass contextual ids into plain functions.
- **Contracts:** Prefer `packages/contracts/src/funnel-telemetry.ts` (or extend `telemetry.ts` if the team wants a single file—either is fine if exports stay tidy).
- **No** new backend module required for minimal AC; optional follow-up: `POST /v1/analytics/events` batch.

### Technical Requirements

- **Schema version:** Start with `schemaVersion: 1` (or `'v1'`) on all new funnel payloads; bump only on breaking contract changes.
- **Session id:** Use a lightweight opaque id (e.g. `crypto.randomUUID()` once per app launch stored in memory or `expo-secure-store`/`AsyncStorage`—match existing project patterns if any).
- **Timestamps:** Prefer `new Date().toISOString()` at emission site unless you centralize clock skew handling later.
- **Firebase:** The app uses the **Firebase JS SDK** for Auth [Source: `apps/mobile/src/infra/firebase/firebase-client.ts`]. Do **not** assume `firebase/analytics` works on native without extra config; if product later mandates Firebase Analytics, add a thin adapter behind the same `emit` API.

### Architecture Compliance

- Contract-first DTOs; mobile `infra` isolates third-party sinks from feature folders.
- Feature-first structure preserved—only `infra/telemetry` and contracts see the full cross-cutting model.

### Library / Framework Requirements

- No new dependencies unless strictly required (e.g. UUID helper already available via `crypto` or existing deps).
- Reuse Expo/React Native APIs already in the project for `Platform.OS`.

### File Structure Requirements

- `packages/contracts/src/funnel-telemetry.ts` (or extended `telemetry.ts`)
- `packages/contracts/src/index.ts` — export new types/constants
- `apps/mobile/src/infra/telemetry/index.ts` (barrel)
- Touch: `use-job-input-selection.ts`, `use-job-submission.ts`, `use-job-status-polling.ts`, `use-preview-export.ts`
- Tests under existing feature `*.test.tsx` / hook tests as applicable

### Testing Requirements

- Mock `emitFunnelTelemetry` (or equivalent) in unit tests; assert **call counts and payload fields** for funnel stages—not full console strings.
- Keep E2E tests focused on UX; funnel assertions remain at unit/integration layer unless project already E2E-tests telemetry.

## References

- Epic 5 & Story 5.1: `_bmad-output/planning-artifacts/epics.md` (Product Intelligence and Unit Economics)
- FR25: `_bmad-output/planning-artifacts/prd.md` — Product Analytics and Business Instrumentation
- Architecture observability & FR mapping: `_bmad-output/planning-artifacts/architecture.md`
- Existing telemetry types: `packages/contracts/src/telemetry.ts`
- Prior epic pattern (contracts + module boundaries): `_bmad-output/implementation-artifacts/4-3-escalation-workflow-with-context-handoff.md`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run typecheck --workspace @banyone/contracts`
- `npm run test --workspace mobile -- --runInBand src/features/create-job/screens/create-job-submit.test.tsx src/features/preview-export/components/preview-export-panel.test.tsx src/features/job-status/hooks/use-job-status-polling.test.tsx`
- `npm run lint --workspace mobile`

### Completion Notes List

- Added canonical funnel telemetry contracts with stable stage identifiers, schema versioning, and outcome/status classes.
- Reconciled existing draft and preview/export telemetry contract types to include shared funnel fields.
- Added shared mobile telemetry infra (`emitFunnelTelemetry`, `emitCreateJobDraftTelemetry`, `emitPreviewExportTelemetry`) with app-session id and platform resolution.
- Refactored create-job submission, input selection, job status polling, and preview/export hooks to emit funnel-class events through the shared module.
- Added disclosure-presented/disclosure-acknowledged instrumentation in submission flow.
- Updated feature tests to mock telemetry infra and assert funnel stage/outcome fields on critical flows.

### File List

- `packages/contracts/src/funnel-telemetry.ts`
- `packages/contracts/src/telemetry.ts`
- `packages/contracts/src/index.ts`
- `apps/mobile/src/infra/telemetry/funnel-telemetry.ts`
- `apps/mobile/src/infra/telemetry/index.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.ts`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.test.tsx`

## Change Log

- 2026-04-06: Implemented Story 5.1 funnel instrumentation contracts, shared mobile telemetry emitter, hook integrations, and telemetry assertions in mobile tests.

---

**Completion note:** Ultimate context engine analysis completed—comprehensive developer guide created for flawless implementation.
