# Test Automation Summary

**Project:** banyone  
**Date:** 2026-03-26

## Generated Tests

### Story 1.3 — Pre-submit validation and fixable errors

- [x] `apps/mobile/src/features/create-job/screens/create-job-screen.story-1-3-pre-submit-flow.test.tsx` — integration-style workflow (Jest + RNTL), scoped with mocked `useJobInputSelection` + `useJobSubmission`
  - **Happy path:** both slots carry compliant metadata → compliance checker shows `stage.valid` / “Ready” for video and image.
  - **Duration violation:** video over `MAX_SOURCE_VIDEO_DURATION_SEC` → field-linked message (exact max from contracts), `INPUT_VIDEO_DURATION_EXCEEDS_MAX` testIDs, recovery `Pressable` calls `pickVideo`.
  - **Image resolution violation:** reference image over max pixels → video stays valid, image `invalid-with-fix`, fix calls `pickImage`.
  - **Missing metadata:** image URI without dimensions/MIME → `INPUT_METADATA_UNAVAILABLE` copy + deterministic message testID.
  - Unit coverage remains in `validate-job-inputs.test.ts` and `input-compliance-checker.test.tsx`.

### Story 1.2 — Upload inputs with constraint guidance

- [x] `apps/mobile/src/features/create-job/screens/create-job-screen.story-1-2-flow.test.tsx` — integration-style workflow (Jest + React Native Testing Library)
  - **AC1 / linear flow:** tapping video and image pickers invokes `pickVideo` and `pickImage`; selected state shows one label per slot; clear actions invoke `clearVideo` / `clearImage`.
  - **AC2 / AC3:** duration, resolution, and format copy match `@banyone/contracts` constants (same strings as `getCreateJobConstraintBullets()`); format lines include video/image family hints.
  - **AC5:** stable `testID`s on screen, both pickers, requirements region, and input compliance checker.
  - `useJobSubmission` is mocked so this suite stays scoped to Story 1.2 (submit / API remains in `create-job-submit.test.tsx`).

### API / E2E (HTTP)

- **Story 1.3:** N/A for new HTTP tests — acceptance is client-side pre-submit validation only (shared validators live in `@banyone/contracts`; no new public API in 1.3).

- [x] `apps/backend/test/jobs.e2e-spec.ts` — `POST /v1/generation-jobs` via Nest `AppModule` + supertest  
  - Happy path: valid body + `x-banyone-idempotency-key` → success envelope (`jobId`, `status: queued`). Asserts **201** (Nest default for POST).  
  - Error: missing idempotency key → `IDEMPOTENCY_KEY_INVALID` in body.  
  - Error: duration over max → `INPUT_INVALID` with `INPUT_VIDEO_DURATION_EXCEEDS_MAX`.  
  - Idempotency: same key returns the same `jobId` across two requests.  
  - Uses isolated `BANYONE_JOBS_DATA_DIR` per test (temp directory).

### Existing API smoke

- [x] `apps/backend/test/app.e2e-spec.ts` — `GET /` health-style check (unchanged).

### UI / workflow (React Native — integration style)

- [x] `apps/mobile/src/features/create-job/screens/create-job-screen.test.tsx` — critical `testID`s (existing).  
- [x] `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx` — submit + ack (Story 1.4+).  
- [x] Other create-job unit/integration tests under `apps/mobile/src/features/create-job/**`.

> **Note:** The mobile app uses **Jest + React Native Testing Library**, not Playwright/Cypress. End-to-end user flows are covered at the integration layer with testIDs, role/label queries, and mocked native picker hooks, consistent with the current stack.

## Commands

| Scope        | Command |
|-------------|---------|
| Monorepo unit / integration (root script) | `npm test` |
| Backend HTTP E2E only | `npm run test:e2e --workspace backend` |
| Story 1.2 flow only | `npm run test --workspace mobile -- --testPathPattern=create-job-screen.story-1-2-flow` |
| Story 1.3 pre-submit flow only | `npm run test --workspace mobile -- --testPathPattern=create-job-screen.story-1-3-pre-submit-flow` |

Root `npm test` runs mobile, backend **unit** (`jest` in `src/`), and contracts; it does **not** run `test:e2e` — run the backend E2E command in CI or locally when validating HTTP behavior.

## Coverage (high level)

- **Story 1.3:** Full-screen compliance wiring — valid/pending/invalid states, contract-derived max strings on violations, field-linked recovery actions (mocked native pickers).  
- **Story 1.2:** Constraint visibility tied to contracts; two-slot picker interactions; clear/replace; testIDs + accessibility summary on requirements.  
- **API:** `POST /v1/generation-jobs` — happy path, idempotency header failure, validation failure, idempotent replay.  
- **`GET /`:** smoke only.  
- **UI create-job:** selection, validation, submit/ack flows covered in mobile Jest suites; no Detox/device E2E in repo yet.

## Next Steps

- Add `npm run test:e2e --workspace backend` to CI if not already present.  
- For on-device E2E, evaluate **Detox** or **Maestro** when product needs full stack navigation outside Jest.  
- Add more edge cases (e.g. unsupported MIME, missing metadata) as contracts evolve.

## Checklist (Quinn Automate)

- [x] API tests generated where applicable (HTTP E2E for jobs; N/A for Story 1.3 client validation)  
- [x] E2E / integration UI tests for Story 1.2 (`create-job-screen.story-1-2-flow.test.tsx`)  
- [x] E2E / integration UI tests for Story 1.3 (`create-job-screen.story-1-3-pre-submit-flow.test.tsx`)  
- [x] Tests use standard framework APIs (Jest, supertest, RNTL)  
- [x] Happy path + critical interactions (pickers, clear, constraint copy)  
- [x] Full `npm test` passes  
- [x] Summary includes coverage notes and commands  

**Expected:** All targeted tests pass.
