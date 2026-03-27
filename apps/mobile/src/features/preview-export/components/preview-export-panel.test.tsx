import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React from 'react';

import { PreviewExportPanel } from './preview-export-panel';

jest.mock('expo-media-library');
jest.mock('expo-sharing');

const readyJobStatus = {
  jobId: 'job-9',
  status: 'ready' as const,
  updatedAt: new Date().toISOString(),
};

describe('PreviewExportPanel', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
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
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            exportUri: 'file:///tmp/banyone/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      });

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview.video')).toBeTruthy();
    });

    const shareButton = screen.getByTestId('job-result.share.button');
    expect(shareButton.props.accessibilityState?.disabled ?? shareButton.props.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('job-result.export.button'));

    await waitFor(() => {
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/banyone/job-9.mp4');
    });

    const updatedShareButton = screen.getByTestId('job-result.share.button');
    expect(updatedShareButton.props.accessibilityState?.disabled ?? updatedShareButton.props.disabled).toBe(false);
  });

  it('shows deterministic failed-preview state and retry action', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: null,
          error: {
            code: 'PREVIEW_LOAD_FAILED',
            message: 'Preview failed to load',
            retryable: true,
            traceId: 'trace-1',
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      });

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.retry.button')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('PREVIEW_LOAD_FAILED');
    });

    fireEvent.press(screen.getByTestId('job-result.retry.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview.video')).toBeTruthy();
    });
  });

  it('keeps ready state and shows actionable code when export fails', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: null,
          error: {
            code: 'EXPORT_PREPARATION_FAILED',
            message: 'Unable to prepare export file. Please retry.',
            retryable: true,
            traceId: 'trace-export-1',
          },
        }),
      });

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview.video')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.export.button'));

    await waitFor(() => {
      expect(screen.getByTestId('job-result.error.code')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('EXPORT_PREPARATION_FAILED');
    });

    expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('job-result.preview.video')).toBeTruthy();
  });

  it('shows deterministic share-unavailable guidance after successful export', async () => {
    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            previewUri: 'https://cdn.banyone.local/generated/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          data: {
            jobId: 'job-9',
            status: 'ready',
            updatedAt: new Date().toISOString(),
            exportUri: 'file:///tmp/banyone/job-9.mp4',
            mimeType: 'video/mp4',
          },
          error: null,
        }),
      });

    render(<PreviewExportPanel jobStatus={readyJobStatus} colorScheme="light" />);

    await waitFor(() => {
      expect(screen.getByTestId('job-result.preview.video')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('job-result.export.button'));
    await waitFor(() => {
      expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith('file:///tmp/banyone/job-9.mp4');
    });

    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId('job-result.share.button'));

    await waitFor(() => {
      expect(Sharing.isAvailableAsync).toHaveBeenCalled();
      expect(screen.getByTestId('job-result.error.code')).toBeTruthy();
      expect(String(screen.getByTestId('job-result.error.code').props.children)).toContain('SHARING_UNAVAILABLE');
    });

    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
