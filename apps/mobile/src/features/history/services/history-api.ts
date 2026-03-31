import { Platform } from 'react-native';

import { banyoneAuthenticatedFetch } from '@/infra/api-client/authenticated-fetch';

import type { HistoryDetailResponse, HistoryListResponse } from '../types/history';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const API_BASE_URL = resolveApiBaseUrl();
const ENDPOINT_PATH = '/v1/generation-jobs';

export async function fetchJobHistoryList(
  getIdToken: () => Promise<string | null>,
): Promise<HistoryListResponse> {
  const res = await banyoneAuthenticatedFetch(
    `${API_BASE_URL}${ENDPOINT_PATH}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    getIdToken,
  );
  return (await res.json()) as HistoryListResponse;
}

export async function fetchJobHistoryDetail(
  jobId: string,
  getIdToken: () => Promise<string | null>,
): Promise<HistoryDetailResponse> {
  const res = await banyoneAuthenticatedFetch(
    `${API_BASE_URL}${ENDPOINT_PATH}/${jobId}`,
    { method: 'GET', headers: { 'Content-Type': 'application/json' } },
    getIdToken,
  );
  return (await res.json()) as HistoryDetailResponse;
}
