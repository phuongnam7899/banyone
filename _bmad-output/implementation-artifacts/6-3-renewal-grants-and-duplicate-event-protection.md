# Story 6.3: Renewal Grants and Duplicate Event Protection

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the platform,  
I want renewal credit grants processed idempotently,  
so that users get correct balances without duplicates.

## Acceptance Criteria

1. **Grant on initial purchase and renewal events**  
   **Given** RevenueCat webhook event is grantable and mapped to a supported product  
   **When** backend processes the event  
   **Then** credits are granted according to product policy and reflected in user balance.

2. **Duplicate-event no-op safety**  
   **Given** webhook event ID was already reserved/processed  
   **When** backend receives the same event again  
   **Then** event is treated as duplicate no-op and reported for diagnostics without re-granting credits.

## Tasks / Subtasks

- [x] Keep grant policy centralized in `credit-grant-policy.ts` (AC: 1)
- [x] Reserve and dedupe webhook events by immutable event ID before grant mutation (AC: 2)
- [x] Release reservation on write failures so retried webhooks can recover correctly (AC: 1, 2)
- [x] Keep controller response envelopes deterministic for processed/duplicate/ignored outcomes (AC: 2)
- [x] Validate with focused billing webhook and billing service tests (AC: 1, 2)

## Dev Notes

- Idempotency boundary remains server-side and auditable (`RevenueCatEventDedupeStore`).
- Duplicate protection is enforced before grant mutation to prevent double-credit race conditions.
- Error-path reservation release was verified to keep webhook retry behavior safe.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `apps/backend/src/modules/billing/billing.service.ts`
- `apps/backend/src/modules/billing/revenuecat-event-dedupe.store.ts`
- `apps/backend/src/modules/billing/credit-grant-policy.ts`
- `apps/backend/src/modules/billing/billing.controller.ts`
- `apps/backend/src/modules/billing/billing.service.spec.ts`
- `apps/backend/src/modules/billing/billing.controller.spec.ts`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run test --workspace backend -- src/modules/billing/billing.service.spec.ts src/modules/billing/billing.controller.spec.ts src/modules/billing/revenuecat-webhook.validator.spec.ts`

## Change Log

- 2026-05-31: Story processed through code-review and QA gates; status set to `done`.
