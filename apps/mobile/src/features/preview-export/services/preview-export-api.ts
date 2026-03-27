import { Platform } from 'react-native';

import type { ApiErrorEnvelope, ExportPayload, PreviewPayload } from '../types/preview-export';

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

export async function fetchReadyPreview(jobId: string): Promise<
  { data: PreviewPayload; error: null } | ApiErrorEnvelope
> {
  const res = await fetch(`${API_BASE_URL}${ENDPOINT_PATH}/${jobId}/preview`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return (await res.json()) as { data: PreviewPayload; error: null } | ApiErrorEnvelope;
}

export async function createReadyExport(jobId: string): Promise<
  { data: ExportPayload; error: null } | ApiErrorEnvelope
> {
  const res = await fetch(`${API_BASE_URL}${ENDPOINT_PATH}/${jobId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return (await res.json()) as { data: ExportPayload; error: null } | ApiErrorEnvelope;
}
