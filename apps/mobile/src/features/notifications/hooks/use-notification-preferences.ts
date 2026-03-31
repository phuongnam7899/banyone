import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@banyone/contracts';
import React from 'react';

import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notification-preferences-api';

export function useNotificationPreferences(
  getIdToken: () => Promise<string | null>,
): {
  preferences: NotificationPreferences;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  setLifecycle: (
    next: Partial<NotificationPreferences['lifecycle']>,
  ) => void;
  save: () => Promise<void>;
} {
  const [preferences, setPreferences] = React.useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        const loaded = await fetchNotificationPreferences(getIdToken);
        if (!cancelled) setPreferences(loaded);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const setLifecycle = React.useCallback(
    (next: Partial<NotificationPreferences['lifecycle']>) => {
      setSaveSuccess(false);
      setSaveError(null);
      setPreferences((prev) => ({
        lifecycle: { ...prev.lifecycle, ...next },
      }));
    },
    [],
  );

  const save = React.useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const persisted = await updateNotificationPreferences(preferences, getIdToken);
      setPreferences(persisted);
      setSaveSuccess(true);
    } catch {
      setSaveError(
        'Unable to save notification preferences. Please retry in a moment.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [getIdToken, preferences]);

  return {
    preferences,
    isLoading,
    isSaving,
    saveError,
    saveSuccess,
    setLifecycle,
    save,
  };
}
