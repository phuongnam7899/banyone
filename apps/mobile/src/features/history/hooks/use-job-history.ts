import React from 'react';

import { useBanyoneAuth } from '@/features/auth/auth-context';

import { fetchJobHistoryDetail, fetchJobHistoryList } from '../services/history-api';
import type { HistoryDetailResponse, HistoryListItem } from '../types/history';

export function useJobHistoryList() {
  const { getIdToken } = useBanyoneAuth();
  const [items, setItems] = React.useState<HistoryListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setErrorCode(null);
    try {
      const result = await fetchJobHistoryList(getIdToken);
      if (result.error === null) {
        setItems(result.data.items);
      } else {
        setItems([]);
        setErrorCode(result.error.code);
      }
    } catch {
      setItems([]);
      setErrorCode('NETWORK_ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, errorCode, refresh };
}

export function useJobHistoryDetail(jobId: string) {
  const { getIdToken } = useBanyoneAuth();
  const [result, setResult] = React.useState<HistoryDetailResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchJobHistoryDetail(jobId, getIdToken);
      setResult(next);
    } catch {
      setResult({
        data: null,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to load job details.',
          retryable: true,
          traceId: 'client-network-error',
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, jobId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { result, isLoading, refresh };
}
