import { banyoneAuthenticatedFetch } from "@/infra/api-client/authenticated-fetch";
import { parseBanyoneApiEnvelopeResponse } from "@/infra/api-client/parse-json-envelope";
import { resolveBanyoneBackendBaseUrl } from "@/features/notifications/services/push-tokens-api";
import type { BanyoneBillingProductId } from "@/features/billing/constants/billing.constants";

/**
 * When EXPO_PUBLIC_BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS=true and backend
 * BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS=true, grants credits without webhooks.
 */
function isTruthyEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function isDevSubscriptionCreditsGrantEnabled(): boolean {
  return (
    __DEV__ &&
    isTruthyEnv(process.env.EXPO_PUBLIC_BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS)
  );
}

export async function requestDevSubscriptionCreditsGrant(
  getIdToken: () => Promise<string | null>,
  productId: BanyoneBillingProductId,
): Promise<{ grantedCredits: number; newBalance: number }> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/billing/dev/grant-subscription-credits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!res.ok) {
    const hint =
      res.status === 404
        ? " Is BANYONE_DEV_GRANT_SUBSCRIPTION_CREDITS=true on the backend and the server restarted?"
        : "";
    throw new Error(
      `Dev credit grant HTTP ${res.status}.${hint} Use your PC LAN IP in EXPO_PUBLIC_BACKEND_URL on a physical device (not localhost).`,
    );
  }
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error(
      "Dev credit grant: response was not a Banyone API envelope (check backend logs).",
    );
  }
  const data = parsed.envelope.data as {
    grantedCredits?: unknown;
    newBalance?: unknown;
  };
  if (
    typeof data.grantedCredits !== "number" ||
    typeof data.newBalance !== "number"
  ) {
    throw new Error("Dev credit grant: missing grantedCredits/newBalance in response.");
  }
  return {
    grantedCredits: data.grantedCredits,
    newBalance: data.newBalance,
  };
}
