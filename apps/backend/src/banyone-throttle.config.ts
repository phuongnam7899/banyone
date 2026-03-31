/**
 * Env-driven throttling for expensive POST routes (Story 2.3).
 * `ttl` is milliseconds (Throttler package convention).
 */
export function resolveBanyoneThrottleConfig(): {
  ttlMs: number;
  limit: number;
} {
  const rawTtl = Number(process.env.BANYONE_THROTTLE_TTL_MS ?? '');
  const ttlMs =
    Number.isFinite(rawTtl) && rawTtl >= 1_000 ? Math.floor(rawTtl) : 60_000;

  const rawLimit = Number(process.env.BANYONE_THROTTLE_LIMIT ?? '');
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 120;

  return { ttlMs, limit };
}
