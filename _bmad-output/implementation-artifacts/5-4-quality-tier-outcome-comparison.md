# Story 5.4: Quality Tier Outcome Comparison

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a product manager,  
I want quality-tier comparative reporting,  
so that I can tune defaults and pricing decisions with evidence.

## Acceptance Criteria

1. **Canonical tier-comparison model (contracts)**  
   **Given** FR28 and Epic 5 require comparable outcomes per `qualityTier` across latency, reliability, conversion, and cost  
   **When** Story 5.4 types are defined  
   **Then** `packages/contracts` exposes a **versioned** comparison model (new `schemaVersion` constant, e.g. `QUALITY_TIER_COMPARISON_SCHEMA_VERSION`) that documents:
   - **Dimension:** primary breakdown is **`qualityTier`** (integer, same normalization band as job creation: 1–99, default `DEFAULT_QUALITY_TIER` for legacy rows).
   - **Metrics per tier (server-derivable from persisted jobs):**
     - **Terminal job count** and **completion rate** among terminal jobs (`ready` vs `failed`), aligned with `JobLifecycleTerminalStatusForMetrics` / Story 5.2 semantics.
     - **Time-to-preview distribution summary:** at minimum **count of valid samples** and **median `timeToPreviewMs`** (or explicit `null` when sample count is 0), using the **same definition** as `computeTimeToPreviewMs` in `job-experience-metrics.ts` (only `ready` terminals with both timestamps).
     - **Cost summary:** at minimum **count of jobs with `jobCostSignalV1`** and **mean estimated USD** (or median—pick one in contract comments and stay consistent) per tier among terminal jobs, using `JobCostSignalPayloadV1` fields.
   - **Metric sources map:** comments must list **authoritative join keys** (`jobId`, `qualityTier`) and point to existing log keys: `JOB_LIFECYCLE_METRICS_LOG_KEY`, `JOB_COST_SIGNAL_LOG_KEY`, and (after AC 3) funnel/job-experience events for conversion.
   - **Non-duplication:** this is an **aggregate/reporting DTO**, not a replacement for per-job lifecycle or cost payloads.

2. **Backend: deterministic aggregation from persisted jobs**  
   **Given** MVP analytics is file-backed job storage  
   **When** product/ops needs tier comparison **without** a warehouse  
   **Then** a **pure, testable** aggregation implementation derives per-tier rows from **`PersistedJobRecord`-shaped inputs** (same fields as `jobs.service.ts`: `status`, `qualityTier`, timestamps, `jobCostSignalV1`).  
   **And** edge cases are explicit: legacy missing `qualityTier` → `DEFAULT_QUALITY_TIER`; non-terminal jobs **excluded** from terminal-rate and cost summaries; jobs terminalized without cost snapshot contribute to completion/latency but not cost numerator (document behavior).

3. **Funnel / conversion comparability by tier**  
   **Given** “conversion” in FR28 spans funnel stages from Story 5.1  
   **When** events carry `jobId`  
   **Then** funnel-family telemetry includes **`qualityTier`** on the wire (additive contract change with **explicit versioning**—prefer `FUNNEL_TELEMETRY_SCHEMA_VERSION` bump to `2` and `FunnelTelemetryEventV2`, or an equivalently clear versioned type; do not silently overload V1 semantics per Story 5.2 discipline).  
   **And** mobile `emitFunnelTelemetry` / `emitCreateJobDraftTelemetry` / `emitPreviewExportTelemetry` **pass tier from the same source as job submission** (`qualityTier` on draft / job status) whenever `jobId` is present so log pipelines can bucket conversion **without** joining to backend job files.  
   **And** export new types from `packages/contracts/src/index.ts`.

4. **Exposure for “reports generated” (choose minimal path, document)**  
   **Given** acceptance refers to analytics reports  
   **When** an operator runs MVP reporting  
   **Then** at least one of the following is implemented (pick the smallest that satisfies stakeholders—**prefer (a)** unless product explicitly needs the others):
   - **(a)** A **structured JSON log line** (stable key from contracts, e.g. `telemetry.analytics.quality.tier.comparison.v1`) emitted when aggregation runs, containing the versioned aggregate payload; runnable from a **Nest provider/command** or documented **one-shot script** under `apps/backend` that loads the job store.
   - **(b)** An **internal HTTP GET** (e.g. under `modules/analytics` or colocated with support tooling) protected by **`SupportGuard`** (or equivalent internal role), returning the aggregate JSON **without** exposing per-job PII beyond what support tooling already allows.
     **And** mobile **end-users** do **not** receive raw tier comparison aggregates unless explicitly out of scope—default is **internal / ops**.

5. **Testing**  
   **Given** formulas must stay aligned with Stories 5.2 and 5.3  
   **When** tests run  
   **Then** unit tests cover aggregation over synthetic job rows: multiple tiers, mixed terminals, missing timestamps, missing cost signals, legacy missing `qualityTier`.  
   **And** contract types remain compile-time aligned with `JobLifecycleMetricsPayloadV1` / `JobCostSignalPayloadV1` field meanings (no conflicting definitions).

## Tasks / Subtasks

- [x] Contracts: add `quality-tier-comparison.ts` (or equivalent) with versioned aggregate row type(s), log key constant for optional emission, and source-of-truth comments (AC: 1, 3)
- [x] Contracts: funnel V2 (or agreed versioned type) with `qualityTier`; export from `index.ts` (AC: 3)
- [x] Mobile: pass `qualityTier` into all funnel emissions that include `jobId` (AC: 3)
- [x] Backend: implement pure `aggregateQualityTierOutcomes(...)` (name flexible) consumed by log emission and/or route (AC: 2)
- [x] Backend: wire exposure path per AC 4 (log, script, and/or `SupportGuard` route); prefer `telemetry/` or new `modules/analytics` per architecture mapping for FR25–FR28 (AC: 4)
- [x] Tests: unit tests for aggregation + mobile/contract tests for funnel payload shape when `jobId` is set (AC: 5)

## Dev Notes

- **Business context:** Delivers **FR28** (compare outcomes across quality tiers). Depends on **5.1** (funnel stages), **5.2** (`qualityTier`, lifecycle metrics definitions), **5.3** (per-job cost on terminal row). Keep **`qualityTier`** consistent everywhere (normalization/clamping already centralized in `JobsService`).

- **Intentionally out of scope:** Full BI stack, statistical significance testing, automated experiment assignment, and public pricing UI—this story makes **definitions + joinable signals + MVP aggregation** trustworthy.

- **Reuse (do not reinvent):**
  - `computeTimeToPreviewMs`, `DEFAULT_QUALITY_TIER`, `JOB_LIFECYCLE_METRICS_LOG_KEY` — `packages/contracts/src/job-experience-metrics.ts`
  - Cost fields — `packages/contracts/src/job-cost-signals.ts`
  - Job shape — `PersistedJobRecord` in `apps/backend/src/modules/jobs/jobs.service.ts`
  - Internal route guard pattern — `SupportGuard`, `apps/backend/src/modules/support/support.controller.ts`
  - Mobile telemetry entry — `apps/mobile/src/infra/telemetry/funnel-telemetry.ts`

- **Architecture compliance:** [Source: `_bmad-output/planning-artifacts/architecture.md` — Cost governance, Observability, Requirements to Structure Mapping (FR25–FR28 → `modules/analytics`, shared contracts, telemetry)]
  - Correlate economics with operational metrics; preserve dimensions for pricing/quality strategy.

- **Previous story (5.3) intelligence:** Cost is **`jobCostSignalV1` on the job record** and in **`JOB_COST_SIGNAL_LOG_KEY`** logs—aggregates must read the **same USD estimate** and not assume all terminal jobs have cost rows yet.

- **Previous story (5.2) intelligence:** Latency samples exclude `failed` terminals; do not blend client and server clocks in backend aggregates.

### Project Structure Notes

- **Contracts:** `packages/contracts/src/` — new comparison + funnel v2 files; `index.ts` exports.
- **Backend:** Prefer `apps/backend/src/modules/analytics/` for a thin controller/service if adding HTTP; otherwise `apps/backend/src/telemetry/` for log-only emission—match existing Nest patterns.
- **Mobile:** Only touch `infra/telemetry` and call sites that already know `jobId` + tier.

### Technical Requirements

- **Single definition of “completion rate”:** Align numerator/denominator with Story 5.2 comments (terminal `ready` vs `failed` among accepted jobs); if the aggregate includes only jobs still present in the store, state that limitation in contract comments.
- **Privacy:** Aggregates are low-PII, but HTTP exposure stays **support/internal** by default.
- **Performance:** Full-store scan is acceptable for MVP file-backed volume; avoid O(n²).

### Architecture Compliance

- Contract-first aggregates; join keys match Epic 5 telemetry; optional `modules/analytics` aligns with architecture map.

### Library / Framework Requirements

- No new dependencies unless unavoidable; reuse NestJS patterns and existing guards.

### File Structure Requirements

- `packages/contracts/src/index.ts` — exports
- `apps/backend/src/modules/jobs/jobs.service.ts` — possibly inject aggregation for route, or read store via existing service API only (avoid duplicating file I/O)
- New files as needed under `telemetry/` and/or `modules/analytics/`

### Testing Requirements

- Table-driven tests for aggregation edge cases.
- If adding funnel v2, update `funnel-telemetry.test.ts` (or equivalent) for `qualityTier` presence when `jobId` is set.

## References

- Epic 5 & Story 5.4: `_bmad-output/planning-artifacts/epics.md`
- FR28: `_bmad-output/planning-artifacts/prd.md`
- Architecture (analytics mapping): `_bmad-output/planning-artifacts/architecture.md`
- Prior stories: `_bmad-output/implementation-artifacts/5-3-per-job-cost-signal-pipeline.md`, `5-2-time-to-preview-and-reliability-metrics.md`, `5-1-funnel-event-instrumentation.md`
- Jobs store: `apps/backend/src/modules/jobs/jobs.service.ts`
- Existing telemetry: `apps/backend/src/telemetry/job-lifecycle-metrics.ts`, `job-cost-signal.ts`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run test --workspace backend -- quality-tier-comparison.spec.ts support.service.spec.ts`
- `npm run test --workspace mobile -- funnel-telemetry.test.ts`
- `npm run test:e2e --workspace backend -- jobs.e2e-spec.ts -t "support quality-tier comparison endpoint returns aggregate rows for support callers"`
- `npm run build --workspace @banyone/contracts`
- `ReadLints` on modified backend/mobile/contracts/story files (no errors)

### Completion Notes List

- Added versioned quality-tier comparison contracts with schema/log key constants and source mapping comments for lifecycle, cost, and funnel conversion joins.
- Upgraded funnel telemetry to schema V2 and required `qualityTier` whenever `jobId` is emitted, preserving a V1 alias to keep existing callers compile-compatible.
- Updated mobile telemetry emitters and call sites (`submit_result`, `job_status_transition`, `preview_export`) to pass `qualityTier` from the same source used by job submission/status.
- Implemented pure backend aggregation (`aggregateQualityTierOutcomes`) over persisted jobs with explicit legacy-tier fallback, terminal-only completion/cost logic, and median/mean summaries.
- Exposed support-internal reporting endpoint `GET /v1/support/quality-tier-comparison` (guarded by `SupportGuard`) and emit structured aggregate log lines during report generation.
- Added and passed focused unit/mobile/e2e tests covering tier aggregation, telemetry payload shape, and support route behavior.

### File List

- `packages/contracts/src/quality-tier-comparison.ts`
- `packages/contracts/src/funnel-telemetry.ts`
- `packages/contracts/src/telemetry.ts`
- `packages/contracts/src/index.ts`
- `apps/mobile/src/infra/telemetry/funnel-telemetry.ts`
- `apps/mobile/src/infra/telemetry/funnel-telemetry.test.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/job-status/hooks/use-job-status-polling.ts`
- `apps/mobile/src/features/preview-export/hooks/use-preview-export.ts`
- `apps/backend/src/telemetry/quality-tier-comparison.ts`
- `apps/backend/src/telemetry/quality-tier-comparison.spec.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/src/modules/support/support.service.ts`
- `apps/backend/src/modules/support/support.controller.ts`
- `apps/backend/src/modules/support/support.service.spec.ts`
- `apps/backend/test/jobs.e2e-spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

**Completion note:** Ultimate context engine analysis completed—comprehensive developer guide created for flawless implementation.

## Change Log

- 2026-04-06: Story context created (BMAD create-story workflow) — status `ready-for-dev`.
- 2026-04-06: Implemented quality-tier outcome comparison contracts, backend aggregation/report endpoint, and telemetry tier propagation; status set to `review`.
