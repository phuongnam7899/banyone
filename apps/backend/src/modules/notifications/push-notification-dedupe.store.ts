import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';

import type { JobLifecycleNotificationKind } from '@banyone/contracts';

import { FIRESTORE } from '../../infra/firestore.module';

const KEY_SEP = '\u001f';

export function lifecyclePushDedupeKey(params: {
  userId: string;
  jobId: string;
  kind: JobLifecycleNotificationKind;
}): string {
  return `${params.userId}${KEY_SEP}${params.jobId}${KEY_SEP}${params.kind}`;
}

@Injectable()
export class PushNotificationDedupeStore {
  private readonly sentKeys = new Set<string>();
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  tryMarkSent(key: string): boolean {
    if (this.sentKeys.has(key)) return false;
    this.sentKeys.add(key);
    void this.firestore.collection('push_dedupe').doc(key).set({
      sentAt: new Date().toISOString(),
    });
    return true;
  }
}
