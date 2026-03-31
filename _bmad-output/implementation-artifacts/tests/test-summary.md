# Test Automation Summary

**Project:** banyone  
**Generated:** 2026-03-31 (workflow: QA Generate E2E Tests — Story 2.4 Lifecycle push notifications, Story 2.5 Notification preferences, Story 3.1 Synthetic media disclosure gate)

## Framework

- **Backend (NestJS):** Jest + `supertest` — e2e specs in `apps/backend/test/*.e2e-spec.ts`; unit specs in `apps/backend/src/**/*.spec.ts`.
- **Mobile (Expo):** Jest + `jest-expo` — notification deep-link logic in `apps/mobile/src/features/notifications/**/*.test.ts` (no device E2E runner in repo).

## Generated / updated tests (Stories 2.4, 2.5 & 3.1)

### API / HTTP e2e

- [x] `apps/backend/test/push-tokens.e2e-spec.ts` — **Story 2.4 / 2.5:** full `AppModule` stack; `POST /v1/push-tokens` and `DELETE /v1/push-tokens` with `BANYONE_AUTH_VERIFIER=test`; 401 (`UNAUTHENTICATED`, `INVALID_ID_TOKEN`); success + `PUSH_TOKEN_INVALID` envelope; token persistence via `PushTokensStore`; delete-all vs delete-one; `GET` / `PUT /v1/notification-preferences` defaults, persistence, and canonical validation error envelope for invalid payloads.
- [x] `apps/backend/test/jobs.e2e-spec.ts` — **Stories 2.1 / 2.5 / 3.1:** authenticated jobs API with `BANYONE_AUTH_VERIFIER` + `BANYONE_AUTH_TEST_UID` + bearer token on all job routes; regression `keeps in-app lifecycle status authoritative when all push lifecycle preferences are disabled`; new Story 3.1 coverage for synthetic media disclosure policy gate (`GET /v1/synthetic-media-disclosure`, `POST /v1/synthetic-media-disclosure/acknowledge`, and `POST /v1/generation-jobs` blocked with `DISCLOSURE_REQUIRED` until acknowledgment with deterministic envelope and versioning).

### Existing Story 2.4 / 2.5 tests (dev stories — not newly generated here)

- [x] `apps/backend/src/modules/notifications/push-tokens.controller.spec.ts`
- [x] `apps/backend/src/modules/notifications/job-lifecycle-push.service.spec.ts`
- [x] `apps/mobile/src/features/notifications/infra/resolve-history-detail-from-push-data.test.ts`
- [x] `apps/mobile/src/features/notifications/screens/notification-preferences-screen.test.tsx`

### E2E / UI (mobile)

- Not applicable for full on-device push in CI (no Playwright/Detox/Maestro). Deep-link resolution remains covered by unit tests above.

## Coverage (high level)

| Area | Notes |
|------|--------|
| Push token REST & notification preferences | Auth gates, envelope errors, store side effects, multi-token delete semantics, notification preference defaults/persistence/validation. |
| Jobs e2e | Same user as `__testSeedJob` default via `test-user-uid` + contract token; lifecycle/status invariants hold even when lifecycle push preferences are all disabled; disclosure gate enforced before first submission with deterministic `DISCLOSURE_REQUIRED` / `DISCLOSURE_VERSION_INVALID` envelopes and acceptance persistence. |

## Commands

```bash
npm run test:e2e --workspace backend
npm run test --workspace backend -- src/modules/notifications/push-tokens.controller.spec.ts src/modules/notifications/job-lifecycle-push.service.spec.ts
npm run test --workspace mobile -- src/features/notifications/infra/resolve-history-detail-from-push-data.test.ts
```

## Related suites (other stories)

- [x] `apps/backend/src/modules/jobs/jobs-rate-limit.spec.ts` — Story 2.3
- [x] `apps/mobile/src/features/history/screens/history-workflow.story-2-2.test.tsx` — Story 2.2

## Next steps

- Optional: CI job running `npm run test:e2e --workspace backend`.
- Optional: Maestro/Detox flow for notification tap → `history-detail/[id]` on a dev build.

## Checklist (workflow)

- [x] API / HTTP e2e tests for Story 2.4 push-token surface
- [x] Tests use project patterns (supertest, test auth verifier, temp data dirs)
- [x] Happy path + critical errors (401, invalid body envelope)
- [x] Full backend e2e suite passes after jobs auth alignment
- [x] Summary saved to this file
