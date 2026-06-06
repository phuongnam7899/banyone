import React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useBanyoneAuth } from "@/features/auth/auth-context";
import {
  RC_PAYWALL_NOT_ATTACHED_CODE,
  type BanyoneBillingProductId,
} from "@/features/billing/constants/billing.constants";
import {
  isDevSubscriptionCreditsGrantEnabled,
  requestDevSubscriptionCreditsGrant,
} from "@/features/billing/services/billing-dev-grant-api";
import {
  ensureRevenueCatSdkAndAppUser,
  fetchCustomerInfoSnapshot,
  openCustomerCenterIfSupported,
  presentPaywallForBanyonePro,
  purchaseSubscriptionByProductId,
} from "@/features/billing/services/revenuecat.client";
import type {
  BillingCustomerSnapshot,
  BillingHookValue,
  PaywallOutcome,
} from "@/features/billing/types/billing.types";

const DEFAULT_ERROR_MESSAGE = "Unable to complete purchase. Please try again.";

export function useBilling(): BillingHookValue {
  const { uid, getIdToken } = useBanyoneAuth();
  const [isConfigured, setIsConfigured] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [isPurchaseInFlight, setIsPurchaseInFlight] = React.useState(false);
  const [isPro, setIsPro] = React.useState(false);
  const [activeProductId, setActiveProductId] =
    React.useState<BanyoneBillingProductId | null>(null);
  const [nextRenewalAt, setNextRenewalAt] = React.useState<string | null>(null);
  const [activePlanCreditsPerPeriod, setActivePlanCreditsPerPeriod] =
    React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lastSyncedAtMs, setLastSyncedAtMs] = React.useState<number | null>(null);

  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applySnapshot = React.useCallback(
    (snapshot: {
      isPro: boolean;
      activeProductId: BanyoneBillingProductId | null;
      nextRenewalAt: string | null;
      activePlanCreditsPerPeriod: number | null;
    }) => {
      if (!isMountedRef.current) return;
      setIsPro(snapshot.isPro);
      setActiveProductId(snapshot.activeProductId);
      setNextRenewalAt(snapshot.nextRenewalAt);
      setActivePlanCreditsPerPeriod(snapshot.activePlanCreditsPerPeriod);
      setLastSyncedAtMs(Date.now());
    },
    [],
  );

  const refreshCustomerInfo =
    React.useCallback(async (): Promise<BillingCustomerSnapshot | null> => {
      try {
        const snapshot = await fetchCustomerInfoSnapshot();
        applySnapshot(snapshot);
        if (isMountedRef.current) setErrorMessage(null);
        return {
          isPro: snapshot.isPro,
          activeProductId: snapshot.activeProductId,
          nextRenewalAt: snapshot.nextRenewalAt,
          activePlanCreditsPerPeriod: snapshot.activePlanCreditsPerPeriod,
        };
      } catch (err: unknown) {
        if (!isMountedRef.current) return null;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not refresh subscription state.",
        );
        return null;
      }
    }, [applySnapshot]);

  const grantDevCreditsIfEnabled = React.useCallback(
    async (
      outcome: PaywallOutcome,
      snapshotAfterRefresh: BillingCustomerSnapshot | null,
    ): Promise<void> => {
      if (!isDevSubscriptionCreditsGrantEnabled()) return;
      const productId: BanyoneBillingProductId | null =
        outcome.status === "purchased" && outcome.productId
          ? outcome.productId
          : snapshotAfterRefresh?.activeProductId ?? null;
      if (!productId) {
        if (__DEV__) {
          console.warn(
            "[billing] Dev credit grant skipped: no productId (check RevenueCat entitlement / active package).",
          );
        }
        return;
      }
      try {
        await requestDevSubscriptionCreditsGrant(getIdToken, productId);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Dev credit grant failed.";
        if (__DEV__) {
          console.warn("[billing] Dev credit grant failed:", msg);
        }
        if (isMountedRef.current) {
          setErrorMessage(
            `${msg} On a real phone, set EXPO_PUBLIC_BACKEND_URL to http://<your-pc-lan-ip>:3000.`,
          );
        }
      }
    },
    [getIdToken],
  );

  React.useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setIsInitializing(true);
      try {
        await ensureRevenueCatSdkAndAppUser(uid);
        if (cancelled) return;
        setIsConfigured(true);
        await refreshCustomerInfo();
      } catch (err: unknown) {
        if (cancelled || !isMountedRef.current) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Could not initialize billing.",
        );
      } finally {
        if (!cancelled && isMountedRef.current) {
          setIsInitializing(false);
        }
      }
    };
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [uid, refreshCustomerInfo]);

  React.useEffect(() => {
    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === "active" && isConfigured) {
        void refreshCustomerInfo();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isConfigured, refreshCustomerInfo]);

  const presentPaywall = React.useCallback(async (): Promise<PaywallOutcome> => {
    if (!isConfigured) {
      return {
        status: "error",
        code: "BILLING_NOT_CONFIGURED",
        message: "Billing is not ready yet. Please try again in a moment.",
      };
    }
    setIsPurchaseInFlight(true);
    setErrorMessage(null);
    try {
      const outcome = await presentPaywallForBanyonePro();
      if (outcome.status === "purchased" || outcome.status === "restored") {
        const snap = await refreshCustomerInfo();
        await grantDevCreditsIfEnabled(outcome, snap);
      }
      if (outcome.status === "error" && isMountedRef.current) {
        if (outcome.code !== RC_PAYWALL_NOT_ATTACHED_CODE) {
          setErrorMessage(outcome.message || DEFAULT_ERROR_MESSAGE);
        } else {
          setErrorMessage(null);
        }
      }
      return outcome;
    } finally {
      if (isMountedRef.current) {
        setIsPurchaseInFlight(false);
      }
    }
  }, [isConfigured, grantDevCreditsIfEnabled, refreshCustomerInfo]);

  const purchaseSubscription = React.useCallback(
    async (productId: BanyoneBillingProductId): Promise<PaywallOutcome> => {
      if (!isConfigured) {
        return {
          status: "error",
          code: "BILLING_NOT_CONFIGURED",
          message: "Billing is not ready yet. Please try again in a moment.",
        };
      }
      setIsPurchaseInFlight(true);
      setErrorMessage(null);
      try {
        const outcome = await purchaseSubscriptionByProductId(productId);
        if (outcome.status === "purchased" || outcome.status === "restored") {
          const snap = await refreshCustomerInfo();
          await grantDevCreditsIfEnabled(outcome, snap);
        }
        if (outcome.status === "error" && isMountedRef.current) {
          setErrorMessage(outcome.message || DEFAULT_ERROR_MESSAGE);
        }
        return outcome;
      } finally {
        if (isMountedRef.current) {
          setIsPurchaseInFlight(false);
        }
      }
    },
    [isConfigured, grantDevCreditsIfEnabled, refreshCustomerInfo],
  );

  const openCustomerCenterIfAvailable = React.useCallback(async () => {
    return openCustomerCenterIfSupported();
  }, []);

  return {
    isConfigured,
    isInitializing,
    isPurchaseInFlight,
    isPro,
    activeProductId,
    nextRenewalAt,
    activePlanCreditsPerPeriod,
    errorMessage,
    lastSyncedAtMs,
    refreshCustomerInfo,
    presentPaywall,
    purchaseSubscription,
    openCustomerCenterIfAvailable,
  };
}
