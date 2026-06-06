export const BANYONE_BILLING_PRODUCT_IDS = [
  'weekly',
  'monthly',
  'yearly',
] as const;

export type BanyoneBillingProductId =
  (typeof BANYONE_BILLING_PRODUCT_IDS)[number];

const CREDIT_GRANT_BY_PRODUCT: Record<BanyoneBillingProductId, number> = {
  weekly: 7000,
  monthly: 30000,
  yearly: 365000,
};

export const BANYONE_PRO_ENTITLEMENT = 'Banyone Pro';

/**
 * RevenueCat event types that should result in a credit grant. Cancellations,
 * billing issues, and expirations intentionally do not credit the user.
 */
const GRANTABLE_EVENT_TYPES: readonly string[] = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
];

export function isBanyoneBillingProductId(
  value: unknown,
): value is BanyoneBillingProductId {
  return (
    typeof value === 'string' &&
    (BANYONE_BILLING_PRODUCT_IDS as readonly string[]).includes(value)
  );
}

/**
 * Maps RevenueCat / store product identifiers from webhooks to our canonical ids.
 * Webhooks often send App Store / Play SKUs (e.g. com.banyone.weekly) while the
 * app uses short ids (weekly, monthly, yearly).
 */
export function normalizeWebhookProductId(
  raw: string | null | undefined,
): BanyoneBillingProductId | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (isBanyoneBillingProductId(t)) return t;
  const lower = t.toLowerCase();
  if (isBanyoneBillingProductId(lower)) return lower;
  const segments = lower.split(/[/:]/);
  const lastSeg = segments[segments.length - 1];
  if (lastSeg) {
    const dotParts = lastSeg.split('.');
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

export function isGrantableEventType(eventType: string): boolean {
  return GRANTABLE_EVENT_TYPES.includes(eventType.toUpperCase());
}

export function resolveCreditGrantForProduct(
  productId: BanyoneBillingProductId,
): number {
  return CREDIT_GRANT_BY_PRODUCT[productId];
}
