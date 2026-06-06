# Story 6.2: Plan Selection and Store Purchase

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a creator,  
I want to choose weekly/monthly/yearly plans and complete purchase through platform stores,  
so that I can subscribe using trusted native billing.

## Acceptance Criteria

1. **Plan options rendered with pricing context**  
   **Given** paywall screen loads  
   **When** plan data is available  
   **Then** weekly/monthly/yearly options show billing period, price, and credits per renewal period.

2. **Deterministic store purchase handling**  
   **Given** user taps a plan  
   **When** store flow completes  
   **Then** success/cancel/not-presented/error outcomes are handled deterministically, with credits refresh attempted for purchase/restore outcomes.

## Tasks / Subtasks

- [x] Keep explicit weekly/monthly/yearly plan rows and metadata in paywall UI (`paywall.plan.weekly|monthly|yearly`) (AC: 1)
- [x] Wire plan-row taps to `purchaseSubscription(productId)` in billing hook (AC: 2)
- [x] Preserve deterministic outcome messaging and guarded retries for store/SDK failures (AC: 2)
- [x] Validate behavior with focused mobile paywall tests (AC: 1, 2)

## Dev Notes

- Reused existing billing integration (`useBilling`, `revenuecat.client`) instead of creating new purchase orchestration.
- Kept architecture boundary intact: purchase orchestration in billing hook/service layer, not in generic UI helpers.
- Ensured UX remains resilient when paywall is not attached or billing is temporarily unavailable.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `apps/mobile/src/features/billing/screens/paywall-screen.tsx`
- `apps/mobile/src/features/billing/hooks/use-billing.ts`
- `apps/mobile/src/features/billing/screens/paywall-screen.test.tsx`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run test --workspace mobile -- src/features/billing/screens/paywall-screen.test.tsx`

## Change Log

- 2026-05-31: Story processed through code-review and QA gates; status set to `done`.
