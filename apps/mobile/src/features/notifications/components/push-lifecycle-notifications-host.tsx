import React from "react";

import { usePushLifecycleNotifications } from "../hooks/use-push-lifecycle-notifications";

/** Registers for lifecycle pushes and handles notification tap → history detail. */
export function PushLifecycleNotificationsHost(): React.ReactElement | null {
  usePushLifecycleNotifications();
  return null;
}
