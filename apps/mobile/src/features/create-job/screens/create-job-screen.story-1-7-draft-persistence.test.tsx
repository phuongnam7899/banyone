import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { CreateJobScreen } from '@/features/create-job/screens/create-job-screen';

const mockUseJobInputSelection = jest.fn();

jest.mock('@/features/create-job/hooks/use-job-input-selection', () => ({
  useJobInputSelection: () => mockUseJobInputSelection(),
}));

const baseSelection = {
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
  draftRestoreNotice: null as 'restored' | 'corrupted' | null,
  dismissDraftNotice: jest.fn(),
  pendingIdempotencyKey: null,
  setPendingIdempotencyKey: jest.fn(),
  clearPersistedDraftAfterAcceptedJob: jest.fn(),
};

describe('CreateJobScreen Story 1.7 draft persistence UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseJobInputSelection.mockReturnValue({ ...baseSelection });
  });

  it('shows restoring banner while draft is hydrating', () => {
    mockUseJobInputSelection.mockReturnValue({
      ...baseSelection,
      isRestoringDraft: true,
    });

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.draft-restoring.banner')).toBeTruthy();
    expect(screen.queryByTestId('create-job.draft-restored.banner')).toBeNull();
  });

  it('shows restored banner with dismiss control', () => {
    const dismissDraftNotice = jest.fn();
    mockUseJobInputSelection.mockReturnValue({
      ...baseSelection,
      draftRestoreNotice: 'restored',
      dismissDraftNotice,
    });

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.draft-restored.banner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('create-job.draft-restored.dismiss'));
    expect(dismissDraftNotice).toHaveBeenCalledTimes(1);
  });

  it('shows corrupted draft banner when files are missing', () => {
    const dismissDraftNotice = jest.fn();
    mockUseJobInputSelection.mockReturnValue({
      ...baseSelection,
      draftRestoreNotice: 'corrupted',
      dismissDraftNotice,
    });

    render(<CreateJobScreen colorScheme="light" />);

    expect(screen.getByTestId('create-job.draft-corrupted.banner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('create-job.draft-corrupted.dismiss'));
    expect(dismissDraftNotice).toHaveBeenCalledTimes(1);
  });
});
