import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { HistoryDetailScreen } from '@/features/history/screens/history-detail-screen';

export default function HistoryDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) return null;
  return <HistoryDetailScreen jobId={id} />;
}
