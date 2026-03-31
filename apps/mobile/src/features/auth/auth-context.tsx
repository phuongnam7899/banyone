import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  type User,
} from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { getBanyoneFirebaseAuth } from "@/infra/firebase/firebase-client";

WebBrowser.maybeCompleteAuthSession();

export type BanyoneAuthContextValue = {
  isReady: boolean;
  isRestoringSession: boolean;
  uid: string | null;
  needsGoogleSignIn: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  triggerGoogleSignIn: () => Promise<void>;
  lastError: Error | null;
};

const BanyoneAuthContext = React.createContext<BanyoneAuthContextValue | null>(
  null,
);

const googlePromptRef: { current: (() => Promise<void>) | null } = {
  current: null,
};

function useGoogleSignInEnabled(): boolean {
  return (
    process.env.EXPO_PUBLIC_AUTH_STRATEGY === "google" &&
    typeof process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID === "string" &&
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.length > 0
  );
}

function SessionLoading() {
  return (
    <View style={styles.center} accessibilityLabel="Restoring session">
      <ActivityIndicator />
      <Text style={styles.hint}>Signing you in…</Text>
    </View>
  );
}

function GoogleAuthGate() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId:
      typeof iosClientId === "string" && iosClientId.length > 0
        ? iosClientId
        : undefined,
    androidClientId:
      typeof androidClientId === "string" && androidClientId.length > 0
        ? androidClientId
        : undefined,
  });

  const auth = getBanyoneFirebaseAuth();

  React.useEffect(() => {
    googlePromptRef.current = () =>
      promptAsync().then(() => undefined);
    return () => {
      googlePromptRef.current = null;
    };
  }, [promptAsync]);

  React.useEffect(() => {
    const run = async () => {
      if (response?.type !== "success" || !auth) return;
      const params = response.params as Record<string, string>;
      const idToken =
        response.authentication?.idToken ?? params.id_token;
      if (!idToken) return;
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    };
    void run();
  }, [response, auth]);

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Sign in to continue</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={!request}
        onPress={() => void promptAsync()}
        style={({ pressed }) => [
          styles.googleButton,
          pressed ? styles.googleButtonPressed : null,
          !request ? styles.googleButtonDisabled : null,
        ]}
      >
        <Text style={styles.googleButtonLabel}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

export function BanyoneAuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [isReady, setIsReady] = React.useState(false);
  const [isRestoringSession, setIsRestoringSession] = React.useState(true);
  const [uid, setUid] = React.useState<string | null>(null);
  const [lastError, setLastError] = React.useState<Error | null>(null);
  const [needsGoogleSignIn, setNeedsGoogleSignIn] = React.useState(false);

  const userRef = React.useRef<User | null>(null);
  const devTokenRef = React.useRef<string | null>(null);

  const googleEnabled = useGoogleSignInEnabled();
  const auth = getBanyoneFirebaseAuth();

  const getIdToken = React.useCallback(async (forceRefresh = false) => {
    if (devTokenRef.current) return devTokenRef.current;
    const u = userRef.current;
    if (!u) return null;
    return u.getIdToken(forceRefresh);
  }, []);

  const triggerGoogleSignIn = React.useCallback(async () => {
    await googlePromptRef.current?.();
  }, []);

  React.useEffect(() => {
    const devTokRaw = process.env.EXPO_PUBLIC_DEV_FIREBASE_ID_TOKEN;
    const devTok =
      typeof devTokRaw === "string" && devTokRaw.trim().length > 0
        ? devTokRaw.trim()
        : null;

    if (!auth) {
      devTokenRef.current = devTok;
      const devUidRaw = process.env.EXPO_PUBLIC_DEV_AUTH_UID;
      setUid(
        devTok
          ? typeof devUidRaw === "string" && devUidRaw.trim().length > 0
            ? devUidRaw.trim()
            : "dev-local-user"
          : null,
      );
      userRef.current = null;
      setNeedsGoogleSignIn(false);
      setIsRestoringSession(false);
      setIsReady(true);
      return;
    }

    devTokenRef.current = null;

    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        userRef.current = user;
        setUid(user?.uid ?? null);
        setLastError(null);
        if (user) {
          setNeedsGoogleSignIn(false);
          setIsRestoringSession(false);
          setIsReady(true);
          return;
        }

        if (googleEnabled) {
          setNeedsGoogleSignIn(true);
          setIsRestoringSession(false);
          setIsReady(true);
          return;
        }

        try {
          await signInAnonymously(auth);
        } catch (e) {
          setLastError(
            e instanceof Error ? e : new Error("Anonymous sign-in failed"),
          );
          setIsRestoringSession(false);
          setIsReady(true);
        }
      },
      (err) => {
        setLastError(err);
        setIsRestoringSession(false);
        setIsReady(true);
      },
    );

    return unsub;
  }, [auth, googleEnabled]);

  const value = React.useMemo(
    (): BanyoneAuthContextValue => ({
      isReady,
      isRestoringSession,
      uid,
      needsGoogleSignIn,
      getIdToken,
      triggerGoogleSignIn,
      lastError,
    }),
    [
      getIdToken,
      isReady,
      isRestoringSession,
      lastError,
      needsGoogleSignIn,
      triggerGoogleSignIn,
      uid,
    ],
  );

  if (!isReady || isRestoringSession) {
    return (
      <BanyoneAuthContext.Provider value={value}>
        <SessionLoading />
      </BanyoneAuthContext.Provider>
    );
  }

  if (auth && googleEnabled && needsGoogleSignIn) {
    return (
      <BanyoneAuthContext.Provider value={value}>
        <GoogleAuthGate />
      </BanyoneAuthContext.Provider>
    );
  }

  return (
    <BanyoneAuthContext.Provider value={value}>
      {children}
    </BanyoneAuthContext.Provider>
  );
}

export function useBanyoneAuth(): BanyoneAuthContextValue {
  const ctx = React.useContext(BanyoneAuthContext);
  if (!ctx) {
    throw new Error("useBanyoneAuth requires BanyoneAuthProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  googleButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#1a73e8",
  },
  googleButtonPressed: {
    opacity: 0.85,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
