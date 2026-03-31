import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useBanyoneAuth } from '@/features/auth/auth-context';

import { useNotificationPreferences } from '../hooks/use-notification-preferences';

export function NotificationPreferencesScreen(): React.ReactElement {
  const { getIdToken } = useBanyoneAuth();
  const {
    preferences,
    isLoading,
    isSaving,
    saveError,
    saveSuccess,
    setLifecycle,
    save,
  } = useNotificationPreferences(getIdToken);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text testID="notifications.preferences.loading">Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>
      <Text style={styles.subtitle}>
        Push notifications are optional. In-app job status remains available at all
        times.
      </Text>

      <PreferenceRow
        label="Job accepted"
        testId="notifications.preferences.toggle.jobQueued"
        value={preferences.lifecycle.jobQueued}
        onValueChange={(value) => setLifecycle({ jobQueued: value })}
      />
      <PreferenceRow
        label="Job ready"
        testId="notifications.preferences.toggle.jobReady"
        value={preferences.lifecycle.jobReady}
        onValueChange={(value) => setLifecycle({ jobReady: value })}
      />
      <PreferenceRow
        label="Job failed"
        testId="notifications.preferences.toggle.jobFailed"
        value={preferences.lifecycle.jobFailed}
        onValueChange={(value) => setLifecycle({ jobFailed: value })}
      />

      <Pressable
        testID="notifications.preferences.save.button"
        accessibilityRole="button"
        disabled={isSaving}
        onPress={() => void save()}
        style={({ pressed }) => [
          styles.saveButton,
          pressed ? styles.saveButtonPressed : null,
          isSaving ? styles.saveButtonDisabled : null,
        ]}>
        <Text style={styles.saveButtonLabel}>
          {isSaving ? 'Saving...' : 'Save preferences'}
        </Text>
      </Pressable>

      {saveSuccess ? (
        <Text testID="notifications.preferences.save.success" style={styles.success}>
          Preferences saved.
        </Text>
      ) : null}
      {saveError ? (
        <Text testID="notifications.preferences.save.error" style={styles.error}>
          {saveError}
        </Text>
      ) : null}
    </View>
  );
}

function PreferenceRow(params: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testId: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{params.label}</Text>
      <Switch
        testID={params.testId}
        value={params.value}
        onValueChange={params.onValueChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 16,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  success: {
    color: '#166534',
  },
  error: {
    color: '#b91c1c',
  },
});
