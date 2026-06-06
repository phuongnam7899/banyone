import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SectionCard } from "@/components/ui/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radius, Spacing } from "@/constants/theme";
import { useBanyoneAuth } from "@/features/auth/auth-context";
import { useTheme } from "@/hooks/use-theme";

import { useNotificationPreferences } from "../hooks/use-notification-preferences";

export function NotificationPreferencesScreen(): React.ReactElement {
  const router = useRouter();
  const theme = useTheme();
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
      <ThemedView style={styles.flex1}>
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          <View style={styles.loadingBox}>
            <ThemedText
              testID="notifications.preferences.loading"
              type="small"
              themeColor="textSecondary"
            >
              Loading preferences…
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex1}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="notifications.preferences.back"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/create-job")
            }
            style={({ pressed }) => [
              styles.backBtn,
              pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <ThemedText type="smallBold" themeColor="primary">
              Back
            </ThemedText>
          </Pressable>
        </View>

        {/* <ScreenHeader
          title="Settings"
          subtitle="Optional push notifications for job lifecycle events."
          eyebrow={null}
        /> */}

        <SectionCard style={styles.prefsCard}>
          <PreferenceRow
            label="Job accepted"
            testId="notifications.preferences.toggle.jobQueued"
            value={preferences.lifecycle.jobQueued}
            onValueChange={(value) => setLifecycle({ jobQueued: value })}
            colorScheme={{ false: theme.backgroundSelected, true: theme.primary }}
            thumbColor={theme.onPrimary}
          />
          <PreferenceRow
            label="Job ready"
            testId="notifications.preferences.toggle.jobReady"
            value={preferences.lifecycle.jobReady}
            onValueChange={(value) => setLifecycle({ jobReady: value })}
            colorScheme={{ false: theme.backgroundSelected, true: theme.primary }}
            thumbColor={theme.onPrimary}
          />
          <PreferenceRow
            label="Job failed"
            testId="notifications.preferences.toggle.jobFailed"
            value={preferences.lifecycle.jobFailed}
            onValueChange={(value) => setLifecycle({ jobFailed: value })}
            colorScheme={{ false: theme.backgroundSelected, true: theme.primary }}
            thumbColor={theme.onPrimary}
          />
        </SectionCard>

        <Pressable
          testID="notifications.preferences.save.button"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: theme.primary,
              opacity: isSaving ? 0.6 : pressed ? 0.92 : 1,
            },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {isSaving ? "Saving…" : "Save preferences"}
          </ThemedText>
        </Pressable>

        {saveSuccess ? (
          <ThemedText
            testID="notifications.preferences.save.success"
            type="small"
            themeColor="primary"
          >
            Preferences saved.
          </ThemedText>
        ) : null}
        {saveError ? (
          <ThemedText
            testID="notifications.preferences.save.error"
            type="small"
            themeColor="textSecondary"
          >
            {saveError}
          </ThemedText>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

function PreferenceRow(params: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testId: string;
  colorScheme: { false: string; true: string };
  thumbColor: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <ThemedText type="default">{params.label}</ThemedText>
      <Switch
        testID={params.testId}
        value={params.value}
        onValueChange={params.onValueChange}
        trackColor={params.colorScheme}
        thumbColor={params.thumbColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.one,
  },
  backBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    marginLeft: -Spacing.two,
  },
  prefsCard: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  saveButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    alignItems: "center",
  },
});
