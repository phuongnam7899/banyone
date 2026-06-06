# Story 6.5: Support Billing Diagnostics

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a support agent,  
I want subscription-linked credit grant history per account,  
so that I can resolve billing-related user issues accurately.

## Acceptance Criteria

1. **Support-visible account billing diagnostics**  
   **Given** support diagnostics access  
   **When** support queries an account  
   **Then** response includes account-level billing grant history and current subscription state signal.

2. **Support-safe payload contract**  
   **Given** billing diagnostics are exposed to support workflows  
   **When** API response is returned  
   **Then** only safe normalized fields are returned (event identifiers, event type, product identifier, granted credits, processed timestamp), excluding raw store payload.

## Tasks / Subtasks

- [x] Add support billing diagnostics contract types to shared contracts package (AC: 2)
- [x] Extend billing dedupe store/service with support-safe per-user grant-history read model (AC: 1, 2)
- [x] Add `GET /v1/support/billing-diagnostics` route guarded by `SupportGuard` (AC: 1, 2)
- [x] Add service tests for query validation and happy-path billing diagnostics response (AC: 1, 2)
- [x] Re-run backend billing/support tests to validate no regressions (AC: 1, 2)

## Dev Notes

- Reused existing `SupportGuard` and support module boundaries rather than introducing a new diagnostics module.
- Kept payload minimal and support-safe by exposing normalized grant ledger fields only.
- Subscription-state signal is derived from billing grant history available to backend today.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `packages/contracts/src/support-diagnostics.ts`
- `apps/backend/src/modules/billing/revenuecat-event-dedupe.store.ts`
- `apps/backend/src/modules/billing/billing.service.ts`
- `apps/backend/src/modules/support/support.controller.ts`
- `apps/backend/src/modules/support/support.service.ts`
- `apps/backend/src/modules/support/support.service.spec.ts`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run test --workspace backend -- src/modules/billing/billing.service.spec.ts src/modules/billing/billing.controller.spec.ts src/modules/billing/billing-dev.controller.spec.ts src/modules/billing/revenuecat-webhook.validator.spec.ts src/modules/support/support.service.spec.ts`

## Change Log

- 2026-05-31: Story processed through code-review and QA gates; status set to `done`.
