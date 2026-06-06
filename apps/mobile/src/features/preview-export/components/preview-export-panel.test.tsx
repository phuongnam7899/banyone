import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { emitJobExperienceMetrics, emitPreviewExportTelemetry } from '@/infra/telemetry';

import { PreviewExportPanel } from './preview-export-panel';

jest.mock('expo-media-library');
jest.mock('expo-sharing');
jest.mock('@/infra/telemetry', () => ({
  emitFunnelTelemetry: jest.fn(),
  emitCreateJobDraftTelemetry: jest.fn(),
  emitPreviewExportTelemetry: jest.fn(),
  emitJobExperienceMetrics: jest.fn(),
  getTelemetrySessionId: jest.fn(() => 'test-session-id'),
}));
const mockAuthContextValue = {
  getIdToken: async () => 'test-token',
};
jest.mock('@/features/auth/auth-context', () => ({
  useBanyoneAuth: () => mockAuthContextValue,
}));

function jsonFetchResponse(body: unknown, status = 200) {
  const serialized = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => serialized,
  };
}

const readyJobStatus = {
  jobId: 'job-9',
  status: 'ready' as const,
  updatedAt: new Date().toISOString(),
};

jest.setTimeout(20_000);

describe('PreviewExportPanel', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    (emitPreviewExportTelemetry as jest.Mock).mockClear();
    (emitJobExperienceMetrics as jest.Mock).mockClear();
    (MediaLibrary.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (MediaLibrary.saveToLibraryAsync as jest.Mock).mockResolvedValue(undefined);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders preview ready state and enables one-tap export', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            exportUri: 'file:///tmp/banyone/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }, 201),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    }, { timeout: 15000 });

    expect(screen.queryByTestId('job-result.share.button')).toBeNull();

    fireEvent.press(screen.getByTestId('job-result.download.button'));

    await waitFor(() => {
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/banyone/job-9.mp4');
    });
    expect(emitPreviewExportTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'preview_viewed',
        funnelStage: 'preview_export',
      }),
    );
    expect(emitPreviewExportTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'export_succeeded',
        funnelStage: 'preview_export',
      }),
    );
    expect(emitJobExperienceMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        metricKind: 'preview_export_step',
        previewExportEvent: 'preview_viewed',
        jobId: 'job-9',
      }),
    );
    expect(emitJobExperienceMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        metricKind: 'preview_export_step',
        previewExportEvent: 'export_succeeded',
        jobId: 'job-9',
      }),
    );

    expect(screen.queryByTestId('job-result.share.button')).toBeNull();
  });

  it('opens and closes preview result popup', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce(
      jsonFetchResponse({
        data: {
          jobId: 'job-9',
          status: 'ready',
          updatedAt: new Date().toISOString(),
          previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
          mimeType: 'video/mp4',
        },
        error: null,
      }),
    );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.preview-result.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.modal.body')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.preview-result.close.button'));

    await waitFor(() => {
      expect(screen.queryByTestId('job-result.preview-result.modal.body')).toBeNull();
    });
  });

  it('shows deterministic failed-preview state and retry action', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: null,
          error: {
            code: 'PREVIEW_LOAD_FAILED',
            message: 'Preview failed to load',
            retryable: true,
            traceId: 'trace-1',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.retry.button')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('PREVIEW_LOAD_FAILED');
    });

    fireEvent.press(screen.getByTestId('job-result.retry.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });
  });

  it('surfaces rate limit copy when preview returns 429 with envelope (not NETWORK_ERROR)', async () => {
    (global as any).fetch = jest.fn().mockResolvedValueOnce(
      jsonFetchResponse(
        {
          data: null,
          error: {
            code: 'RATE_LIMITED',
            message: 'Slow down — wait a moment.',
            retryable: true,
            traceId: 'rl-1',
            details: { scope: 'account', retryAfterSec: 42 },
          },
        },
        429,
      ),
    );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.retry.button')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('RATE_LIMITED');
    });

    expect(screen.getByText('Slow down — wait a moment.')).toBeTruthy();
  });

  it('surfaces rate limit on export when POST returns 429 with envelope (not NETWORK_ERROR)', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse(
          {
            data: null,
            error: {
              code: 'RATE_LIMITED',
              message: 'Export throttled — try again shortly.',
              retryable: true,
              traceId: 'rl-export',
              details: { scope: 'account', retryAfterSec: 30 },
            },
          },
          429,
        ),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.download.button'));

    await waitFor(() => {
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('RATE_LIMITED');
    });

    expect(screen.getByText('Export throttled — try again shortly.')).toBeTruthy();
    expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    expect(String(screen.getByTestId('job-result.error.code').props.children)).not.toContain('NETWORK_ERROR');
  });

  it('surfaces abuse restriction on export without using rate-limit language', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse(
          {
            data: null,
            error: {
              code: 'ABUSE_RESTRICTION_ACTIVE',
              message: 'This account is currently restricted from this action.',
              retryable: false,
              traceId: 'abuse-1',
            },
          },
          201,
        ),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.download.button'));

    await waitFor(() => {
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain(
        'ABUSE_RESTRICTION_ACTIVE',
      );
    });

    expect(screen.getByText('This account is currently restricted from this action.')).toBeTruthy();
  });

  it('keeps ready state and shows actionable code when export fails', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: null,
          error: {
            code: 'EXPORT_PREPARATION_FAILED',
            message: 'Unable to prepare export file. Please retry.',
            retryable: true,
            traceId: 'trace-export-1',
          },
        }, 201),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.download.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.error.code')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('EXPORT_PREPARATION_FAILED');
    });

    expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
  });

  it('keeps share button hidden after successful export', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonFetchResponse({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            exportUri: 'file:///tmp/banyone/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }, 201),
      );

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview-result.button')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.download.button'));
    await waitFor(() => {
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/banyone/job-9.mp4');
    });

    expect(screen.queryByTestId('job-result.share.button')).toBeNull();
    expect(Sharing.isAvailableAsync).not.toHaveBeenCalled();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
