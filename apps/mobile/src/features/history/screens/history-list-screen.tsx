import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useJobHistoryList } from '../hooks/use-job-history';
import { toStatusLabel } from '../types/history';

export function HistoryListScreen(): React.JSX.Element {
  const router = useRouter();
  const { items, isLoading } = useJobHistoryList();

  if (isLoading) {
    return (
      <View style={styles.center} testID="history.list.loading">
        <ActivityIndicator />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center} testID="history.empty.state">
        <Text style={styles.title}>No jobs yet</Text>
        <Text style={styles.subtitle}>Create your first generation job to see history.</Text>
        <Pressable
          accessibilityRole="button"
          testID="history.empty.create-cta.button"
          onPress={() => router.push('/create-job')}
          style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create Job</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} testID="history.list.screen">
      {items.map((item) => (
        <View key={item.jobId} style={styles.card} testID={`history.list.item.${item.jobId}`}>
          <Text style={styles.title}>{toStatusLabel(item.status)}</Text>
          <Text style={styles.subtitle}>{item.updatedAt}</Text>
          <Pressable
            accessibilityRole="button"
            testID={`history.list.open-detail.button.${item.jobId}`}
            onPress={() => router.push(`/history-detail/${item.jobId}`)}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open Details</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#666' },
  primaryButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#999',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { color: '#111', fontWeight: '500' },
});
