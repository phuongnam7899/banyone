/**
 * Canonical rate-limit error surface shared by backend + mobile.
 */

export const API_RATE_LIMIT_ERROR_CODE = 'RATE_LIMITED' as const;

export type ApiRateLimitErrorCode = typeof API_RATE_LIMIT_ERROR_CODE;

/** MVP: account-scoped throttling only (Firebase uid). */
export type ApiRateLimitScope = 'account';

export type ApiRateLimitErrorDetails = {
  scope: ApiRateLimitScope;
  /** Seconds until the client should retry (aligns with Retry-After when set). */
  retryAfterSec: number;
  /** Optional transparency when the server chooses to expose policy numbers. */
  limit?: number;
  windowMs?: number;
  /** Plain guidance for product copy; server-provided. */
  cause?: string;
};

export function isApiRateLimitDetails(
  value: unknown,
): value is ApiRateLimitErrorDetails {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    o.scope === 'account' &&
    typeof o.retryAfterSec === 'number' &&
    Number.isFinite(o.retryAfterSec) &&
    o.retryAfterSec >= 0
  );
}
