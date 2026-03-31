import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { NotificationPreferencesScreen } from './notification-preferences-screen';

const mockSetLifecycle = jest.fn();
const mockSave = jest.fn(() => Promise.resolve());
const mockUseNotificationPreferences = jest.fn();

jest.mock('@/features/auth/auth-context', () => ({
  useBanyoneAuth: () => ({ getIdToken: jest.fn() }),
}));

jest.mock('../hooks/use-notification-preferences', () => ({
  useNotificationPreferences: () => mockUseNotificationPreferences(),
}));

describe('NotificationPreferencesScreen', () => {
  beforeEach(() => {
    mockSetLifecycle.mockReset();
    mockSave.mockReset();
    mockUseNotificationPreferences.mockReset();
  });

  it('renders loading state before preferences are loaded', () => {
    mockUseNotificationPreferences.mockReturnValue({
      preferences: {
        lifecycle: { jobQueued: true, jobReady: true, jobFailed: true },
      },
      isLoading: true,
      isSaving: false,
      saveError: null,
      saveSuccess: false,
      setLifecycle: mockSetLifecycle,
      save: mockSave,
    });
    render(<NotificationPreferencesScreen />);
    expect(screen.getByTestId('notifications.preferences.loading')).toBeTruthy();
  });

  it('updates toggle values and saves preferences', () => {
    mockUseNotificationPreferences.mockReturnValue({
      preferences: {
        lifecycle: { jobQueued: true, jobReady: true, jobFailed: true },
      },
      isLoading: false,
      isSaving: false,
      saveError: null,
      saveSuccess: false,
      setLifecycle: mockSetLifecycle,
      save: mockSave,
    });
    render(<NotificationPreferencesScreen />);

    fireEvent(
      screen.getByTestId('notifications.preferences.toggle.jobQueued'),
      'valueChange',
      false,
    );
    expect(mockSetLifecycle).toHaveBeenCalledWith({ jobQueued: false });

    fireEvent.press(screen.getByTestId('notifications.preferences.save.button'));
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('renders actionable error when save fails', () => {
    mockUseNotificationPreferences.mockReturnValue({
      preferences: {
        lifecycle: { jobQueued: true, jobReady: true, jobFailed: true },
      },
      isLoading: false,
      isSaving: false,
      saveError: 'Unable to save notification preferences. Please retry in a moment.',
      saveSuccess: false,
      setLifecycle: mockSetLifecycle,
      save: mockSave,
    });
    render(<NotificationPreferencesScreen />);

    expect(screen.getByTestId('notifications.preferences.save.error')).toBeTruthy();
  });
});
