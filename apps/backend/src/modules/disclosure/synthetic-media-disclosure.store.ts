import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import type { SyntheticMediaDisclosureAcceptance } from '@banyone/contracts';
import { FIRESTORE } from '../../infra/firestore.module';

const CURRENT_DISCLOSURE_VERSION = 'v1';

@Injectable()
export class SyntheticMediaDisclosureStore {
  private readonly cache = new Map<string, SyntheticMediaDisclosureAcceptance>();
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  getCurrentVersion(): string {
    return CURRENT_DISCLOSURE_VERSION;
  }

  getAcceptanceForUser(userId: string): SyntheticMediaDisclosureAcceptance | null {
    const fromCache = this.cache.get(userId);
    return fromCache ?? null;
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
    this.cache.set(params.userId, recorded);
    void this.firestore
      .collection('disclosure_acceptance')
      .doc(params.userId)
      .set(recorded);
    return recorded;
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
