import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import type { SyntheticMediaDisclosureAcceptance } from '@banyone/contracts';

type PersistedDisclosureStore = {
  version: 1;
  acceptanceByUserId: Record<string, SyntheticMediaDisclosureAcceptance>;
};

const CURRENT_DISCLOSURE_VERSION = 'v1';

export class SyntheticMediaDisclosureStore {
  private readonly storeDir: string;
  private readonly storeFilePath: string;
  private store: PersistedDisclosureStore;

  constructor() {
    const configuredDir = process.env.BANYONE_DISCLOSURE_DATA_DIR;
    this.storeDir = configuredDir ?? path.join(process.cwd(), '.banyone-disclosure-data');
    this.storeFilePath = path.join(this.storeDir, 'synthetic-media-disclosure.json');
    mkdirSync(this.storeDir, { recursive: true });
    this.store = this.loadStore();
  }

  getCurrentVersion(): string {
    return CURRENT_DISCLOSURE_VERSION;
  }

  getAcceptanceForUser(userId: string): SyntheticMediaDisclosureAcceptance | null {
    const accepted = this.store.acceptanceByUserId[userId];
    return accepted ?? null;
  }

  isAcceptedForUser(userId: string): boolean {
    const accepted = this.getAcceptanceForUser(userId);
    return accepted?.version === CURRENT_DISCLOSURE_VERSION;
  }

  recordAcceptanceForUser(params: {
    userId: string;
    version: string;
  }): SyntheticMediaDisclosureAcceptance {
    const recorded: SyntheticMediaDisclosureAcceptance = {
      acceptedAt: new Date().toISOString(),
      version: params.version.trim(),
    };
    this.store.acceptanceByUserId[params.userId] = recorded;
    this.saveStore();
    return recorded;
  }

  private loadStore(): PersistedDisclosureStore {
    if (!existsSync(this.storeFilePath)) {
      return { version: 1, acceptanceByUserId: {} };
    }
    try {
      const raw = readFileSync(this.storeFilePath, { encoding: 'utf-8' });
      const parsed = JSON.parse(raw) as unknown;
      return this.normalizeStore(parsed);
    } catch {
      return { version: 1, acceptanceByUserId: {} };
    }
  }

  private normalizeStore(value: unknown): PersistedDisclosureStore {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('acceptanceByUserId' in value)
    ) {
      return { version: 1, acceptanceByUserId: {} };
    }
    const source = (value as { acceptanceByUserId?: unknown }).acceptanceByUserId;
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      return { version: 1, acceptanceByUserId: {} };
    }

    const acceptanceByUserId: Record<string, SyntheticMediaDisclosureAcceptance> = {};
    for (const [userId, rawAcceptance] of Object.entries(source)) {
      const parsed = tryParseAcceptance(rawAcceptance);
      if (parsed) acceptanceByUserId[userId] = parsed;
    }
    return { version: 1, acceptanceByUserId };
  }

  private saveStore(): void {
    writeFileSync(this.storeFilePath, `${JSON.stringify(this.store, null, 2)}\n`, {
      encoding: 'utf-8',
    });
  }
}

function tryParseAcceptance(
  value: unknown,
): SyntheticMediaDisclosureAcceptance | null {
  if (typeof value !== 'object' || value === null) return null;
  const acceptedAt = (value as { acceptedAt?: unknown }).acceptedAt;
  const version = (value as { version?: unknown }).version;
  if (
    typeof acceptedAt !== 'string' ||
    acceptedAt.trim().length === 0 ||
    typeof version !== 'string' ||
    version.trim().length === 0
  ) {
    return null;
  }
  return { acceptedAt: acceptedAt.trim(), version: version.trim() };
}
