# Story 1.7: Persist Drafts and Recover Interrupted Uploads

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a casual creator,  
I want selected inputs and upload progress to survive app interruptions,  
so that I do not lose work after backgrounding, restart, or transient network loss.

## Acceptance Criteria

1. **Given** I started media selection or upload  
   **When** an app lifecycle interruption occurs (background, process death, or transient loss of connectivity during submit)  
   **Then** draft state is restored on return without forcing me to re-select media I already chose.

2. **And** interrupted submission attempts can be retried without redoing all prior selections (same idempotency/retry semantics as Story 1.4; user keeps video + image slots and validation context).

3. **And** UX-DR5 / UX-DR19 alignment: back navigation and automatic draft preservation behave consistently; loading states remain explicit (architecture: avoid generic “loading” — prefer `isSubmittingJob`-style naming where new flags are added).

4. **And** new or extended interactive surfaces expose stable `testID` values and accessibility labels consistent with existing create-job conventions.

**Verification note:** Exercise process-kill and airplane-mode submit interruption on at least one Android and one iOS target (or emulator equivalents); add automated tests for persistence hydration and submit-retry without clearing selections.

## Tasks / Subtasks

- [x] **Durable local draft model (AC: 1, 2)**
  - [x] Define a versioned serializable draft shape (e.g. `CreateJobDraftV1`) covering `JobInputSelectionState` fields plus metadata: `schemaVersion`, `savedAt`, stable `file://` paths for copied assets.
  - [x] Persist to device storage on meaningful changes (debounced) and on app background via `AppState` where appropriate.
  - [x] On app start / create screen mount, hydrate selection state from storage when a valid draft exists.

- [x] **Stable media URIs (AC: 1)**
  - [x] After a successful pick, copy the picked asset into the app sandbox using `expo-file-system` (`documentDirectory` or cache with documented retention rules) so `content://` / `ph://` / ephemeral picker URIs are not required after restart.
  - [x] Re-run metadata extraction (duration, dimensions, mime) after copy if needed so validation still matches Story 1.3 behavior.
  - [x] Handle missing/cleared files gracefully (draft corruption → clear draft + user-visible message).

- [x] **Interrupted “upload” / submit recovery (AC: 2)**
  - [x] Treat “upload” in the current MVP as the **job submission HTTP request** (`POST /v1/generation-jobs`) carrying input metadata; align recovery UX with FR11 until binary Firebase Storage uploads exist.
  - [x] Persist **idempotency key** and submit attempt state across interruptions: do **not** discard the idempotency key on network timeout/abort if no terminal ack was received; only rotate or clear after accepted response or deterministic rejection envelope (extend `useJobSubmission` accordingly).
  - [x] Ensure “Submit” can be tapped again after failure without clearing picks; duplicate successful submits remain impossible via the same idempotency key + backend deduplication.

- [x] **Telemetry (AC: 2, 3)**
  - [x] Emit concise client events for draft save/load, submit retry after failure, and draft discard (align names with `packages/contracts` / existing telemetry patterns).

- [x] **Testing & quality gates (AC: 1–4)**
  - [x] Unit tests: serialization round-trip, reducer hydration, idempotency key retention rules.
  - [x] Component/integration tests: restored selections render; submit retry path does not require new picks.
  - [x] Root lint/typecheck/tests remain green.

## Dev Notes

### Story scope and dependency guardrails

- **In scope:** FR11, NFR5 (client-side job context recovery), UX-DR5, UX-DR19; local draft persistence; submit interruption handling; durable file paths for picked media.
- **Explicitly builds on:** Story 1.2 (selection + constraints), 1.3 (validation), 1.4 (idempotency + ack), 1.5–1.6 (status + preview — do not regress).
- **Out of scope (unless already required by a parallel change):** Epic 2 identity, full Firebase Storage resumable multipart pipeline, backend `modules/uploads` if not yet present — architecture maps future binary uploads there; this story must **not** block on that module but should **not** paint the mobile layer into a corner (keep a small `draft` / `media-local` service boundary so Storage upload can plug in later).

### Previous story intelligence (Story 1.6)

- Preview/export lives under `apps/mobile/src/features/preview-export/`; lifecycle authority remains backend polling (`useJobStatusPolling`).
- `useJobSubmission` currently generates an idempotency key per attempt and **clears it in `finally`** — that defeats recovery after `NETWORK_TIMEOUT` / `NETWORK_ERROR`. Story 1.7 must adjust this so recovery matches acceptance criteria.
- Continue canonical API envelopes, `testID` naming (`create-job.*`), and contracts-first updates where new fields/events are added.

### Architecture compliance (must follow)

- **Offline/draft:** PRD requires preserving draft selections across restarts and transient network loss; architecture “Offline/resume behavior” requires local persistence and reconcile on reconnect.
- **Loading patterns:** Use explicit operation flags (`isRestoringDraft`, `isSubmittingJob`, etc.), not a single ambiguous `isLoading`.
- **Boundaries:** No Firebase SDK calls from presentational components; persistence helpers belong in `features/create-job/services/` or `apps/mobile/src/infra/` as appropriate.
- **Contracts:** Any new shared types or telemetry event names go through `packages/contracts` when shared with backend or analytics.

### Technical requirements

- **Storage API:** Prefer `@react-native-async-storage/async-storage` (Expo-compatible) or an equivalent approved small key-value store; avoid unbounded growth — one active draft record for the create flow is enough for MVP.
- **Files:** Use `expo-file-system` (SDK 55 aligns with existing lockfile transitives; add an explicit dependency in `apps/mobile/package.json` if needed for imports). Document cleanup policy for copied sandbox files when user clears picks or after successful submit if product wants disk hygiene.
- **Security/privacy:** Drafts are on-device only; do not log full local paths in production telemetry (hashed id or boolean flags only).
- **Idempotency:** Backend already deduplicates by `x-banyone-idempotency-key` in `JobsService`; mobile must preserve the key until a parsed success or structured error response — not until transport failure alone.

### File structure (likely touch points)

- `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts` — hydrate / sync with draft service.
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts` — idempotency + interrupted submit behavior.
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx` — restore UX, optional banner if draft restored.
- New: `apps/mobile/src/features/create-job/services/job-draft-storage.ts` (or similar) + types.
- `packages/contracts` — draft schema version + telemetry enums if needed.

### Library / framework requirements

- Expo SDK 55 baseline.
- `expo-file-system` for copy/read/delete in sandbox.
- `@react-native-async-storage/async-storage` for JSON draft persistence (verify Expo install line).
- `AppState` from `react-native` for flush-on-background.

### Testing requirements

- Mock `AsyncStorage` and file-system I/O in unit tests.
- Cover: cold start with valid draft → fields populated; missing file → draft cleared; submit fails mid-flight → retry succeeds without re-pick.
- Maintain accessibility assertions where new controls are added.

### Git intelligence summary

- Recent work follows feature slices under `apps/mobile/src/features/*`, contracts in `packages/contracts`, and story completion commits (`done story 1.6`, etc.). Continue that cadence.

### Latest technical information

- Expo SDK 55: `expo-file-system` `documentDirectory`, `copyAsync`, `getInfoAsync` for verifying copied assets.
- React Native `AppState` transitions: persist aggressively on `background` / `inactive` where needed to survive SIGKILL shortly after.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.7, FR11, Additional Requirements draft persistence]
- [Source: `_bmad-output/planning-artifacts/prd.md` — Offline Mode, draft preservation]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Offline/resume, UX draft restoration, FR mapping to create-job/uploads]
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — Form draft preservation, back navigation]
- [Source: `_bmad-output/implementation-artifacts/1-6-preview-export-and-native-share.md` — prior conventions]
- [Source: [Expo FileSystem SDK 55](https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/)]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- Jest: `waitFor` timeouts when fake timers leaked from `use-job-status-polling` tests; fixed via `jest.useRealTimers()` in affected suites and global `afterEach` in `jest.setup.js`.
- Expo SDK 55 `expo-file-system`: use `expo-file-system/legacy` for `documentDirectory`, `copyAsync`, `getInfoAsync` (main export no longer exposes `documentDirectory` on the default import).

### Completion Notes List

- Implemented `CreateJobDraftV1` in `@banyone/contracts` with `isCreateJobDraftV1` guard; mobile `job-draft-storage.ts` persists one draft (selection + `pendingIdempotencyKey`) via AsyncStorage.
- Picks copy into sandbox under `documentDirectory/create-job-media/` (`copy-media-to-sandbox.ts`); web skips copy.
- `useJobInputSelection`: debounced save + `AppState` flush; hydrate + file existence check; `suppressDraftSaveRef` after successful submit so cleared storage is not immediately rewritten; banners `create-job.draft-restored.banner` / `create-job.draft-corrupted.banner` / `create-job.draft-restoring.banner`.
- `useJobSubmission`: `isSubmittingJob`; retains idempotency key on transport failure; clears key on accepted or structured JSON rejection; persists key via `onPendingIdempotencyKeyChange`; emits `telemetry.create_job_submit_retry_after_failure.v1` on retry after network failure.
- `create-job-screen`: memoized request body/options; clears persisted draft after accepted ack.

### File List

- `packages/contracts/src/create-job-draft.ts` (new)
- `packages/contracts/src/telemetry.ts`
- `packages/contracts/src/index.ts`
- `apps/mobile/package.json`
- `apps/mobile/jest.config.js`
- `apps/mobile/jest.setup.js` (new)
- `apps/mobile/src/features/create-job/utils/media-mime.ts` (new)
- `apps/mobile/src/features/create-job/services/copy-media-to-sandbox.ts` (new)
- `apps/mobile/src/features/create-job/services/job-draft-storage.ts` (new)
- `apps/mobile/src/features/create-job/services/job-draft-storage.test.ts` (new)
- `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.ts`
- `apps/mobile/src/features/create-job/hooks/job-input-selection-reducer.test.ts` (new)
- `apps/mobile/src/features/create-job/hooks/use-job-input-selection.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-input-selection.mime.test.ts`
- `apps/mobile/src/features/create-job/hooks/use-job-submission.ts`
- `apps/mobile/src/features/create-job/types/selection.ts`
- `apps/mobile/src/features/create-job/screens/create-job-screen.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.story-1-2-flow.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-screen.story-1-3-pre-submit-flow.test.tsx`
- `apps/mobile/src/features/create-job/screens/create-job-status-1-5-retry-ux.test.tsx`
- `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx`

### Change Log

- 2026-03-28: Story 1.7 — local draft persistence, sandbox media copies, idempotency retention on submit interruption, draft/submit telemetry, tests and Jest AsyncStorage + timer hygiene.

---

**Story completion status:** Ready for review (implementation complete, tests green).
