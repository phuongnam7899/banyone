import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';

import { FIRESTORE } from '../../infra/firestore.module';

const COLLECTION = 'revenuecat_processed_events';

export type ProcessedRevenueCatEventRecord = {
  eventId: string;
  eventType: string;
  productId: string | null;
  userId: string | null;
  grantedCredits: number;
  processedAtMs: number;
};

@Injectable()
export class RevenueCatEventDedupeStore {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  /**
   * Tries to persist a "processed" marker for the given event. Returns true if
   * we acquired the marker (caller should grant credits), or false if the event
   * was already processed previously.
   */
  async tryReserveEvent(eventId: string): Promise<boolean> {
    const docRef = this.firestore.collection(COLLECTION).doc(eventId);
    return this.firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(docRef);
      if (snapshot.exists) {
        return false;
      }
      tx.set(docRef, {
        eventId,
        reservedAtMs: Date.now(),
      });
      return true;
    });
  }

  async recordProcessed(record: ProcessedRevenueCatEventRecord): Promise<void> {
    await this.firestore.collection(COLLECTION).doc(record.eventId).set({
      eventId: record.eventId,
      eventType: record.eventType,
      productId: record.productId,
      userId: record.userId,
      grantedCredits: record.grantedCredits,
      processedAtMs: record.processedAtMs,
    });
  }

  async releaseReservation(eventId: string): Promise<void> {
    await this.firestore.collection(COLLECTION).doc(eventId).delete();
  }

  async listProcessedEventsForUser(
    userId: string,
    limit: number,
  ): Promise<ProcessedRevenueCatEventRecord[]> {
    const snapshot = await this.firestore
      .collection(COLLECTION)
      .where('userId', '==', userId)
      .orderBy('processedAtMs', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Partial<ProcessedRevenueCatEventRecord>;
      return {
        eventId: typeof data.eventId === 'string' ? data.eventId : doc.id,
        eventType: typeof data.eventType === 'string' ? data.eventType : 'UNKNOWN',
        productId: typeof data.productId === 'string' ? data.productId : null,
        userId: typeof data.userId === 'string' ? data.userId : null,
        grantedCredits:
          typeof data.grantedCredits === 'number' ? data.grantedCredits : 0,
        processedAtMs:
          typeof data.processedAtMs === 'number' ? data.processedAtMs : 0,
      };
    });
  }
}
