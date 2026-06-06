import { banyoneAuthenticatedFetch } from "@/infra/api-client/authenticated-fetch";
import { parseBanyoneApiEnvelopeResponse } from "@/infra/api-client/parse-json-envelope";
import { resolveBanyoneBackendBaseUrl } from "@/features/notifications/services/push-tokens-api";

export type GenerationCreditsSnapshot = {
  balance: number;
  videoCreditPerSecond: number;
};

export async function fetchGenerationCredits(
  getIdToken: () => Promise<string | null>,
): Promise<GenerationCreditsSnapshot> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/generation-jobs/credits`,
    { method: "GET" },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error("Generation credits load failed");
  }
  const data = parsed.envelope.data as {
    balance?: unknown;
    videoCreditPerSecond?: unknown;
  };
  if (
    typeof data.balance !== "number" ||
    !Number.isFinite(data.balance) ||
    data.balance < 0 ||
    typeof data.videoCreditPerSecond !== "number" ||
    !Number.isFinite(data.videoCreditPerSecond) ||
    data.videoCreditPerSecond < 1
  ) {
    throw new Error("Generation credits load failed");
  }
  return {
    balance: Math.floor(data.balance),
    videoCreditPerSecond: Math.ceil(data.videoCreditPerSecond),
  };
}
