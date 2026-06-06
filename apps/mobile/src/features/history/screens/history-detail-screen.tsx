import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionCard } from '@/components/ui/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useJobHistoryDetail } from '../hooks/use-job-history';
import { toStatusLabel } from '../types/history';

type HistoryDetailScreenProps = {
  jobId: string;
};

export function HistoryDetailScreen(props: HistoryDetailScreenProps): React.JSX.Element {
  const router = useRouter();
  const theme = useTheme();
  const { result, isLoading } = useJobHistoryDetail(props.jobId);

  if (isLoading || result === null) {
    return (
      <ThemedView style={styles.flex1}>
        <View style={styles.center} testID="history.detail.loading">
          <ActivityIndicator color={theme.primary} />
        </View>
      </ThemedView>
    );
  }

  if (result.error !== null) {
    return (
      <ThemedView style={styles.flex1}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <View style={styles.center} testID="history.detail.error">
            <ThemedText type="screenTitle">Unable to load job</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {result.error.code}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.outlineButton,
                { borderColor: theme.primary, backgroundColor: theme.backgroundElementMuted, opacity: pressed ? 0.85 : 1 },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                Go back
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const detail = result.data;

  return (
    <ThemedView style={styles.flex1}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          testID="history.detail.screen">
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed ? { opacity: 0.75 } : null]}>
              <ThemedText type="smallBold" themeColor="primary">
                Back
              </ThemedText>
            </Pressable>
          </View>

          <SectionCard style={styles.heroCard}>
            <ThemedText type="screenTitle" style={styles.statusTitle}>
              {toStatusLabel(detail.status)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" testID="history.detail.updated-at">
              Updated: {detail.updatedAt}
            </ThemedText>
          </SectionCard>

          <SectionCard style={styles.metaCard}>
            {detail.queuedAt ? (
              <MetaRow label="Queued" value={detail.queuedAt} />
            ) : null}
            {detail.processingAt ? (
              <MetaRow label="Processing" value={detail.processingAt} />
            ) : null}
            {detail.readyAt ? <MetaRow label="Ready" value={detail.readyAt} /> : null}
            {detail.failedAt ? <MetaRow label="Failed" value={detail.failedAt} /> : null}
            {detail.failure ? (
              <ThemedText type="small" testID="history.detail.failure.code" themeColor="warningIcon">
                Failure: {detail.failure.reasonCode}
              </ThemedText>
            ) : null}
          </SectionCard>

          <View style={styles.actions}>
            {detail.status === 'failed' && detail.failure?.retryable ? (
              <Pressable
                accessibilityRole="button"
                testID="history.detail.retry.button"
                onPress={() => router.push('/create-job')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Retry in Create
                </ThemedText>
              </Pressable>
            ) : null}
            {detail.status === 'ready' ? (
              <Pressable
                accessibilityRole="button"
                testID="history.detail.view-output.button"
                onPress={() => router.push('/create-job')}
                style={({ pressed }) => [
                  styles.outlineButton,
                  { borderColor: theme.primary, backgroundColor: theme.backgroundElementMuted, opacity: pressed ? 0.85 : 1 },
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  View output in Create
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={styles.metaRow}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  backBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    marginLeft: -Spacing.two,
  },
  heroCard: {
    gap: Spacing.two,
  },
  statusTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  metaCard: {
    gap: Spacing.two,
  },
  metaRow: {
    gap: Spacing.half,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  primaryButton: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  outlineButton: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
