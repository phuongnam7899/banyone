import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

import { BANYONE_TEST_FIREBASE_ID_TOKEN } from '@banyone/contracts';

import { getOrInitializeFirebaseAdminApp } from '../../infra/firebase-admin-app';

export type VerifiedFirebaseUser = {
  uid: string;
  isModerator: boolean;
  isSupport: boolean;
};

const AUTH_VERIFIER_TEST = 'test';
const TEST_MODERATOR_TOKEN = 'test-valid-token-moderator';
const TEST_SUPPORT_TOKEN = 'test-valid-token-support';

function parseModeratorUids(): Set<string> {
  const raw = process.env.BANYONE_MODERATOR_UIDS ?? '';
  const uids = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(uids);
}

function parseSupportUids(): Set<string> {
  const raw = process.env.BANYONE_SUPPORT_UIDS ?? '';
  const uids = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return new Set(uids);
}

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
      const moderatorUids = parseModeratorUids();
      const supportUids = parseSupportUids();
      if (token === BANYONE_TEST_FIREBASE_ID_TOKEN) {
        const uid = process.env.BANYONE_AUTH_TEST_UID ?? 'test-user-uid';
        return {
          uid,
          isModerator: moderatorUids.has(uid),
          isSupport: supportUids.has(uid),
        };
      }
      if (token === 'test-valid-token-user-b') {
        return {
          uid: 'test-user-b',
          isModerator: moderatorUids.has('test-user-b'),
          isSupport: supportUids.has('test-user-b'),
        };
      }
      if (token === TEST_MODERATOR_TOKEN) {
        const uid =
          process.env.BANYONE_AUTH_TEST_MODERATOR_UID ?? 'test-moderator-uid';
        return { uid, isModerator: true, isSupport: false };
      }
      if (token === TEST_SUPPORT_TOKEN) {
        const uid = process.env.BANYONE_AUTH_TEST_SUPPORT_UID ?? 'test-support-uid';
        return { uid, isModerator: false, isSupport: true };
      }
      throw Object.assign(new Error('Invalid token (test verifier)'), {
        code: 'INVALID_ID_TOKEN' as const,
      });
    }

    try {
      const app = getOrInitializeFirebaseAdminApp();
      const decoded = await admin.auth(app).verifyIdToken(token);
      const moderationClaim =
        typeof decoded.moderation === 'boolean' ? decoded.moderation : false;
      const supportClaim =
        typeof decoded.support === 'boolean' ? decoded.support : false;
      const supportUids = parseSupportUids();
      const isModerator =
        moderationClaim || parseModeratorUids().has(decoded.uid);
      const isSupport = supportClaim || supportUids.has(decoded.uid);
      return { uid: decoded.uid, isModerator, isSupport };
    } catch {
      throw Object.assign(new Error('Invalid or expired ID token'), {
        code: 'INVALID_ID_TOKEN' as const,
      });
    }
  }
}
