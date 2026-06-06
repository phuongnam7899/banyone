import Constants from "expo-constants";
import React from "react";
import { Platform } from "react-native";

function isAndroidExpoGo(): boolean {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}

type Loaded = React.ComponentType;

/**
 * Registers for lifecycle pushes and handles notification tap → history detail.
 * Skips loading `expo-notifications` on Android Expo Go (remote push removed in SDK 53).
 */
export function PushLifecycleNotificationsHost(): React.ReactElement | null {
  const [Impl, setImpl] = React.useState<Loaded | null>(null);

  React.useEffect(() => {
    if (isAndroidExpoGo()) {
      return;
    }
    let cancelled = false;
    void import("./push-lifecycle-notifications-loaded").then((m) => {
      if (!cancelled) {
        setImpl(() => m.PushLifecycleNotificationsLoaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isAndroidExpoGo() || !Impl) {
    return null;
  }
  return <Impl />;
}

