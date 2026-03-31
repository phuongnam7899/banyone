/**
 * Push is assistive only (NFR5): real device builds with FCM need EAS/dev clients;
 * Expo Go does not surface the same push stack — registration is best-effort.
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import React from "react";
import { Platform } from "react-native";

import { useBanyoneAuth } from "@/features/auth/auth-context";

import {
  historyDetailHrefFromJobId,
  resolveHistoryDetailJobIdFromPushData,
} from "../infra/resolve-history-detail-from-push-data";
import {
  registerFcmTokenWithBackend,
  unregisterAllPushTokensWithBackend,
} from "../services/push-tokens-api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function navigateFromNotificationData(
  router: ReturnType<typeof useRouter>,
  raw: Record<string, unknown>,
): void {
  const jobId = resolveHistoryDetailJobIdFromPushData(raw);
  if (!jobId) return;
  router.push(historyDetailHrefFromJobId(jobId));
}

export function usePushLifecycleNotifications(): void {
  const { uid, getIdToken } = useBanyoneAuth();
  const router = useRouter();
  const prevUidRef = React.useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  React.useEffect(() => {
    if (
      lastResponse &&
      lastResponse.actionIdentifier ===
        Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const data = lastResponse.notification.request.content
        .data as Record<string, unknown>;
      navigateFromNotificationData(router, data);
    }
  }, [lastResponse, router]);

  React.useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (
          response.actionIdentifier !==
          Notifications.DEFAULT_ACTION_IDENTIFIER
        ) {
          return;
        }
        const data = response.notification.request.content
          .data as Record<string, unknown>;
        navigateFromNotificationData(router, data);
      },
    );
    return () => sub.remove();
  }, [router]);

  React.useEffect(() => {
    const prev = prevUidRef.current;
    prevUidRef.current = uid;

    if (Platform.OS === "web") {
      return;
    }

    if (prev && !uid) {
      void (async () => {
        try {
          await unregisterAllPushTokensWithBackend(getIdToken);
        } catch {
          /* best-effort — session may already be invalid */
        }
      })();
      return;
    }

    if (!uid) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        if (!Device.isDevice) {
          return;
        }
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const perm = await Notifications.getPermissionsAsync();
        const next =
          perm.status === "granted"
            ? perm
            : await Notifications.requestPermissionsAsync();
        if (next.status !== "granted" || cancelled) {
          return;
        }

        const devicePush = await Notifications.getDevicePushTokenAsync();
        if (cancelled) return;
        const token =
          typeof devicePush.data === "string" ? devicePush.data : null;
        if (!token?.trim()) return;

        await registerFcmTokenWithBackend(token.trim(), getIdToken);
      } catch {
        /* permissions denied, Expo Go, or FCM not configured — in-app status remains authoritative */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getIdToken, uid]);
}
