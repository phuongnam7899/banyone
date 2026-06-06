/**
 * Credit gating errors for generation creation.
 */

export const INSUFFICIENT_CREDIT_ERROR_CODE = 'INSUFFICIENT_CREDIT' as const;

export type InsufficientCreditErrorCode = typeof INSUFFICIENT_CREDIT_ERROR_CODE;

export type InsufficientCreditErrorDetails = {
  balance: number;
  required: number;
  shortfall: number;
  videoCreditPerSecond: number;
};

export function isInsufficientCreditDetails(
  value: unknown,
): value is InsufficientCreditErrorDetails {
  if (value === null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.balance === 'number' &&
    Number.isFinite(o.balance) &&
    o.balance >= 0 &&
    typeof o.required === 'number' &&
    Number.isFinite(o.required) &&
    o.required >= 0 &&
    typeof o.shortfall === 'number' &&
    Number.isFinite(o.shortfall) &&
    o.shortfall >= 0 &&
    typeof o.videoCreditPerSecond === 'number' &&
    Number.isFinite(o.videoCreditPerSecond) &&
    o.videoCreditPerSecond >= 1
  );
}
