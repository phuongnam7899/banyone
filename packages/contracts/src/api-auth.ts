/**
 * Shared auth-related API constants and shapes for mobile + backend.
 */

/** Bearer token used when `BANYONE_AUTH_VERIFIER=test` on the backend. */
export const BANYONE_TEST_FIREBASE_ID_TOKEN = "test-valid-token";

export type ApiAuthErrorCode = "UNAUTHENTICATED" | "INVALID_ID_TOKEN";

export type ApiAuthErrorEnvelope = {
  data: null;
  error: {
    code: ApiAuthErrorCode;
    message: string;
    retryable: false;
    traceId: string;
  };
};
