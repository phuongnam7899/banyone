import type { BanyoneBillingProductId } from "@/features/billing/constants/billing.constants";

export type PaywallOutcome =
  | { status: "purchased"; productId: BanyoneBillingProductId | null }
  | { status: "restored" }
  | { status: "cancelled" }
  | { status: "not-presented" }
  | { status: "error"; code: string; message: string };

export type BillingCustomerSnapshot = {
  isPro: boolean;
  activeProductId: BanyoneBillingProductId | null;
  nextRenewalAt: string | null;
  activePlanCreditsPerPeriod: number | null;
};

export type BillingHookState = {
  isConfigured: boolean;
  isInitializing: boolean;
  isPurchaseInFlight: boolean;
  isPro: boolean;
  activeProductId: BanyoneBillingProductId | null;
  nextRenewalAt: string | null;
  activePlanCreditsPerPeriod: number | null;
  errorMessage: string | null;
  lastSyncedAtMs: number | null;
};

export type BillingHookActions = {
  refreshCustomerInfo: () => Promise<BillingCustomerSnapshot | null>;
  presentPaywall: () => Promise<PaywallOutcome>;
  purchaseSubscription: (
    productId: BanyoneBillingProductId,
  ) => Promise<PaywallOutcome>;
  openCustomerCenterIfAvailable: () => Promise<{ supported: boolean }>;
};

export type BillingHookValue = BillingHookState & BillingHookActions;
