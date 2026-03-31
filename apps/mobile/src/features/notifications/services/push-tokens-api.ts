import { banyoneAuthenticatedFetch } from "@/infra/api-client/authenticated-fetch";
import { parseBanyoneApiEnvelopeResponse } from "@/infra/api-client/parse-json-envelope";
import { Platform } from "react-native";

export function resolveBanyoneBackendBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/+$/, "");
  }
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export async function registerFcmTokenWithBackend(
  fcmToken: string,
  getIdToken: () => Promise<string | null>,
): Promise<void> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/push-tokens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcmToken }),
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error("Push token registration failed");
  }
}

export async function unregisterAllPushTokensWithBackend(
  getIdToken: () => Promise<string | null>,
): Promise<void> {
  const base = resolveBanyoneBackendBaseUrl();
  const res = await banyoneAuthenticatedFetch(
    `${base}/v1/push-tokens`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok || parsed.envelope.error !== null) {
    throw new Error("Push token unregister failed");
  }
}
