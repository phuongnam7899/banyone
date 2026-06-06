import React from "react";

import { usePushLifecycleNotifications } from "../hooks/use-push-lifecycle-notifications";

/** Loaded only outside Android Expo Go; see `push-lifecycle-notifications-host`. */
export function PushLifecycleNotificationsLoaded(): React.ReactElement | null {
  usePushLifecycleNotifications();
  return null;
}
