import { Injectable } from '@nestjs/common';
import {
  JOB_POLICY_CODE_STORAGE_URI_BLOCKED,
  type JobPolicyCode,
} from '@banyone/contracts';

import type { CreateGenerationJobRequestBody } from '../jobs/dto/create-generation-job.request';

export type JobPolicyScreenResult =
  | { decision: 'allow' }
  | {
      decision: 'block';
      policyCode: JobPolicyCode;
      message: string;
    };

/**
 * Pre-acceptance policy screening on validated job payloads.
 *
 * Blocklist: comma-separated substrings in `BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS`
 * matched case-insensitively against video and image `uri` values.
 */
@Injectable()
export class JobPolicyScreeningService {
  evaluate(params: {
    userId: string;
    body: CreateGenerationJobRequestBody;
  }): JobPolicyScreenResult {
    void params.userId;
    const blocked = this.loadBlockedSubstrings();
    if (blocked.length === 0) {
      return { decision: 'allow' };
    }

    const uris = [
      (params.body.video.uri ?? '').trim(),
      (params.body.image.uri ?? '').trim(),
    ].filter((u) => u.length > 0);
    const lowerUris = uris.map((u) => u.toLowerCase());

    for (const sub of blocked) {
      const needle = sub.toLowerCase();
      for (const u of lowerUris) {
        if (u.includes(needle)) {
          return {
            decision: 'block',
            policyCode: JOB_POLICY_CODE_STORAGE_URI_BLOCKED,
            message:
              'This submission uses a storage location that is not allowed. Pick different media from your library.',
          };
        }
      }
    }

    return { decision: 'allow' };
  }

  private loadBlockedSubstrings(): string[] {
    const raw = process.env.BANYONE_POLICY_BLOCKED_URI_SUBSTRINGS ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
}
