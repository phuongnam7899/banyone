import { JOB_POLICY_CODE_STORAGE_URI_BLOCKED } from '@banyone/contracts';

import type { CreateGenerationJobRequestBody } from '../jobs/dto/create-generation-job.request';
import { JobPolicyScreeningService } from './job-policy-screening.service';

describe('JobPolicyScreeningService', () => {
  const validBody = (): CreateGenerationJobRequestBody => ({
    video: {
      uri: 'file:///video.mp4',
      durationSec: 60,
      widthPx: 1920,
      heightPx: 1080,
      mimeType: 'video/mp4',
    },
    image: {
      uri: 'file:///image.jpg',
      widthPx: 2000,
      heightPx: 2000,
      mimeType: 'image/jpeg',
    },
  });

  const previousEnv = process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS;

  afterEach(() => {
    if (previousEnv === undefined) {
      delete process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS;
    } else {
      process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = previousEnv;
    }
  });

  it('allows when blocklist is empty or unset', () => {
    delete process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS;
    const svc = new JobPolicyScreeningService();
    expect(svc.evaluate({ userId: 'u1', body: validBody() }).decision).toBe(
      'allow',
    );

    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = '   ';
    expect(svc.evaluate({ userId: 'u1', body: validBody() }).decision).toBe(
      'allow',
    );
  });

  it('blocks when video uri matches a blocked substring (case-insensitive)', () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = 'MALICIOUS';
    const svc = new JobPolicyScreeningService();
    const body = validBody();
    body.video.uri = 'file:///path/Malicious/video.mp4';
    const r = svc.evaluate({ userId: 'u1', body });
    expect(r.decision).toBe('block');
    if (r.decision === 'block') {
      expect(r.policyCode).toBe(JOB_POLICY_CODE_STORAGE_URI_BLOCKED);
      expect(r.message).toContain('not allowed');
    }
  });

  it('blocks when image uri matches any of several comma-separated patterns', () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS =
      'bad-bucket, other-block';
    const svc = new JobPolicyScreeningService();
    const body = validBody();
    body.image.uri = 'file:///other-block/pic.jpg';
    expect(svc.evaluate({ userId: 'u1', body }).decision).toBe('block');
  });

  it('allows when uris do not contain blocked substrings', () => {
    process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS = 'nowhere';
    const svc = new JobPolicyScreeningService();
    expect(svc.evaluate({ userId: 'u1', body: validBody() }).decision).toBe(
      'allow',
    );
  });
});
