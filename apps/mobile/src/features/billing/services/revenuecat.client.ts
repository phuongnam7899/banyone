import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from "react-native-purchases";
import { Platform } from "react-native";
import RevenueCatUI, {
  PAYWALL_RESULT,
} from "react-native-purchases-ui";

import {
  BANYONE_PRO_ENTITLEMENT,
  normalizeToBanyoneBillingProductId,
  RC_PAYWALL_NOT_ATTACHED_CODE,
  resolveRevenueCatApiKey,
  type BanyoneBillingProductId,
} from "@/features/billing/constants/billing.constants";
import type { PaywallOutcome } from "@/features/billing/types/billing.types";

let isSdkConfigured = false;
/** Last Firebase uid passed to Purchases.logIn — avoids redundant logIn calls. */
let lastSyncedAppUserId: string | null = null;

export type CustomerInfoSnapshot = {
  isPro: boolean;
  activeProductId: BanyoneBillingProductId | null;
  nextRenewalAt: string | null;
  activePlanCreditsPerPeriod: number | null;
};

function readActiveBanyoneProEntitlement(customerInfo: CustomerInfo | null): {
  hasEntitlement: boolean;
  productIdentifier: string | null;
} {
  if (!customerInfo) {
    return { hasEntitlement: false, productIdentifier: null };
  }
  const entitlement = customerInfo.entitlements?.active?.[BANYONE_PRO_ENTITLEMENT];
  if (!entitlement) {
    return { hasEntitlement: false, productIdentifier: null };
  }
  return {
    hasEntitlement: true,
    productIdentifier:
      typeof entitlement.productIdentifier === "string"
        ? entitlement.productIdentifier
        : null,
  };
}

function readAnyActiveEntitlement(customerInfo: CustomerInfo | null): {
  hasAnyActiveEntitlement: boolean;
  productIdentifier: string | null;
  expirationDate: string | null;
} {
  const activeEntitlements = customerInfo?.entitlements?.active;
  if (!activeEntitlements || typeof activeEntitlements !== "object") {
    return {
      hasAnyActiveEntitlement: false,
      productIdentifier: null,
      expirationDate: null,
    };
  }
  const entitlementValues = Object.values(
    activeEntitlements as Record<string, unknown>,
  );
  for (const rawEntitlement of entitlementValues) {
    if (!rawEntitlement || typeof rawEntitlement !== "object") continue;
    const entitlement = rawEntitlement as {
      productIdentifier?: unknown;
      expirationDate?: unknown;
    };
    const productIdentifier =
      typeof entitlement.productIdentifier === "string"
        ? entitlement.productIdentifier
        : null;
    const expirationDate =
      typeof entitlement.expirationDate === "string" &&
      entitlement.expirationDate.trim().length > 0
        ? entitlement.expirationDate
        : null;
    return {
      hasAnyActiveEntitlement: true,
      productIdentifier,
      expirationDate,
    };
  }
  return {
    hasAnyActiveEntitlement: false,
    productIdentifier: null,
    expirationDate: null,
  };
}

function readActiveSubscriptionFallback(
  customerInfo: CustomerInfo | null,
): BanyoneBillingProductId | null {
  if (!customerInfo) return null;
  const activeSubscriptions =
    (customerInfo as { activeSubscriptions?: unknown }).activeSubscriptions ?? null;
  if (!Array.isArray(activeSubscriptions)) return null;
  for (const sub of activeSubscriptions) {
    const normalized = normalizeToBanyoneBillingProductId(
      typeof sub === "string" ? sub : null,
    );
    if (normalized) return normalized;
  }
  return null;
}

export function summarizeCustomerInfo(
  customerInfo: CustomerInfo | null,
): CustomerInfoSnapshot {
  const { hasEntitlement, productIdentifier } = readActiveBanyoneProEntitlement(customerInfo);
  const {
    hasAnyActiveEntitlement,
    productIdentifier: anyEntitlementProductIdentifier,
    expirationDate: anyEntitlementExpirationDate,
  } = readAnyActiveEntitlement(customerInfo);
  const activeEntitlement = customerInfo?.entitlements?.active?.[BANYONE_PRO_ENTITLEMENT];
  const activeProductId =
    normalizeToBanyoneBillingProductId(productIdentifier) ??
    normalizeToBanyoneBillingProductId(anyEntitlementProductIdentifier) ??
    readActiveSubscriptionFallback(customerInfo);
  const nextRenewalAtRaw = activeEntitlement?.expirationDate ?? anyEntitlementExpirationDate;
  const nextRenewalAt =
    typeof nextRenewalAtRaw === "string" && nextRenewalAtRaw.trim().length > 0
      ? nextRenewalAtRaw
      : null;
  return {
    isPro: hasEntitlement || hasAnyActiveEntitlement || activeProductId !== null,
    activeProductId,
    nextRenewalAt,
    activePlanCreditsPerPeriod: creditsForProductId(activeProductId),
  };
}

function creditsForProductId(productId: BanyoneBillingProductId | null): number | null {
  if (productId === "weekly") return 7000;
  if (productId === "monthly") return 30000;
  if (productId === "yearly") return 365000;
  return null;
}

/**
 * Configures the native SDK once, then links the subscriber to the Firebase uid
 * via logIn so RevenueCat webhooks use the same id as GET /credits.
 */
export async function ensureRevenueCatSdkAndAppUser(
  appUserId: string | null,
): Promise<void> {
  if (!isSdkConfigured) {
    const apiKey = resolveRevenueCatApiKey();
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });
    isSdkConfigured = true;
  }

  const trimmed = appUserId?.trim() ?? "";
  if (trimmed.length > 0) {
    if (lastSyncedAppUserId !== trimmed) {
      await Purchases.logIn(trimmed);
      lastSyncedAppUserId = trimmed;
    }
    return;
  }

  if (lastSyncedAppUserId !== null) {
    await Purchases.logOut();
    lastSyncedAppUserId = null;
  }
}

/** @deprecated Use ensureRevenueCatSdkAndAppUser */
export async function configureRevenueCatIfNeeded(
  appUserId: string | null,
): Promise<void> {
  await ensureRevenueCatSdkAndAppUser(appUserId);
}

/**
 * Loads subscription state from RevenueCat’s backend (not only on-device cache)
 * so the UI matches what you see in the dashboard for this app user id.
 */
export async function fetchCustomerInfoSnapshot(): Promise<CustomerInfoSnapshot> {
  try {
    const { customerInfo } = await Purchases.syncPurchasesForResult();
    return summarizeCustomerInfo(customerInfo);
  } catch {
    const customerInfo = await Purchases.getCustomerInfo();
    return summarizeCustomerInfo(customerInfo);
  }
}

export async function presentPaywallForBanyonePro(): Promise<PaywallOutcome> {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: BANYONE_PRO_ENTITLEMENT,
    });
    return mapPaywallResult(result);
  } catch (err: unknown) {
    if (isUserCancelledError(err)) {
      return { status: "cancelled" };
    }
    if (isMissingRevenueCatPaywallTemplateError(err)) {
      return {
        status: "error",
        code: RC_PAYWALL_NOT_ATTACHED_CODE,
        message:
          "No RevenueCat paywall is attached to this offering yet. Tap a plan below to use the store purchase sheet, or attach a paywall in the RevenueCat dashboard.",
      };
    }
    return {
      status: "error",
      code:
        typeof (err as { code?: unknown })?.code === "string"
          ? (err as { code: string }).code
          : "PAYWALL_PRESENTATION_FAILED",
      message:
        err instanceof Error
          ? err.message
          : "Unable to complete purchase. Please try again.",
    };
  }
}

/**
 * Purchases the package whose store product id matches `productId` (weekly | monthly | yearly)
 * from the current or `default` offering. Use when Paywall UI is not configured.
 */
export async function purchaseSubscriptionByProductId(
  productId: BanyoneBillingProductId,
): Promise<PaywallOutcome> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current ?? offerings.all?.default ?? null;
    if (!offering?.availablePackages?.length) {
      return {
        status: "error",
        code: "OFFERING_UNAVAILABLE",
        message:
          "Subscription options are not available yet. Check your RevenueCat offering and store products.",
      };
    }
    const pkg = offering.availablePackages.find((p) => {
      const storeId = getStoreProductIdentifierFromPackage(p);
      return (
        storeId === productId ||
        normalizeToBanyoneBillingProductId(storeId) === productId
      );
    });
    if (!pkg) {
      return {
        status: "error",
        code: "PACKAGE_NOT_FOUND",
        message: `No package found for “${productId}” in the current offering. Verify package product ids in RevenueCat.`,
      };
    }
    await Purchases.purchasePackage(pkg);
    return { status: "purchased", productId };
  } catch (err: unknown) {
    if (isUserCancelledError(err)) {
      return { status: "cancelled" };
    }
    return {
      status: "error",
      code:
        typeof (err as { code?: unknown })?.code === "string"
          ? (err as { code: string }).code
          : "PURCHASE_FAILED",
      message:
        err instanceof Error
          ? err.message
          : "Unable to complete purchase. Please try again.",
    };
  }
}

function getStoreProductIdentifierFromPackage(pkg: {
  product?: { identifier?: string };
}): string | null {
  const id = pkg.product?.identifier;
  return typeof id === "string" ? id : null;
}

function isMissingRevenueCatPaywallTemplateError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const n = msg.toLowerCase();
  return (
    n.includes("paywall") &&
    (n.includes("doesn't have") ||
      n.includes("does not have") ||
      n.includes("no paywall") ||
      n.includes("not attached") ||
      n.includes("attach"))
  );
}

export async function openCustomerCenterIfSupported(): Promise<{
  supported: boolean;
}> {
  // RevenueCat Customer Center is not interactive on web preview mode.
  if (Platform.OS === "web") {
    return { supported: false };
  }
  const presenter = (
    RevenueCatUI as unknown as {
      presentCustomerCenter?: () => Promise<unknown>;
    }
  ).presentCustomerCenter;
  if (typeof presenter !== "function") {
    return { supported: false };
  }
  try {
    await presenter.call(RevenueCatUI);
    return { supported: true };
  } catch {
    return { supported: false };
  }
}

function isUserCancelledError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as {
    userCancelled?: unknown;
    code?: unknown;
    message?: unknown;
  };
  if (candidate.userCancelled === true) return true;
  if (
    typeof candidate.code === "string" &&
    candidate.code.toLowerCase().includes("cancel")
  ) {
    return true;
  }
  if (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes("cancel")
  ) {
    return true;
  }
  return false;
}

function mapPaywallResult(result: PAYWALL_RESULT): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return { status: "purchased", productId: null };
    case PAYWALL_RESULT.RESTORED:
      return { status: "restored" };
    case PAYWALL_RESULT.CANCELLED:
      return { status: "cancelled" };
    case PAYWALL_RESULT.NOT_PRESENTED:
      return { status: "not-presented" };
    case PAYWALL_RESULT.ERROR:
      return {
        status: "error",
        code: "PAYWALL_PRESENTATION_FAILED",
        message: "Unable to complete purchase. Please try again.",
      };
    default:
      return { status: "not-presented" };
  }
}

/** Test-only helper to reset cached configuration state. */
export function __resetRevenueCatClientForTests(): void {
  isSdkConfigured = false;
  lastSyncedAppUserId = null;
}
