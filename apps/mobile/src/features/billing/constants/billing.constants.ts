export const BANYONE_PRO_ENTITLEMENT = "Banyone Pro";

export const BANYONE_BILLING_PRODUCT_IDS = ["weekly", "monthly", "yearly"] as const;

export type BanyoneBillingProductId = (typeof BANYONE_BILLING_PRODUCT_IDS)[number];

export function isBanyoneBillingProductId(
  value: unknown,
): value is BanyoneBillingProductId {
  return (
    typeof value === "string" &&
    (BANYONE_BILLING_PRODUCT_IDS as readonly string[]).includes(value)
  );
}

/** Aligns store / RevenueCat product strings with canonical weekly | monthly | yearly. */
export function normalizeToBanyoneBillingProductId(
  raw: string | null | undefined,
): BanyoneBillingProductId | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (isBanyoneBillingProductId(t)) return t;
  const lower = t.toLowerCase();
  if (isBanyoneBillingProductId(lower)) return lower;
  const segments = lower.split(/[/:]/);
  const lastSeg = segments[segments.length - 1];
  if (lastSeg) {
    const dotParts = lastSeg.split(".");
    const lastDot = dotParts[dotParts.length - 1];
    if (isBanyoneBillingProductId(lastDot)) return lastDot;
  }
  for (const id of BANYONE_BILLING_PRODUCT_IDS) {
    if (lower.endsWith(`.${id}`) || lower.endsWith(`:${id}`)) {
      return id;
    }
  }
  return null;
}

/**
 * Public RevenueCat API key for the mobile app. Public keys are safe to ship in
 * the client per RevenueCat docs; secrets stay in backend webhook config.
 *
 * Read from EXPO_PUBLIC_REVENUECAT_API_KEY when available so different builds
 * can target different RevenueCat projects without code changes; falls back to
 * the test key approved for this integration.
 */
/** Returned in PaywallOutcome when RevenueCat Paywall UI is not configured for the offering. */
export const RC_PAYWALL_NOT_ATTACHED_CODE = "RC_PAYWALL_NOT_ATTACHED";

export function resolveRevenueCatApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return "test_XzKBexGixrbIawvFVihQiTjuvgj";
}
