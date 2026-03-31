import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { HistoryDetailScreen } from './history-detail-screen';

const mockUseJobHistoryDetail = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../hooks/use-job-history', () => ({
  useJobHistoryDetail: () => mockUseJobHistoryDetail(),
}));

describe('HistoryDetailScreen', () => {
  beforeEach(() => {
    mockUseJobHistoryDetail.mockReset();
  });

  it('renders loading state', () => {
    mockUseJobHistoryDetail.mockReturnValue({
      result: null,
      isLoading: true,
      refresh: jest.fn(),
    });
    render(<HistoryDetailScreen jobId="job-1" />);
    expect(screen.getByTestId('history.detail.loading')).toBeTruthy();
  });

  it('renders detail payload fields', () => {
    mockUseJobHistoryDetail.mockReturnValue({
      isLoading: false,
      refresh: jest.fn(),
      result: {
        data: {
          jobId: 'job-1',
          status: 'failed',
          updatedAt: '2026-03-30T00:00:00.000Z',
          failedAt: '2026-03-30T00:00:00.000Z',
          failure: {
            retryable: true,
            reasonCode: 'PROCESSING_FAILED_RETRYABLE',
            nextAction: 'retry',
            message: 'Retry this job.',
          },
        },
        error: null,
      },
    });

    render(<HistoryDetailScreen jobId="job-1" />);
    expect(screen.getByTestId('history.detail.screen')).toBeTruthy();
    expect(screen.getByTestId('history.detail.failure.code')).toBeTruthy();
    expect(screen.getByTestId('history.detail.retry.button')).toBeTruthy();
  });
});
