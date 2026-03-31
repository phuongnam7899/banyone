import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { HistoryListScreen } from './history-list-screen';

const mockPush = jest.fn();
const mockUseJobHistoryList = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../hooks/use-job-history', () => ({
  useJobHistoryList: () => mockUseJobHistoryList(),
}));

describe('HistoryListScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseJobHistoryList.mockReset();
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

  it('renders populated list and opens detail route', () => {
    mockUseJobHistoryList.mockReturnValue({
      items: [
        { jobId: 'job-1', status: 'queued', updatedAt: '2026-03-30T00:00:00.000Z' },
      ],
      isLoading: false,
      errorCode: null,
      refresh: jest.fn(),
    });
    render(<HistoryListScreen />);
    expect(screen.getByTestId('history.list.item.job-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('history.list.open-detail.button.job-1'));
    expect(mockPush).toHaveBeenCalledWith('/history-detail/job-1');
  });
});
