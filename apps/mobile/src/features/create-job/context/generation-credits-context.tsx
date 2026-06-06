import React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useBanyoneAuth } from "@/features/auth/auth-context";
import {
  fetchGenerationCredits,
  type GenerationCreditsSnapshot,
} from "@/features/create-job/services/generation-credits-api";

export type GenerationCreditsContextValue = {
  credits: GenerationCreditsSnapshot | null;
  isLoadingCredits: boolean;
  creditsError: string | null;
  refreshCredits: () => Promise<void>;
};

const GenerationCreditsContext =
  React.createContext<GenerationCreditsContextValue | null>(null);

export function GenerationCreditsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { getIdToken } = useBanyoneAuth();
  const [credits, setCredits] = React.useState<GenerationCreditsSnapshot | null>(
    null,
  );
  const [isLoadingCredits, setIsLoadingCredits] = React.useState(true);
  const [creditsError, setCreditsError] = React.useState<string | null>(null);

  const refreshCredits = React.useCallback(async () => {
    setIsLoadingCredits(true);
    try {
      const next = await fetchGenerationCredits(getIdToken);
      setCredits(next);
      setCreditsError(null);
    } catch {
      setCreditsError("Could not load credits");
    } finally {
      setIsLoadingCredits(false);
    }
  }, [getIdToken]);

  React.useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  React.useEffect(() => {
    const handleAppStateChange = (next: AppStateStatus) => {
      if (next === "active") {
        void refreshCredits();
      }
    };
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, [refreshCredits]);

  const value = React.useMemo(
    () => ({
      credits,
      isLoadingCredits,
      creditsError,
      refreshCredits,
    }),
    [credits, isLoadingCredits, creditsError, refreshCredits],
  );

  return (
    <GenerationCreditsContext.Provider value={value}>
      {children}
    </GenerationCreditsContext.Provider>
  );
}

export function useGenerationCredits(): GenerationCreditsContextValue {
  const ctx = React.useContext(GenerationCreditsContext);
  if (!ctx) {
    throw new Error(
      "useGenerationCredits must be used within GenerationCreditsProvider",
    );
  }
  return ctx;
}
