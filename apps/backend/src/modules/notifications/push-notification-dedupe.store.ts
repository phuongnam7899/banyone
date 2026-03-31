import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';

import type { JobLifecycleNotificationKind } from '@banyone/contracts';

type PersistedDedupeStore = {
  version: 1;
  /** `${userId}\u001f${jobId}\u001f${kind}` */
  sentKeys: Record<string, true>;
};

const KEY_SEP = '\u001f';

export function lifecyclePushDedupeKey(params: {
  userId: string;
  jobId: string;
  kind: JobLifecycleNotificationKind;
}): string {
  return `${params.userId}${KEY_SEP}${params.jobId}${KEY_SEP}${params.kind}`;
}

export class PushNotificationDedupeStore {
  private readonly storeDir: string;
  private readonly storeFilePath: string;
  private store: PersistedDedupeStore;

  constructor() {
    const configuredDir = process.env.BANYONE_NOTIFICATIONS_DATA_DIR;
    this.storeDir =
      configuredDir ?? path.join(process.cwd(), '.banyone-notifications-data');
    this.storeFilePath = path.join(this.storeDir, 'push-lifecycle-dedupe.json');
    mkdirSync(this.storeDir, { recursive: true });
    this.store = this.loadStore();
  }

  private loadStore(): PersistedDedupeStore {
    if (!existsSync(this.storeFilePath)) {
      return { version: 1, sentKeys: {} };
    }
    try {
      const raw = readFileSync(this.storeFilePath, { encoding: 'utf-8' });
      const parsed = JSON.parse(raw) as unknown;
      return this.normalize(parsed);
    } catch {
      return { version: 1, sentKeys: {} };
    }
  }

  private normalize(parsed: unknown): PersistedDedupeStore {
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('sentKeys' in parsed)
    ) {
      return { version: 1, sentKeys: {} };
    }
    const o = parsed as { sentKeys?: unknown };
    if (typeof o.sentKeys !== 'object' || o.sentKeys === null) {
      return { version: 1, sentKeys: {} };
    }
    const sentKeys: Record<string, true> = {};
    for (const k of Object.keys(o.sentKeys)) {
      if (typeof k === 'string' && k.length > 0) sentKeys[k] = true;
    }
    return { version: 1, sentKeys };
  }

  private saveStore(): void {
    writeFileSync(
      this.storeFilePath,
      `${JSON.stringify(this.store, null, 2)}\n`,
      { encoding: 'utf-8' },
    );
  }

  tryMarkSent(key: string): boolean {
    if (this.store.sentKeys[key]) return false;
    this.store.sentKeys[key] = true;
    this.saveStore();
    return true;
  }
}
