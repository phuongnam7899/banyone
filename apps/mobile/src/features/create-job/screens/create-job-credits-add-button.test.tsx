import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('@/infra/telemetry', () => ({
  emitFunnelTelemetry: jest.fn(),
  emitCreateJobDraftTelemetry: jest.fn(),
  emitPreviewExportTelemetry: jest.fn(),
  getTelemetrySessionId: jest.fn(() => 'test-session-id'),
}));

jest.mock('@/features/create-job/hooks/use-job-input-selection', () => ({
  useJobInputSelection: () => ({
    state: {
      videoUri: null,
      videoLabel: null,
      videoDurationSec: null,
      videoWidthPx: null,
      videoHeightPx: null,
      videoMimeType: null,
      imageUri: null,
      imageLabel: null,
      imageWidthPx: null,
      imageHeightPx: null,
      imageMimeType: null,
    },
    pickVideo: jest.fn(),
    pickImage: jest.fn(),
    clearVideo: jest.fn(),
    clearImage: jest.fn(),
    isRestoringDraft: false,
    draftRestoreNotice: null,
    dismissDraftNotice: jest.fn(),
    pendingIdempotencyKey: null,
    setPendingIdempotencyKey: jest.fn(),
    clearPersistedDraftAfterAcceptedJob: jest.fn(),
  }),
}));

jest.mock('@/features/create-job/hooks/use-job-submission', () => ({
  useJobSubmission: () => ({
    isSubmittingJob: false,
    ack: null,
    submit: jest.fn(),
    acknowledgeDisclosure: jest.fn(),
  }),
}));

jest.mock('@/features/job-status/hooks/use-job-status-polling', () => ({
  useJobStatusPolling: () => ({
    status: null,
    isRefreshingStatus: false,
    freshnessSamplesMs: [],
  }),
}));

jest.mock('@/features/create-job/hooks/use-generation-credits', () => ({
  useGenerationCredits: () => ({
    credits: { balance: 1234, videoCreditPerSecond: 100 },
    isLoadingCredits: false,
    creditsError: null,
    refreshCredits: jest.fn(),
  }),
}));

describe('CreateJobScreen credits add-button', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('renders the plus button beside the credits badge', () => {
    render(<CreateJobScreen colorScheme="light" />);
    expect(screen.getByTestId('create-job.credits.badge')).toBeTruthy();
    expect(screen.getByTestId('create-job.credits.rate')).toBeTruthy();
    expect(screen.getByText('Rate: 100 credits/sec')).toBeTruthy();
    expect(screen.getByTestId('create-job.credits.add-button')).toBeTruthy();
  });

  it('navigates to /paywall when the plus button is pressed', () => {
    render(<CreateJobScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('create-job.credits.add-button'));
    expect(mockPush).toHaveBeenCalledWith('/paywall');
  });
});
