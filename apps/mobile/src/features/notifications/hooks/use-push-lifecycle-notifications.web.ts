export function usePushLifecycleNotifications(): void {
  // `expo-notifications` does not expose the full native lifecycle API on web.
  // Keep the host mounted, but make notification wiring a no-op in the browser.
}
