# Story 6.4: Active Plan Management and Restore Purchases

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a subscriber,  
I want to view active plan details, restore purchases, and manage/cancel plan from platform surfaces,  
so that my subscription remains portable and controllable.

## Acceptance Criteria

1. **Active plan and renewal visibility**  
   **Given** user has active subscription  
   **When** subscription settings/paywall are opened  
   **Then** active plan and next renewal credits context are visible.

2. **Restore purchase continuity**  
   **Given** reinstall/new-device scenario  
   **When** restore/purchase outcome is returned by billing provider  
   **Then** app reflects restored entitlement and refreshes credits.

3. **Manage/cancel routing**  
   **Given** user wants to change or cancel plan  
   **When** manage actions are selected  
   **Then** app routes to platform-supported customer center/store management surfaces.

## Tasks / Subtasks

- [x] Render current-plan card with active product and renewal-credit messaging (AC: 1)
- [x] Keep restore/purchase outcome handling deterministic with post-outcome credit refresh (AC: 2)
- [x] Wire change-plan/cancel actions through customer-center integration with graceful fallback guidance (AC: 3)
- [x] Guard duplicate management taps and retry paths to avoid repeated in-flight actions (AC: 2, 3)
- [x] Validate with paywall screen tests covering pro/non-pro, restore, and management flows (AC: 1, 2, 3)

## Dev Notes

- Used existing `useBilling` APIs to avoid introducing parallel entitlement state sources.
- Kept fallback messaging explicit when customer center support is unavailable on device/runtime.
- Maintained support-safe UX: no raw store payloads exposed in UI states.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `apps/mobile/src/features/billing/screens/paywall-screen.tsx`
- `apps/mobile/src/features/billing/hooks/use-billing.ts`
- `apps/mobile/src/features/billing/services/revenuecat.client.ts`
- `apps/mobile/src/features/billing/screens/paywall-screen.test.tsx`

## Dev Agent Record

### Agent Model Used

gpt-5.3-codex

### Debug Log References

- `npm run test --workspace mobile -- src/features/billing/screens/paywall-screen.test.tsx`

## Change Log

- 2026-05-31: Story processed through code-review and QA gates; status set to `done`.
