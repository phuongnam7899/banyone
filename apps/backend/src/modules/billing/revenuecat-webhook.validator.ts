import { Injectable, Logger } from '@nestjs/common';

/**
 * RevenueCat sends webhooks with a shared "Authorization" header that matches
 * the secret configured on the dashboard. We intentionally use a constant-time
 * comparison and reject early when the secret is unset to avoid silently
 * granting credits in misconfigured environments.
 */
@Injectable()
export class RevenueCatWebhookValidator {
  private readonly logger = new Logger(RevenueCatWebhookValidator.name);

  isAuthorized(authorizationHeader: string | undefined | null): boolean {
    const expected = this.resolveExpectedSecret();
    if (!expected) {
      this.logger.warn(
        'REVENUECAT_WEBHOOK_SECRET is not configured; rejecting webhook.',
      );
      return false;
    }
    if (
      typeof authorizationHeader !== 'string' ||
      authorizationHeader.length === 0
    ) {
      return false;
    }
    return constantTimeEqual(
      this.normalizeAuthorizationHeader(authorizationHeader),
      expected,
    );
  }

  private resolveExpectedSecret(): string | null {
    const raw = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeAuthorizationHeader(value: string): string {
    const trimmed = value.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice('bearer '.length).trim();
    }
    return trimmed;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
