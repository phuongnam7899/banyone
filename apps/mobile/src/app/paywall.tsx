import React from "react";

import { PaywallScreen } from "@/features/billing/screens/paywall-screen";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function PaywallRoute(): React.ReactElement {
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  return <PaywallScreen colorScheme={colorScheme} />;
}
