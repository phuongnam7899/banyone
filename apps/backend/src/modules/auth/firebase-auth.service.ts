import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';

export type VerifiedFirebaseUser = {
  uid: string;
};

const AUTH_VERIFIER_TEST = 'test';

function extractBearerToken(
  authorizationHeader: string | string[] | undefined,
): string | undefined {
  if (authorizationHeader === undefined) return undefined;
  const raw = Array.isArray(authorizationHeader)
    ? authorizationHeader[0]
    : authorizationHeader;
  if (typeof raw !== 'string') return undefined;
  const m = raw.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return m?.[1];
}

@Injectable()
export class FirebaseAuthService {
  private firebaseApp: admin.app.App | null = null;

  async verifyBearerAuthorizationHeader(
    authorizationHeader: string | string[] | undefined,
  ): Promise<VerifiedFirebaseUser> {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw Object.assign(new Error('Missing bearer token'), {
        code: 'UNAUTHENTICATED' as const,
      });
    }

    const verifierMode = process.env.BANYONE_AUTH_VERIFIER ?? 'firebase';

    if (verifierMode === AUTH_VERIFIER_TEST) {
      if (token === BANYONE_TEST_FIREBASE_ID_TOKEN) {
        return {
          uid: process.env.BANYONE_AUTH_TEST_UID ?? 'test-user-uid',
        };
      }
      if (token === 'test-valid-token-user-b') {
        return { uid: 'test-user-b' };
      }
      throw Object.assign(new Error('Invalid token (test verifier)'), {
        code: 'INVALID_ID_TOKEN' as const,
      });
    }

    try {
      this.ensureFirebaseAdminInitialized();
      const app = this.firebaseApp!;
      const decoded = await admin.auth(app).verifyIdToken(token);
      return { uid: decoded.uid };
    } catch {
      throw Object.assign(new Error('Invalid or expired ID token'), {
        code: 'INVALID_ID_TOKEN' as const,
      });
    }
  }

  private ensureFirebaseAdminInitialized(): void {
    if (this.firebaseApp) return;

    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json && json.trim().length > 0) {
      const creds = JSON.parse(json) as admin.ServiceAccount;
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(creds),
      });
      return;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      return;
    }

    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }
}
