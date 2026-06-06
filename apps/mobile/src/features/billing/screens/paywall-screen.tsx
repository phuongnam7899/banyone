import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader, SectionCard } from "@/components/ui/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  Radius,
  Spacing,
} from "@/constants/theme";
import type { BanyoneBillingProductId } from "@/features/billing/constants/billing.constants";
import { useBilling } from "@/features/billing/hooks/use-billing";
import type { PaywallOutcome } from "@/features/billing/types/billing.types";
import { useGenerationCredits } from "@/features/create-job/hooks/use-generation-credits";

const SUBSCRIPTION_PLAN_SUMMARY = [
  { id: "weekly" as const, label: "Weekly", price: "$5", creditsPerPeriod: 7000 },
  { id: "monthly" as const, label: "Monthly", price: "$20", creditsPerPeriod: 30000 },
  { id: "yearly" as const, label: "Yearly", price: "$240", creditsPerPeriod: 365000 },
];

function formatCredits(credits: number): string {
  return new Intl.NumberFormat("en-US").format(credits);
}

function formatDateDdMmYyyy(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

type Props = {
  colorScheme: "light" | "dark";
};

export function PaywallScreen({ colorScheme }: Props): React.ReactElement {
  const colors = Colors[colorScheme];
  const router = useRouter();
  const billing = useBilling();
  const { refreshCredits } = useGenerationCredits();
  const [lastOutcomeMessage, setLastOutcomeMessage] = React.useState<string | null>(
    null,
  );
  const [isManagingSubscription, setIsManagingSubscription] = React.useState(false);
  const [isRetryingBilling, setIsRetryingBilling] = React.useState(false);
  const isManagingSubscriptionRef = React.useRef(false);
  const isRetryingBillingRef = React.useRef(false);

  const handleClose = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/create-job");
  }, [router]);

  const applyPurchaseOutcome = React.useCallback(
    async (outcome: PaywallOutcome) => {
      if (outcome.status === "purchased") {
        setLastOutcomeMessage("Subscription active. Updating credits…");
        try {
          await refreshCredits();
          setLastOutcomeMessage("Subscription active. Credits updated.");
        } catch {
          setLastOutcomeMessage(
            "Subscription active, but credits refresh failed. Please retry.",
          );
        }
        return;
      }
      if (outcome.status === "restored") {
        setLastOutcomeMessage("Previous purchase restored. Updating credits…");
        try {
          await refreshCredits();
          setLastOutcomeMessage("Previous purchase restored.");
        } catch {
          setLastOutcomeMessage(
            "Purchase restored, but credits refresh failed. Please retry.",
          );
        }
        return;
      }
      if (outcome.status === "cancelled") {
        setLastOutcomeMessage("Purchase cancelled.");
        return;
      }
      if (outcome.status === "not-presented") {
        setLastOutcomeMessage("You already have an active subscription.");
        return;
      }
      if (outcome.status === "error") {
        setLastOutcomeMessage(outcome.message);
      }
    },
    [refreshCredits],
  );

  const handlePresentPaywall = React.useCallback(async () => {
    setLastOutcomeMessage(null);
    try {
      const outcome = await billing.presentPaywall();
      await applyPurchaseOutcome(outcome);
    } catch {
      setLastOutcomeMessage(
        "Unable to open subscription options. Please retry shortly.",
      );
    }
  }, [billing, applyPurchaseOutcome]);

  const handlePurchasePlan = React.useCallback(
    async (productId: BanyoneBillingProductId) => {
      setLastOutcomeMessage(null);
      try {
        const outcome = await billing.purchaseSubscription(productId);
        await applyPurchaseOutcome(outcome);
      } catch {
        setLastOutcomeMessage("Unable to start purchase. Please try again.");
      }
    },
    [billing, applyPurchaseOutcome],
  );

  const handleOpenCustomerCenter = React.useCallback(async () => {
    if (isManagingSubscriptionRef.current) return;
    isManagingSubscriptionRef.current = true;
    setIsManagingSubscription(true);
    try {
      const result = await billing.openCustomerCenterIfAvailable();
      if (!result.supported) {
        setLastOutcomeMessage(
          "Manage your subscription from the App Store or Google Play settings.",
        );
      }
    } catch {
      setLastOutcomeMessage(
        "Unable to open subscription management. Please try again.",
      );
    } finally {
      isManagingSubscriptionRef.current = false;
      setIsManagingSubscription(false);
    }
  }, [billing]);

  const handleRetryBilling = React.useCallback(async () => {
    if (isRetryingBillingRef.current) return;
    isRetryingBillingRef.current = true;
    setIsRetryingBilling(true);
    setLastOutcomeMessage(null);
    try {
      await billing.refreshCustomerInfo();
      await refreshCredits();
      setLastOutcomeMessage("Billing connection refreshed.");
    } catch {
      setLastOutcomeMessage(
        "Unable to refresh billing right now. Please retry in a moment.",
      );
    } finally {
      isRetryingBillingRef.current = false;
      setIsRetryingBilling(false);
    }
  }, [billing, refreshCredits]);

  const showInitialLoader = billing.isInitializing && !billing.isConfigured;
  const activePlan =
    SUBSCRIPTION_PLAN_SUMMARY.find((plan) => plan.id === billing.activeProductId) ?? null;
  const activePlanLabel = activePlan?.label ?? "Banyone Pro";
  const renewalCredits = billing.activePlanCreditsPerPeriod ?? activePlan?.creditsPerPeriod ?? null;
  const renewalDate = billing.nextRenewalAt
    ? formatDateDdMmYyyy(billing.nextRenewalAt)
    : null;
  const renewalMessage =
    renewalCredits && renewalDate
      ? `${formatCredits(renewalCredits)} credits will be added on ${renewalDate}`
      : "Your credits will be added at the next billing period.";

  return (
    <ThemedView style={styles.container} testID="paywall.screen">
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.headerSticky}>
          <ScreenHeader
            title="Add credits"
            subtitle="Subscribe to top up your generation credits."
            rightSlot={
              <Pressable
                testID="paywall.close-button"
                accessibilityRole="button"
                accessibilityLabel="Close paywall"
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    borderColor: colors.borderMuted,
                    backgroundColor: pressed
                      ? colors.backgroundSelected
                      : colors.backgroundElementMuted,
                  },
                ]}
              >
                <ThemedText type="smallBold" style={{ color: colors.text }}>
                  Close
                </ThemedText>
              </Pressable>
            }
          />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BottomTabInset + Spacing.four },
          ]}
        >
          {billing.isPro ? (
            <SectionCard testID="paywall.current-plan-card">
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Current plan
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: colors.text }}>
                {activePlanLabel}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {renewalMessage}
              </ThemedText>
            </SectionCard>
          ) : (
            <SectionCard testID="paywall.plans-card">
              <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
                Banyone Pro plans
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Each renewal automatically tops up your generation credits. Tap a
                plan to buy with the store, or use the button for RevenueCat’s
                paywall when one is attached in the dashboard.
              </ThemedText>
              {SUBSCRIPTION_PLAN_SUMMARY.map((plan) => {
                const rowDisabled =
                  billing.isInitializing ||
                  billing.isPurchaseInFlight ||
                  !billing.isConfigured;
                return (
                  <Pressable
                    key={plan.id}
                    testID={`paywall.plan.${plan.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Subscribe ${plan.label}`}
                    disabled={rowDisabled}
                    onPress={() => {
                      void handlePurchasePlan(plan.id);
                    }}
                    style={({ pressed }) => [
                      styles.planRow,
                      {
                        borderColor: colors.borderMuted,
                        backgroundColor: colors.backgroundElementMuted,
                        opacity: rowDisabled ? 0.55 : pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View style={styles.planRowText}>
                      <ThemedText type="smallBold" style={{ color: colors.text }}>
                        {plan.label}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: colors.textSecondary }}
                      >
                        {plan.price} · {formatCredits(plan.creditsPerPeriod)} credits
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: colors.primary }}>
                      Subscribe
                    </ThemedText>
                  </Pressable>
                );
              })}
            </SectionCard>
          )}

          {showInitialLoader ? (
            <View
              testID="paywall.initializing"
              style={styles.statusRow}
              accessibilityRole="text"
            >
              <ActivityIndicator color={colors.primary} />
              <ThemedText
                type="small"
                style={{ color: colors.textSecondary }}
              >
                Loading subscription options…
              </ThemedText>
            </View>
          ) : null}

          {billing.isPro ? (
            <Pressable
              testID="paywall.change-plan-button"
              accessibilityRole="button"
              accessibilityLabel="Change plan"
              onPress={() => {
                void handleOpenCustomerCenter();
              }}
              disabled={isManagingSubscription}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity: isManagingSubscription ? 0.6 : pressed ? 0.85 : 1,
                  borderColor: colors.primary,
                },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
                Change plan
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              testID="paywall.present-button"
              accessibilityRole="button"
              accessibilityLabel="View subscription options"
              disabled={
                billing.isInitializing ||
                billing.isPurchaseInFlight ||
                !billing.isConfigured
              }
              onPress={() => {
                void handlePresentPaywall();
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    billing.isInitializing ||
                    billing.isPurchaseInFlight ||
                    !billing.isConfigured
                      ? 0.6
                      : pressed
                        ? 0.85
                        : 1,
                  borderColor: colors.primary,
                },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
                {billing.isPurchaseInFlight ? "Opening…" : "View subscription options"}
              </ThemedText>
            </Pressable>
          )}

          {billing.isPro ? (
            <Pressable
              testID="paywall.cancel-subscription-button"
              accessibilityRole="button"
              accessibilityLabel="Cancel subscription"
              onPress={() => {
                void handleOpenCustomerCenter();
              }}
              disabled={isManagingSubscription}
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: pressed
                    ? colors.backgroundSelected
                    : colors.backgroundElementMuted,
                  opacity: isManagingSubscription ? 0.6 : 1,
                },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: colors.primary }}>
                Cancel subscription
              </ThemedText>
            </Pressable>
          ) : null}

          {lastOutcomeMessage ? (
            <View
              testID="paywall.outcome-message"
              accessibilityRole="alert"
              style={[
                styles.outcomeBanner,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.backgroundElementMuted,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                {lastOutcomeMessage}
              </ThemedText>
            </View>
          ) : null}

          {billing.errorMessage ? (
            <View
              testID="paywall.error-banner"
              accessibilityRole="alert"
              style={[
                styles.outcomeBanner,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                {billing.errorMessage}
              </ThemedText>
              <Pressable
                testID="paywall.error-retry-button"
                accessibilityRole="button"
                accessibilityLabel="Retry billing initialization"
                disabled={isRetryingBilling}
                onPress={() => {
                  void handleRetryBilling();
                }}
                style={styles.retryRow}
              >
                <ThemedText type="smallBold" style={{ color: colors.primary }}>
                  {isRetryingBilling ? "Retrying…" : "Retry"}
                </ThemedText>
              </Pressable>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                You can close this screen and keep using the app while billing
                reconnects.
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  headerSticky: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  planRowText: {
    flex: 1,
    gap: Spacing.half,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  primaryButton: {
    alignSelf: "stretch",
    borderWidth: 0,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButton: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeBanner: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  retryRow: {
    alignSelf: "flex-start",
  },
});
