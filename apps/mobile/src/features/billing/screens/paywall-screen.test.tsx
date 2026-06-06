import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { PaywallScreen } from '@/features/billing/screens/paywall-screen';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack(),
  }),
}));

const mockRefreshCredits = jest.fn();
jest.mock('@/features/create-job/hooks/use-generation-credits', () => ({
  useGenerationCredits: () => ({
    credits: { balance: 0, videoCreditPerSecond: 100 },
    isLoadingCredits: false,
    creditsError: null,
    refreshCredits: mockRefreshCredits,
  }),
}));

const mockPresentPaywall = jest.fn();
const mockPurchaseSubscription = jest.fn();
const mockRefreshCustomerInfo = jest.fn();
const mockOpenCustomerCenterIfAvailable = jest.fn();
const mockBillingState = {
  isConfigured: true as boolean,
  isInitializing: false as boolean,
  isPurchaseInFlight: false as boolean,
  isPro: false as boolean,
  activeProductId: null as 'weekly' | 'monthly' | 'yearly' | null,
  nextRenewalAt: null as string | null,
  activePlanCreditsPerPeriod: null as number | null,
  errorMessage: null as string | null,
};

function setBillingState(
  overrides: Partial<typeof mockBillingState> = {},
): void {
  mockBillingState.isConfigured = overrides.isConfigured ?? true;
  mockBillingState.isInitializing = overrides.isInitializing ?? false;
  mockBillingState.isPurchaseInFlight = overrides.isPurchaseInFlight ?? false;
  mockBillingState.isPro = overrides.isPro ?? false;
  mockBillingState.activeProductId = overrides.activeProductId ?? null;
  mockBillingState.nextRenewalAt = overrides.nextRenewalAt ?? null;
  mockBillingState.activePlanCreditsPerPeriod =
    overrides.activePlanCreditsPerPeriod ?? null;
  mockBillingState.errorMessage = overrides.errorMessage ?? null;
}

jest.mock('@/features/billing/hooks/use-billing', () => ({
  useBilling: () => ({
    isConfigured: mockBillingState.isConfigured,
    isInitializing: mockBillingState.isInitializing,
    isPurchaseInFlight: mockBillingState.isPurchaseInFlight,
    isPro: mockBillingState.isPro,
    activeProductId: mockBillingState.activeProductId,
    nextRenewalAt: mockBillingState.nextRenewalAt,
    activePlanCreditsPerPeriod: mockBillingState.activePlanCreditsPerPeriod,
    errorMessage: mockBillingState.errorMessage,
    lastSyncedAtMs: null,
    presentPaywall: mockPresentPaywall,
    purchaseSubscription: mockPurchaseSubscription,
    refreshCustomerInfo: mockRefreshCustomerInfo,
    openCustomerCenterIfAvailable: mockOpenCustomerCenterIfAvailable,
  }),
}));

describe('PaywallScreen', () => {
  beforeEach(() => {
    mockPresentPaywall.mockReset();
    mockPurchaseSubscription.mockReset();
    mockRefreshCustomerInfo.mockReset();
    mockOpenCustomerCenterIfAvailable.mockReset();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockRefreshCredits.mockReset();
    setBillingState();
  });

  it('renders the three Banyone Pro plan options', () => {
    render(<PaywallScreen colorScheme="light" />);
    expect(screen.getByTestId('paywall.plan.weekly')).toBeTruthy();
    expect(screen.getByTestId('paywall.plan.monthly')).toBeTruthy();
    expect(screen.getByTestId('paywall.plan.yearly')).toBeTruthy();
  });

  it('shows initializing loader before billing is configured', () => {
    setBillingState({ isConfigured: false, isInitializing: true });
    render(<PaywallScreen colorScheme="light" />);
    expect(screen.getByTestId('paywall.initializing')).toBeTruthy();
  });

  it('calls purchaseSubscription when a plan row is pressed', async () => {
    mockPurchaseSubscription.mockResolvedValueOnce({
      status: 'purchased',
      productId: 'weekly',
    });
    render(<PaywallScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('paywall.plan.weekly'));
    await waitFor(() => {
      expect(mockPurchaseSubscription).toHaveBeenCalledWith('weekly');
    });
    expect(mockRefreshCredits).toHaveBeenCalled();
  });

  it('refreshes credits and shows success message after a purchase', async () => {
    mockPresentPaywall.mockResolvedValueOnce({
      status: 'purchased',
      productId: 'monthly',
    });
    render(<PaywallScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('paywall.present-button'));

    await waitFor(() => {
      expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockRefreshCredits).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('paywall.outcome-message')).toBeTruthy();
    });
  });

  it('shows cancellation message and does not refresh credits when user cancels', async () => {
    mockPresentPaywall.mockResolvedValueOnce({ status: 'cancelled' });
    render(<PaywallScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('paywall.present-button'));

    await waitFor(() => {
      expect(mockPresentPaywall).toHaveBeenCalled();
    });
    expect(mockRefreshCredits).not.toHaveBeenCalled();
    expect(screen.getByTestId('paywall.outcome-message')).toBeTruthy();
  });

  it('shows already-subscribed message without refreshing credits when paywall is not presented', async () => {
    mockPresentPaywall.mockResolvedValueOnce({ status: 'not-presented' });
    render(<PaywallScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('paywall.present-button'));

    await waitFor(() => {
      expect(mockPresentPaywall).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('paywall.outcome-message')).toBeTruthy();
    });
    expect(
      screen.getByText('You already have an active subscription.'),
    ).toBeTruthy();
    expect(mockRefreshCredits).not.toHaveBeenCalled();
  });

  it('shows an error banner with retry when billing reports an error', async () => {
    setBillingState({ errorMessage: 'Could not initialize billing.' });
    render(<PaywallScreen colorScheme="light" />);
    expect(screen.getByTestId('paywall.error-banner')).toBeTruthy();

    fireEvent.press(screen.getByTestId('paywall.error-retry-button'));
    await waitFor(() => {
      expect(mockRefreshCustomerInfo).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockRefreshCredits).toHaveBeenCalled();
    });
    expect(
      screen.getByText('You can close this screen and keep using the app while billing reconnects.'),
    ).toBeTruthy();
  });

  it('renders current plan details and hides purchase plan rows for Pro users', () => {
    setBillingState({
      isPro: true,
      activeProductId: 'weekly',
      nextRenewalAt: '2026-01-01T00:00:00.000Z',
      activePlanCreditsPerPeriod: 7000,
    });
    render(<PaywallScreen colorScheme="light" />);

    expect(screen.getByTestId('paywall.current-plan-card')).toBeTruthy();
    expect(screen.queryByTestId('paywall.plans-card')).toBeNull();
    expect(screen.queryByTestId('paywall.plan.weekly')).toBeNull();
    expect(
      screen.getByText('7,000 credits will be added on 01/01/2026'),
    ).toBeTruthy();
  });

  it('prevents duplicate customer center opens while one request is in flight', async () => {
    setBillingState({ isPro: true });
    mockOpenCustomerCenterIfAvailable.mockResolvedValueOnce({ supported: true });
    mockOpenCustomerCenterIfAvailable.mockResolvedValueOnce({ supported: true });
    render(<PaywallScreen colorScheme="light" />);
    expect(screen.getByTestId('paywall.change-plan-button')).toBeTruthy();
    expect(screen.getByTestId('paywall.cancel-subscription-button')).toBeTruthy();

    fireEvent.press(screen.getByTestId('paywall.change-plan-button'));
    fireEvent.press(screen.getByTestId('paywall.cancel-subscription-button'));
    await waitFor(() => {
      expect(mockOpenCustomerCenterIfAvailable).toHaveBeenCalledTimes(1);
    });
  });

  it('shows deterministic management fallback when customer center is unavailable', async () => {
    setBillingState({ isPro: true });
    mockOpenCustomerCenterIfAvailable.mockResolvedValueOnce({ supported: false });
    render(<PaywallScreen colorScheme="light" />);

    fireEvent.press(screen.getByTestId('paywall.change-plan-button'));

    await waitFor(() => {
      expect(screen.getByTestId('paywall.outcome-message')).toBeTruthy();
    });
    expect(
      screen.getByText(
        'Manage your subscription from the App Store or Google Play settings.',
      ),
    ).toBeTruthy();
  });

  it('navigates back when Close button is pressed', () => {
    render(<PaywallScreen colorScheme="light" />);
    fireEvent.press(screen.getByTestId('paywall.close-button'));
    expect(mockBack).toHaveBeenCalled();
  });
});
