import { Global, Module } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';

import { getOrInitializeFirestore } from './firebase-admin-app';

export const FIRESTORE = Symbol('FIRESTORE');

@Global()
@Module({
  providers: [
    {
      provide: FIRESTORE,
      useFactory: (): Firestore => getOrInitializeFirestore(),
    },
  ],
  exports: [FIRESTORE],
})
export class FirestoreModule {}
