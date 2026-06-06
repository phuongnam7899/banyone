import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { HistoryListScreen } from './history-list-screen';

const mockPush = jest.fn();
const mockUseJobHistoryList = jest.fn();
const mockUsePreviewExport = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../hooks/use-job-history', () => ({
  useJobHistoryList: () => mockUseJobHistoryList(),
}));

jest.mock('@/features/preview-export/hooks/use-preview-export', () => ({
  usePreviewExport: (...args: unknown[]) => mockUsePreviewExport(...args),
}));

describe('HistoryListScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseJobHistoryList.mockReset();
    mockUsePreviewExport.mockReset();
    mockUsePreviewExport.mockReturnValue({
      stage: 'ready',
      preview: { previewUri: 'https://example.com/preview.mp4' },
      isExporting: false,
      exportToLibrary: jest.fn(),
    });
  });

  it('renders loading state', () => {
    mockUseJobHistoryList.mockReturnValue({
      items: [],
      isLoading: true,
      errorCode: null,
      refresh: jest.fn(),
    });
    render(<HistoryListScreen />);
    expect(screen.getByTestId('history.list.loading')).toBeTruthy();
  });

  it('renders empty state with create CTA', () => {
    mockUseJobHistoryList.mockReturnValue({
      items: [],
      isLoading: false,
      errorCode: null,
      refresh: jest.fn(),
    });
    render(<HistoryListScreen />);
    expect(screen.getByTestId('history.empty.state')).toBeTruthy();
    fireEvent.press(screen.getByTestId('history.empty.create-cta.button'));
    expect(mockPush).toHaveBeenCalledWith('/create-job');
  });

  it('renders populated list with thumbnail and preview/download actions', () => {
    mockUseJobHistoryList.mockReturnValue({
      items: [
        {
          jobId: 'job-1',
          status: 'ready',
          updatedAt: '2026-03-30T00:00:00.000Z',
          sourceImageUrl: 'https://example.com/image.jpg',
        },
      ],
      isLoading: false,
      errorCode: null,
      refresh: jest.fn(),
    });
    render(<HistoryListScreen />);
    expect(screen.getByTestId('history.list.item.job-1')).toBeTruthy();
    expect(screen.getByTestId('history.list.thumbnail.job-1')).toBeTruthy();
    expect(screen.getByTestId('history.list.preview.button.job-1')).toBeTruthy();
    expect(screen.getByTestId('history.list.download.button.job-1')).toBeTruthy();
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('keeps preview/download visible but disabled for non-ready jobs', () => {
    mockUseJobHistoryList.mockReturnValue({
      items: [{ jobId: 'job-2', status: 'processing', updatedAt: '2026-03-30T00:00:00.000Z' }],
      isLoading: false,
      errorCode: null,
      refresh: jest.fn(),
    });

    render(<HistoryListScreen />);
    const previewBtn = screen.getByTestId('history.list.preview.button.job-2');
    const downloadBtn = screen.getByTestId('history.list.download.button.job-2');
    expect(previewBtn.props.accessibilityState?.disabled).toBe(true);
    expect(downloadBtn.props.accessibilityState?.disabled).toBe(true);
  });
});
