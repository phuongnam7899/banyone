# Test Automation Summary

**Project:** banyone  
**Generated:** 2026-03-30 (workflow: QA Generate E2E Tests — Story 2.3 User-facing rate-limit notices)

## Framework

- **Mobile (Expo / React Native):** Jest + `jest-expo` + `@testing-library/react-native` — tests live next to source under `apps/mobile/src/**/*.test.{ts,tsx}`.
- **Backend (NestJS):** Jest + `supertest` — API tests in `apps/backend/src/**/*.spec.ts`.

There is no Playwright/Cypress/Detox suite in the repo; “E2E” coverage for Story 2.3 is implemented as **UI workflow tests** with mocked `fetch`, stable `testID`s, and envelope-shaped bodies on non-2xx responses.

## Generated / updated tests (Story 2.3)

### API tests

- [x] `apps/backend/src/modules/jobs/jobs-rate-limit.spec.ts` — **Story 2.3:** `POST /v1/generation-jobs` returns **429** with canonical envelope (`API_RATE_LIMIT_ERROR_CODE`, `retryable`, `details.scope`, `retryAfterSec`), `Retry-After` header; second case for `POST /v1/generation-jobs/:id/export` over limit.

### E2E / UI workflow tests (integration)

- [x] `apps/mobile/src/features/create-job/screens/create-job-submit.test.tsx` — **Story 2.3:** submit with **429** + JSON envelope lands on `create-job.submit.ack.rate-limited` / `.message`; **rejected** / `NETWORK_ERROR` ack path is **not** shown (AC2).
- [x] `apps/mobile/src/features/preview-export/components/preview-export-panel.test.tsx` — **Story 2.3:** preview `GET` **429** + envelope shows `RATE_LIMITED` and server message (not generic network); **export** `POST` **429** + envelope keeps preview ready UI and shows rate-limit copy (parity with throttled export route).

## Coverage (high level)

| Area | Notes |
|------|--------|
| API: throttle → 429 envelope | Create + export POST; envelope shape + `Retry-After`. |
| UI: create job | Envelope on 429 → dedicated rate-limit ack; no generic rejection for envelope errors. |
| UI: preview + export | Preview and export failures preserve `RATE_LIMITED` + server message when body is canonical JSON. |

## Commands

```bash
npm run test --workspace backend -- src/modules/jobs/jobs-rate-limit.spec.ts
npm run test --workspace mobile -- src/features/create-job/screens/create-job-submit.test.tsx src/features/preview-export/components/preview-export-panel.test.tsx
```

## Related suites (other stories)

- [x] `apps/backend/src/modules/jobs/jobs.controller.spec.ts` — auth + job endpoints
- [x] `apps/mobile/src/features/history/screens/history-workflow.story-2-2.test.tsx` — Story 2.2 history

## Next steps

- Wire `apps/mobile` and `apps/backend` test scripts into CI if not already.
- For on-device E2E (Maestro/Detox), add flows that hit a real 429 from a throttled test backend.

## Checklist (workflow)

- [x] API tests present and exercised for Story 2.3
- [x] UI workflow tests for rate-limit surfaces (create + preview/export)
- [x] Tests use project patterns and stable `testID`s / roles
- [x] Targeted test runs passed after updates
- [x] Summary saved to this file
