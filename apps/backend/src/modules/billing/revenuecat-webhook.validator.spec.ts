import { RevenueCatWebhookValidator } from './revenuecat-webhook.validator';

describe('RevenueCatWebhookValidator', () => {
  const ORIGINAL_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.REVENUECAT_WEBHOOK_SECRET;
    } else {
      process.env.REVENUECAT_WEBHOOK_SECRET = ORIGINAL_SECRET;
    }
  });

  it('rejects when secret is not configured', () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const validator = new RevenueCatWebhookValidator();
    expect(validator.isAuthorized('Bearer whatever')).toBe(false);
  });

  it('accepts a matching shared secret', () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'shared-secret';
    const validator = new RevenueCatWebhookValidator();
    expect(validator.isAuthorized('shared-secret')).toBe(true);
  });

  it('accepts a Bearer prefixed shared secret', () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'shared-secret';
    const validator = new RevenueCatWebhookValidator();
    expect(validator.isAuthorized('Bearer shared-secret')).toBe(true);
  });

  it('rejects mismatched secrets', () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'shared-secret';
    const validator = new RevenueCatWebhookValidator();
    expect(validator.isAuthorized('wrong-secret')).toBe(false);
  });

  it('rejects when authorization header is missing', () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 'shared-secret';
    const validator = new RevenueCatWebhookValidator();
    expect(validator.isAuthorized(undefined)).toBe(false);
    expect(validator.isAuthorized(null)).toBe(false);
  });
});
