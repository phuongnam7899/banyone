jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockBanyoneAuth = (() => {
  const { BANYONE_TEST_FIREBASE_ID_TOKEN } = require('@banyone/contracts');
  return {
    isReady: true,
    isRestoringSession: false,
    uid: 'jest-test-uid',
    needsGoogleSignIn: false,
    getIdToken: jest.fn(async () => BANYONE_TEST_FIREBASE_ID_TOKEN),
    triggerGoogleSignIn: jest.fn(async () => {}),
    lastError: null,
  };
})();

jest.mock('@/features/auth/auth-context', () => ({
  BanyoneAuthProvider: ({ children }) => children,
  useBanyoneAuth: () => mockBanyoneAuth,
}));

afterEach(() => {
  jest.useRealTimers();
});
