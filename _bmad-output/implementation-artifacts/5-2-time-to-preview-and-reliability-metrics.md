# Story 5.2: Time-to-Preview and Reliability Metrics

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a product manager,  
I want latency and completion reliability metrics by cohort,  
so that I can monitor experience quality and operational health.

## Acceptance Criteria

1. **Canonical metric definitions (contracts)**  
   **Given** product analytics and backend logs must describe the same quantities  
   **When** metrics for Story 5.2 are defined  
   **Then** `packages/contracts` exposes versioned types and/or constants documenting:
   - **Time-to-preview (server truth):** elapsed time from job entering `queued` until entering `ready`, measured in **milliseconds**, using **persisted server timestamps** (`queuedAtMs` → `readyAtMs` on the job record). Jobs that end in `failed` without reaching `ready` **do not** contribute a time-to-preview sample (document whether they are excluded or recorded as null—pick one and keep it consistent).
   - **Lifecycle completion reliability:** among jobs that were **accepted into the processing pipeline** (post-submit success), the terminal outcome class `ready` vs `failed`, suitable for weekly completion-rate style reporting (align with PRD intent: high completion reliability for accepted jobs).
   - **Export/share reliability (client-observed):** definitions that tie to existing `PreviewExportEvent` events (`export_started`, `export_succeeded`, `export_failed`, `share_completed`, etc.) so “export reliability” is not ambiguous—e.g. success rate of export after `export_started`, or share completion after `share_opened`, documented explicitly in contracts comments.  
     **And** schema uses a **bumped or new `schemaVersion`** wherever new fields are added to emitted payloads (do not silently overload `FunnelTelemetryEventV1` without versioning strategy).

2. **Segmentation: platform + quality tier**  
   **Given** FR26 requires metrics by **segment** and **tier**  
   **When** metrics are recorded  
   **Then** each metric event includes at minimum: **`platform`** (reuse `FunnelPlatform` / existing funnel patterns) and **`qualityTier`** (integer or small fixed union—aligned with future Story 5.4; MVP may default to a single tier but the **field must exist** on persisted job + emitted metrics).  
   **And** no PII beyond what is already accepted in job/analytics flows (no raw media paths).

3. **Backend: authoritative lifecycle metrics**  
   **Given** server-owned timestamps are the source of truth for latency  
   **When** a job transitions to terminal lifecycle state `ready` or `failed`  
   **Then** the backend emits a **structured, machine-parseable** record (e.g. JSON log line with a stable key like `telemetry.job.lifecycle.metrics.v1`) containing at least: `jobId`, `schemaVersion`, terminal status, computed **`timeToPreviewMs`** when applicable, **`qualityTier`**, and the same **metric names and semantics** as in contracts.  
   **And** implementation lives in a clear location per architecture (`apps/backend/src/telemetry` helper used from `JobsService`, or equivalent—avoid scattering ad-hoc `console.log` formats).

4. **Mobile: aligned client events (optional but recommended for dashboards)**  
   **Given** funnel instrumentation exists from Story 5.1  
   **When** the client first observes a terminal lifecycle state or completes export/share steps  
   **Then** emit **one** additional funnel-compatible event type OR extend telemetry with a dedicated `metricKind` / `JobExperienceMetricsEvent` (contracts-first) that **references `jobId`**, **`platform`**, **`qualityTier`**, and **does not contradict** server-computed latency (prefer emitting **server-provided** durations or timestamps from the API if exposed; avoid inventing latency solely from client clocks if server values are available).  
   **And** feature code continues to use `apps/mobile/src/infra/telemetry` as the single entry point.

5. **API / persistence: quality tier on the job**  
   **Given** tier-based breakdown is required  
   **When** a job is created  
   **Then** the create-job API accepts an optional **`qualityTier`** (default sensible for current product), persisted on the job record, and returned where needed for metrics correlation.  
   **And** mobile passes the tier from existing draft defaults (e.g. `quality: 1` in create-job state) so analytics is not hard-coded only in the backend.

6. **Testing**  
   **Given** metrics must not drift from definitions  
   **When** tests run  
   **Then** backend unit tests cover metric computation from seeded jobs (use existing `__testSeedJob` patterns where appropriate) and/or controller-level expectations for new fields; mobile tests mock telemetry and assert **expected metric payload shapes** for terminal states and export outcomes.

## Tasks / Subtasks

- [x] Contracts: add `job-experience-metrics.ts` (or similarly named) with metric definitions, enums, and `JobLifecycleMetricsPayloadV1` / export reliability helpers; export from `packages/contracts/src/index.ts` (AC: 1, 2, 6)
- [x] Contracts: document formulas in file header (time-to-preview, lifecycle reliability denominator, export success definitions) (AC: 1)
- [x] Backend: extend `CreateGenerationJobRequestBody` + persistence (`PersistedJobRecord`) + normalization for `qualityTier` with default (AC: 5)
- [x] Backend: on terminal transition to `ready` | `failed`, compute metrics and emit structured `telemetry.job.lifecycle.metrics.v1` (AC: 3)
- [x] Backend: optional small `telemetry/` helper for JSON log shape shared with tests (AC: 3)
- [x] Mobile: pass `qualityTier` on job submission aligned with draft `quality` (AC: 5)
- [x] Mobile: emit contract-shaped client metrics via `infra/telemetry` at terminal lifecycle observation and/or export milestones—**without** duplicating business logic already on server (AC: 4)
- [x] Tests: backend jobs/metrics tests + mobile telemetry assertions (AC: 6)

## Dev Notes

- **Business context:** Delivers **FR26** and Epic 5 Story 5.2. Depends on **Story 5.1** for funnel stages, `jobId`, session id, and `PreviewExportEvent`—extend, do not fork parallel schemas.

- **Intentionally out of scope:** Full analytics warehouse, BigQuery sinks, Firebase Analytics wire-up, and production dashboards—those are enabled by **consistent contracts + emission**. Story 5.3/5.4 will build on the same identifiers.

- **Reuse (do not reinvent):**
  - `packages/contracts/src/funnel-telemetry.ts`, `packages/contracts/src/telemetry.ts`, `apps/mobile/src/infra/telemetry/funnel-telemetry.ts`
  - Persisted job timestamps: `apps/backend/src/modules/jobs/jobs.service.ts` (`queuedAtMs`, `readyAtMs`, `failedAtMs`)
  - Story 5.1 table of funnel stages in `5-1-funnel-event-instrumentation.md`

- **Architecture compliance:** [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability & Cost Governance, Requirements to Structure Mapping]
  - Correlate product metrics with operational metrics; preserve dimensions for cohort and quality strategy; backend `telemetry` + mobile `infra/telemetry` + shared contracts.

- **Previous story (5.1) intelligence:** Preserve **`jobId`**, **`funnelStage`**, and outcome classes when adding metric events. Any new mobile emission should follow `emitFunnelTelemetry` / `emitPreviewExportTelemetry` patterns and `__DEV__` logging behavior.

- **Segment definition (MVP):** “Segment” for FR26 is satisfied for this story by **`platform` + `qualityTier`**. Additional dimensions (app version, region) are future-friendly optional fields—do not block the story on them.

### Project Structure Notes

- **Contracts:** `packages/contracts/src/` — new metrics file + `index.ts` exports.
- **Backend:** `apps/backend/src/modules/jobs/` for persistence and lifecycle hooks; `apps/backend/src/telemetry/` for shared log formatting if introduced.
- **Mobile:** `apps/mobile/src/infra/telemetry/` only for cross-feature emission; thin hooks in `use-job-status-polling` / `use-preview-export` as needed.

### Technical Requirements

- **Single definition of time-to-preview:** Prefer `readyAtMs - queuedAtMs` when both are set; document edge cases (migration, legacy jobs missing `queuedAtMs`).
- **Reliability:** Align weekly completion-style rates with PRD **NFR4** language conceptually; implementation is **metric definitions + emission**, not automated weekly jobs.
- **Logging:** Structured JSON acceptable for MVP aggregation; must be grep-friendly and stable field names.

### Architecture Compliance

- Contract-first DTOs; server timestamps authoritative for latency; client for export UX outcomes.
- No duplicate lifecycle state machines on mobile.

### Library / Framework Requirements

- No new dependencies unless strictly required; reuse NestJS `Logger` or existing project logging patterns.

### File Structure Requirements

- `packages/contracts/src/index.ts` — export new types
- `apps/backend/src/modules/jobs/jobs.service.ts` — persistence + transition hooks
- `apps/backend/src/modules/jobs/dto/create-generation-job.request.ts` — optional `qualityTier`
- `apps/mobile/src/features/create-job/` — submission payload
- Tests: `jobs.service.spec.ts`, `jobs.controller.spec.ts`, relevant mobile `*.test.tsx`

### Testing Requirements

- Compute metrics in pure functions where possible for unit testing.
- Mock telemetry emitter on mobile; assert payload **shape** and key values, not full console strings.

## References

- Epic 5 & Story 5.2: `_bmad-output/planning-artifacts/epics.md`
- FR26 / NFR2 / NFR4: `_bmad-output/planning-artifacts/prd.md`
- Architecture observability: `_bmad-output/planning-artifacts/architecture.md`
- Prior story: `_bmad-output/implementation-artifacts/5-1-funnel-event-instrumentation.md`
- Jobs lifecycle: `apps/backend/src/modules/jobs/jobs.service.ts`, `apps/backend/src/modules/jobs/jobs.types.ts`

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented canonical metric definitions in `packages/contracts/src/job-experience-metrics.ts` (time-to-preview, lifecycle reliability, export/share ratios) with `JOB_LIFECYCLE_METRICS_SCHEMA_VERSION` and separate `JOB_EXPERIENCE_METRICS_EVENT_SCHEMA_VERSION` for client `JobExperienceMetricsEventV1`.
- Backend persists `qualityTier` on create, returns `qualityTier` + `timeToPreviewMs` (when `ready`) on status; emits `telemetry.job.lifecycle.metrics.v1` on first terminal transition to `ready` | `failed` via `apps/backend/src/telemetry/job-lifecycle-metrics.ts`.
- Mobile submits `qualityTier` (default `DEFAULT_QUALITY_TIER`), emits `lifecycle_terminal_observed` when observing terminal stages, and `preview_export_step` alongside existing preview/export funnel events.
- Rebuilt `@banyone/contracts` (`dist/`) so new exports resolve at runtime for the mobile app.

### File List

- `packages/contracts/src/job-experience-metrics.ts`
- `packages/contracts/src/index.ts`
- `packages/contracts/dist/*` (build output)
- `apps/backend/src/telemetry/job-lifecycle-metrics.ts`
- `apps/backend/src/telemetry/job-lifecycle-metrics.spec.ts`
- `apps/backend/src/modules/jobs/dto/create-generation-job.request.ts`
- `apps/backend/src/modules/jobs/jobs.types.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/jobs/jobs.controller.spec.ts`
- `apps/mobile/src/features/create-job/types/create-generation-job.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/job-status/types/job-status.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.test.tsx`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`
- `apps/mobile/src/infra/telemetry/funnel-telemetry.ts`
- `apps/mobile/src/infra/telemetry/funnel-telemetry.test.ts`
- `apps/mobile/src/infra/telemetry/index.ts`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-04-06: Story context created (BMAD create-story workflow) — ready for implementation.
- 2026-04-06: Story 5.2 implemented — contracts + backend lifecycle metrics emission + mobile experience metrics; tests updated; status → review.

---

**Completion note:** Ultimate context engine analysis completed—comprehensive developer guide created for flawless implementation.
