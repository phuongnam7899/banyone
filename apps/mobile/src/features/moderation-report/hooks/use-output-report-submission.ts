import type {
  CreateOutputReportResponse,
  OutputReportReasonCategory,
} from '@banyone/contracts';
import React from 'react';
import { Platform } from 'react-native';

import { useBanyoneAuth } from '@/features/auth/auth-context';
import { banyoneAuthenticatedFetch } from '@/infra/api-client/authenticated-fetch';
import { parseBanyoneApiEnvelopeResponse } from '@/infra/api-client/parse-json-envelope';

type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'success'; data: CreateOutputReportResponse }
  | { kind: 'error'; code: string; message: string; traceId: string };

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

const API_BASE_URL = resolveApiBaseUrl();

export function useOutputReportSubmission(jobId: string): {
  isSubmitting: boolean;
  submission: SubmissionState;
  submitReport: (
    reasonCategory: OutputReportReasonCategory,
    details?: string,
  ) => Promise<void>;
  reset: () => void;
} {
  const { getIdToken } = useBanyoneAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submission, setSubmission] = React.useState<SubmissionState>({
    kind: 'idle',
  });

  const submitReport = React.useCallback(
    async (reasonCategory: OutputReportReasonCategory, details?: string) => {
      setIsSubmitting(true);
      setSubmission({ kind: 'idle' });
      try {
        const res = await banyoneAuthenticatedFetch(
          `${API_BASE_URL}/v1/generation-jobs/${encodeURIComponent(jobId)}/reports`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reasonCategory,
              ...(details?.trim() ? { details: details.trim() } : {}),
            }),
          },
          getIdToken,
        );
        const parsed = await parseBanyoneApiEnvelopeResponse(res);
        if (!parsed.ok) {
          setSubmission({
            kind: 'error',
            code: 'NETWORK_ERROR',
            message: 'Unable to submit report right now. Please try again.',
            traceId: '',
          });
          return;
        }

        if (parsed.envelope.error !== null) {
          setSubmission({
            kind: 'error',
            code: parsed.envelope.error.code ?? 'UNKNOWN_ERROR',
            message: parsed.envelope.error.message ?? 'Unable to submit report.',
            traceId: parsed.envelope.error.traceId ?? '',
          });
          return;
        }

        setSubmission({
          kind: 'success',
          data: parsed.envelope.data as CreateOutputReportResponse,
        });
      } catch (caught) {
        const message =
          caught instanceof Error &&
          caught.message.includes('missing Firebase ID token')
            ? 'Please sign in before sending reports.'
            : 'Unable to submit report right now. Please try again.';
        setSubmission({
          kind: 'error',
          code: 'NETWORK_ERROR',
          message,
          traceId: '',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [getIdToken, jobId],
  );

  const reset = React.useCallback(() => {
    setSubmission({ kind: 'idle' });
  }, []);

  return {
    isSubmitting,
    submission,
    submitReport,
    reset,
  };
}
