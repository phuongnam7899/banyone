# Story 5.3: Per-Job Cost Signal Pipeline

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a business stakeholder, s
I want per-job cost signals joined with outcome data,  
so that I can evaluate unit economics and margin path.

## Acceptance Criteria

1. **Canonical cost signal definitions (contracts)**  
   **Given** FR27 and PRD unit-economics language require comparable per-job COGS-style signals  
   **When** Story 5.3 types are defined  
   **Then** `packages/contracts` exposes a **versioned** cost-signal model (new `schemaVersion` constant, e.g. `JOB_COST_SIGNAL_SCHEMA_VERSION`) documenting:
   - **What is being estimated:** at minimum a single **numeric estimate in USD** (or a small fixed set of currency codes with USD as MVP default) suitable for “COGS-style” reporting—not ambiguous “credits” unless explicitly documented as convertible.
   - **Join keys** to outcome data: `jobId`, **`qualityTier`** (align with Story 5.2 / `DEFAULT_QUALITY_TIER`), and **terminal lifecycle class** `ready` | `failed` (same semantics as `JobLifecycleTerminalStatusForMetrics`).
   - **Provenance:** `costModelVersion` (string or integer) and optional `inferenceProviderKey` (bounded string union or slug) so aggregates remain reproducible when coefficients change.
   - **Non-duplication:** emit **at most one** authoritative server cost signal per job terminalization (mirror the lifecycle metrics idempotency expectation—terminal transition is the boundary).  
     **And** new public fields or log payloads get explicit versioning—do not silently extend `JobLifecycleMetricsPayloadV1`; add a dedicated payload type and log key (e.g. `telemetry.job.cost.signal.v1`).

2. **Backend: compute + persist + emit**  
   **Given** each job reaches terminal state `ready` or `failed`  
   **When** the backend finalizes that transition (same place lifecycle metrics are emitted today)  
   **Then** a **persisted** cost snapshot is written on the **authoritative job record** (`PersistedJobRecord` in `jobs.service.ts`) with the contract-defined shape (or a strict subset that maps 1:1 into the contract type).  
   **And** a **structured JSON log line** is emitted (grep-friendly, stable key matching contracts) containing the same join keys and cost fields for pipeline ingestion.  
   **And** implementation lives under `apps/backend/src/telemetry/` for formatting/emission helpers—avoid ad-hoc `console.info` strings scattered outside the telemetry layer.

3. **MVP cost model (explicit stub boundary)**  
   **Given** vendor-metered inference may not be wired yet  
   **When** a terminal cost signal is produced  
   **Then** the **calculation is deterministic from inputs available on the job** (e.g. `qualityTier` + optional future fields like duration) and **centralized** in one module/function (not inline magic numbers in `JobsService`).  
   **And** dev notes document how this will be **replaced or augmented** by real provider usage meters later (worker/adapter boundary per architecture) without breaking `schemaVersion` consumers—bump `costModelVersion` when coefficients change.

4. **Queryable / joinable for reporting**  
   **Given** acceptance requires comparison to completion and quality outcomes  
   **When** ops or analytics consumes data  
   **Then** cost records are **joinable** to Story 5.2 lifecycle metrics using **`jobId`** and compatible **`qualityTier`** and terminal status.  
   **And** persisted job JSON remains backward compatible: **legacy jobs without cost fields** normalize cleanly (undefined cost = no signal / omitted).

5. **Privacy & scope**  
   **Given** cost signals are business-sensitive  
   **When** APIs expose job data to end users  
   **Then** **do not** add cost fields to mobile-facing status envelopes unless explicitly required—default is **internal persistence + structured logs** (and optional support/admin paths only if already justified by Epic 4 patterns).  
   **And** no new PII; no raw media paths.

6. **Testing**  
   **Given** definitions must not drift  
   **When** tests run  
   **Then** unit tests cover **cost payload shape** and deterministic computation for representative tiers/terminals; backend tests assert **persistence** on terminal transition and **single emission** per terminalization path (reuse or extend patterns from `job-lifecycle-metrics.spec.ts` / jobs service tests).

## Tasks / Subtasks

- [x] Contracts: add `job-cost-signals.ts` (or equivalent) with versioned types, log key constant, and header comments defining USD estimate semantics and join keys (AC: 1, 4, 5)
- [x] Contracts: export from `packages/contracts/src/index.ts`; rebuild `dist` if required by workspace (AC: 1)
- [x] Backend: implement centralized `computeJobCostSignalV1(...)` (or similar) with `costModelVersion` (AC: 3)
- [x] Backend: extend `PersistedJobRecord` + normalization/migration for legacy rows; bump store `version` if required by existing migration rules (AC: 2, 4)
- [x] Backend: `apps/backend/src/telemetry/job-cost-signal.ts` (emit helper + shared shape for tests) (AC: 2)
- [x] Backend: invoke compute + persist + emit alongside existing `emitJobLifecycleMetricsV1Log` on first terminal transition to `ready` | `failed` (AC: 2, 6)
- [x] Tests: telemetry/unit tests for computation + emission hook (AC: 6)

## Dev Notes

- **Business context:** Delivers **FR27** (per-job cost signals for unit economics). Builds on **Story 5.2** (`qualityTier`, terminal classification, lifecycle telemetry patterns) and **Story 5.1** (identifiers). **Story 5.4** will compare outcomes across tiers—keep **`qualityTier`** on every cost row.

- **Intentionally out of scope:** Production data warehouse/BigQuery sync, billing integration, real-time margin dashboards, and mobile surfacing of dollar amounts—this story establishes **contracts + persisted server truth + structured logs**.

- **Reuse (do not reinvent):**
  - Lifecycle hook site: `apps/backend/src/modules/jobs/jobs.service.ts` (terminal branch with `emitJobLifecycleMetricsV1Log`)
  - Telemetry emitter pattern: `apps/backend/src/telemetry/job-lifecycle-metrics.ts`
  - Metric tier defaults: `packages/contracts/src/job-experience-metrics.ts` (`DEFAULT_QUALITY_TIER`)
  - Join semantics: same `jobId` and terminal time boundary as `JobLifecycleMetricsPayloadV1`

- **Architecture compliance:** [Source: `_bmad-output/planning-artifacts/architecture.md` — Observability, Cost governance, Requirements to Structure Mapping]
  - Correlate economics metrics with product/operational metrics; keep provider abstraction in mind (`adapters/inference-provider`, workers) for future metered costs.
  - Long term: `modules/analytics` may ingest these signals; MVP is **file-backed persistence + logs** consistent with current jobs store.

- **Previous story (5.2) intelligence:** Lifecycle metrics already emit on terminal transition with `computeTimeToPreviewMs`—**attach cost signal in the same transition block** to guarantee joinability. Preserve `schemaVersion` discipline and JSON log keys from contracts.

### Project Structure Notes

- **Contracts:** `packages/contracts/src/` — new file + `index.ts` exports.
- **Backend:** `apps/backend/src/telemetry/` — cost log emitter; small pure compute module colocated or under `telemetry/` / `modules/jobs/` per existing style (prefer **pure function** in `telemetry` or `jobs` subfolder for testability).
- **Do not** introduce `modules/analytics` unless minimal wiring is unavoidable—file/log pipeline is sufficient for AC.

### Technical Requirements

- **Single terminal emission:** If multiple code paths can reach terminal status, ensure cost is recorded **once** (mirror lifecycle metrics idempotency).
- **Store migrations:** Follow existing `normalizePersistedJobsStore` patterns; never throw on unknown fields from disk.
- **Logging:** Structured, stable field names; include `schemaVersion`, `costModelVersion`, `jobId`, `qualityTier`, terminal status, and estimate.

### Architecture Compliance

- Contract-first DTOs; server-owned cost signal; join keys aligned with Epic 5 metrics.
- Prepare for worker-supplied actuals later without breaking contract consumers (version bumps).

### Library / Framework Requirements

- No new dependencies unless strictly required; reuse NestJS/Node patterns already in `jobs` module.

### File Structure Requirements

- `packages/contracts/src/index.ts` — export new types/constants
- `apps/backend/src/modules/jobs/jobs.service.ts` — persist + hook
- `apps/backend/src/telemetry/job-cost-signal.ts` — emission helper (and optional `*.spec.ts`)
- Tests: colocated `*.spec.ts` near new logic; extend jobs tests if needed

### Testing Requirements

- Pure **cost computation** functions are easy to unit test with fixed inputs.
- Avoid asserting full console strings—assert **object shapes** passed to emitters (pattern from lifecycle metrics tests).

## References

- Epic 5 & Story 5.3: `_bmad-output/planning-artifacts/epics.md`
- FR27 / unit economics / COGS: `_bmad-output/planning-artifacts/prd.md`
- Architecture observability & cost: `_bmad-output/planning-artifacts/architecture.md`
- Prior stories: `_bmad-output/implementation-artifacts/5-2-time-to-preview-and-reliability-metrics.md`, `5-1-funnel-event-instrumentation.md`
- Jobs lifecycle: `apps/backend/src/modules/jobs/jobs.service.ts`, `apps/backend/src/telemetry/job-lifecycle-metrics.ts`
- Contracts metrics: `packages/contracts/src/job-experience-metrics.ts`

## Dev Agent Record

### Agent Model Used

- GPT-5.3 Codex (Cursor)

### Debug Log References

- `npm run build --workspace @banyone/contracts`
- `npm run test --workspace backend -- src/telemetry/job-cost-signal.spec.ts`
- `npm run test:e2e --workspace backend -- test/jobs.e2e-spec.ts`
- `ReadLints` run for changed files (no diagnostics)

### Completion Notes List

- Added canonical contract file `packages/contracts/src/job-cost-signals.ts` with `JOB_COST_SIGNAL_SCHEMA_VERSION`, `JOB_COST_SIGNAL_LOG_KEY`, and `JobCostSignalPayloadV1` (USD estimate + join keys + provenance fields).
- Added centralized backend compute + emit helper in `apps/backend/src/telemetry/job-cost-signal.ts` with deterministic tier/terminal-based MVP model and explicit `JOB_COST_MODEL_VERSION_V1`.
- Wired terminal lifecycle hook in `JobsService` to compute, persist, and emit exactly once on first terminal transition (`ready` or `failed`) alongside lifecycle metrics.
- Extended persisted store normalization to safely accept/ignore optional `jobCostSignalV1` for backward compatibility with legacy rows.
- Added unit tests for computation and emission helper plus e2e coverage that verifies persisted terminal cost snapshot and single cost-log emission across repeated status reads.

### File List

- `packages/contracts/src/job-cost-signals.ts`
- `packages/contracts/src/index.ts`
- `apps/backend/src/telemetry/job-cost-signal.ts`
- `apps/backend/src/telemetry/job-cost-signal.spec.ts`
- `apps/backend/src/modules/jobs/jobs.service.ts`
- `apps/backend/test/jobs.e2e-spec.ts`

## Change Log

- 2026-04-06: Story context created (BMAD create-story workflow) — status `ready-for-dev`.
- 2026-04-06: Implemented Story 5.3 cost-signal contracts, backend compute/persist/emit flow, and test coverage; moved status to `review`.

---

**Completion note:** Ultimate context engine analysis completed—comprehensive developer guide created for flawless implementation.
