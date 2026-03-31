import { Platform } from 'react-native';

import type { ApiErrorEnvelope, ExportPayload, PreviewPayload } from '../types/preview-export';
import { banyoneAuthenticatedFetch } from '@/infra/api-client/authenticated-fetch';
import { parseBanyoneApiEnvelopeResponse } from '@/infra/api-client/parse-json-envelope';

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

export async function fetchReadyPreview(
  jobId: string,
  getIdToken: () => Promise<string | null>,
): Promise<
  { data: PreviewPayload; error: null } | ApiErrorEnvelope
> {
  const res = await banyoneAuthenticatedFetch(
    `${API_BASE_URL}${ENDPOINT_PATH}/${jobId}/preview`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not load preview.',
        retryable: true,
        traceId: '',
      },
    };
  }
  return parsed.envelope as { data: PreviewPayload; error: null } | ApiErrorEnvelope;
}

export async function createReadyExport(
  jobId: string,
  getIdToken: () => Promise<string | null>,
): Promise<
  { data: ExportPayload; error: null } | ApiErrorEnvelope
> {
  const res = await banyoneAuthenticatedFetch(
    `${API_BASE_URL}${ENDPOINT_PATH}/${jobId}/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    getIdToken,
  );
  const parsed = await parseBanyoneApiEnvelopeResponse(res);
  if (!parsed.ok) {
    return {
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not prepare export.',
        retryable: true,
        traceId: '',
      },
    };
  }
  return parsed.envelope as { data: ExportPayload; error: null } | ApiErrorEnvelope;
}
