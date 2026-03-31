import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function readFirebaseWebConfig(): FirebaseOptions | null {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

  if (
    typeof apiKey !== "string" ||
    apiKey.length === 0 ||
    typeof authDomain !== "string" ||
    authDomain.length === 0 ||
    typeof projectId !== "string" ||
    projectId.length === 0 ||
    typeof appId !== "string" ||
    appId.length === 0
  ) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

/** Returns Firebase Auth when env is configured; otherwise null (offline / tests). */
export function getBanyoneFirebaseAuth(): Auth | null {
  const cfg = readFirebaseWebConfig();
  if (!cfg) return null;

  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApps()[0]! : initializeApp(cfg);
  }
  if (!authInstance) {
    authInstance = getAuth(appInstance);
  }
  return authInstance;
}
