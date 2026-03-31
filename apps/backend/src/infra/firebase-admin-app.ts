import * as admin from 'firebase-admin';

/**
 * Single Firebase Admin app for auth verification and FCM.
 * Safe to call from multiple modules; initializes at most once per process.
 */
export function getOrInitializeFirebaseAdminApp(): admin.app.App {
  const existing = admin.apps[0];
  if (existing) return existing;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) {
    const creds = JSON.parse(json) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(creds),
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  throw new Error(
    'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.',
  );
}
