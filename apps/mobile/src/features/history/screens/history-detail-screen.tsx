import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useJobHistoryDetail } from '../hooks/use-job-history';
import { toStatusLabel } from '../types/history';

type HistoryDetailScreenProps = {
  jobId: string;
};

export function HistoryDetailScreen(props: HistoryDetailScreenProps): React.JSX.Element {
  const router = useRouter();
  const { result, isLoading } = useJobHistoryDetail(props.jobId);

  if (isLoading || result === null) {
    return (
      <View style={styles.center} testID="history.detail.loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (result.error !== null) {
    return (
      <View style={styles.center} testID="history.detail.error">
        <Text style={styles.title}>Unable to load job detail</Text>
        <Text style={styles.subtitle}>{result.error.code}</Text>
      </View>
    );
  }

  const detail = result.data;

  return (
    <View style={styles.container} testID="history.detail.screen">
      <Text style={styles.title}>{toStatusLabel(detail.status)}</Text>
      <Text testID="history.detail.updated-at">Updated: {detail.updatedAt}</Text>
      {detail.queuedAt ? <Text>Queued: {detail.queuedAt}</Text> : null}
      {detail.processingAt ? <Text>Processing: {detail.processingAt}</Text> : null}
      {detail.readyAt ? <Text>Ready: {detail.readyAt}</Text> : null}
      {detail.failedAt ? <Text>Failed: {detail.failedAt}</Text> : null}
      {detail.failure ? (
        <Text testID="history.detail.failure.code">Failure: {detail.failure.reasonCode}</Text>
      ) : null}

      <View style={styles.actions}>
        {detail.status === 'failed' && detail.failure?.retryable ? (
          <Pressable
            accessibilityRole="button"
            testID="history.detail.retry.button"
            onPress={() => router.push('/create-job')}
            style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Retry in Create Flow</Text>
          </Pressable>
        ) : null}
        {detail.status === 'ready' ? (
          <Pressable
            accessibilityRole="button"
            testID="history.detail.view-output.button"
            onPress={() => router.push('/create-job')}
            style={styles.actionButton}>
            <Text style={styles.actionButtonText}>View Output in Create Flow</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#666' },
  actions: { marginTop: 10, gap: 8 },
  actionButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  actionButtonText: { fontWeight: '500' },
});
