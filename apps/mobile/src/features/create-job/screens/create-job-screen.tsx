import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  FormSection,
  ScreenHeader,
  SectionCard,
} from "@/components/ui/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  Radius,
  Spacing,
} from "@/constants/theme";
import { MediaSlotPicker } from "@/features/create-job/components/media-slot-picker";
import { useJobInputSelection } from "@/features/create-job/hooks/use-job-input-selection";
import { useGenerationCredits } from "@/features/create-job/hooks/use-generation-credits";
import { useJobSubmission } from "@/features/create-job/hooks/use-job-submission";
import { JobStatusTimeline } from "@/features/job-status/components/job-status-timeline";
import { useJobStatusPolling } from "@/features/job-status/hooks/use-job-status-polling";
import { ReadyResultScreen } from "@/features/preview-export/screens/ready-result-screen";
import {
  DEFAULT_QUALITY_TIER,
  validateJobInputCompliance,
} from "@banyone/contracts";

type Props = {
  colorScheme: "light" | "dark";
};

export function CreateJobScreen({ colorScheme }: Props) {
  const colors = Colors[colorScheme];
  const router = useRouter();
  const scrollViewRef = React.useRef<ScrollView | null>(null);
  const hasAutoScrolledToStatusRef = React.useRef(false);
  const {
    state,
    pickVideo,
    pickImage,
    clearVideo,
    clearImage,
    isRestoringDraft,
    draftRestoreNotice,
    dismissDraftNotice,
    pendingIdempotencyKey,
    setPendingIdempotencyKey,
    clearPersistedDraftAfterAcceptedJob,
  } = useJobInputSelection();

  const createGenerationJobBody = React.useMemo(
    () => ({
      qualityTier: DEFAULT_QUALITY_TIER,
      video: {
        uri: state.videoUri,
        durationSec: state.videoDurationSec,
        widthPx: state.videoWidthPx,
        heightPx: state.videoHeightPx,
        mimeType: state.videoMimeType,
      },
      image: {
        uri: state.imageUri,
        widthPx: state.imageWidthPx,
        heightPx: state.imageHeightPx,
        mimeType: state.imageMimeType,
      },
    }),
    [
      state.videoUri,
      state.videoDurationSec,
      state.videoWidthPx,
      state.videoHeightPx,
      state.videoMimeType,
      state.imageUri,
      state.imageWidthPx,
      state.imageHeightPx,
      state.imageMimeType,
    ],
  );

  const jobSubmissionOptions = React.useMemo(
    () => ({
      initialIdempotencyKey: pendingIdempotencyKey,
      onPendingIdempotencyKeyChange: setPendingIdempotencyKey,
    }),
    [pendingIdempotencyKey, setPendingIdempotencyKey],
  );

  const { isSubmittingJob, ack, submit, acknowledgeDisclosure } =
    useJobSubmission(createGenerationJobBody, jobSubmissionOptions);
  const { credits, isLoadingCredits, creditsError } = useGenerationCredits();
  const [isAcknowledgingDisclosure, setIsAcknowledgingDisclosure] =
    React.useState(false);
  const handledDisclosureTraceRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (ack?.type === "accepted") {
      void clearPersistedDraftAfterAcceptedJob();
    }
  }, [ack, clearPersistedDraftAfterAcceptedJob]);

  React.useEffect(() => {
    if (ack?.type !== "disclosure-required") return;
    if (handledDisclosureTraceRef.current === ack.traceId) return;
    handledDisclosureTraceRef.current = ack.traceId;
    let cancelled = false;
    void (async () => {
      setIsAcknowledgingDisclosure(true);
      const acknowledged = await acknowledgeDisclosure(ack.currentVersion);
      if (!cancelled) {
        setIsAcknowledgingDisclosure(false);
        if (acknowledged) {
          await submit();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ack, acknowledgeDisclosure, submit]);

  React.useEffect(() => {
    if (ack?.type !== "disclosure-required") {
      handledDisclosureTraceRef.current = null;
    }
  }, [ack]);

  const validation = React.useMemo(() => {
    return validateJobInputCompliance({
      video: {
        uri: state.videoUri,
        durationSec: state.videoDurationSec,
        widthPx: state.videoWidthPx,
        heightPx: state.videoHeightPx,
        mimeType: state.videoMimeType,
      },
      image: {
        uri: state.imageUri,
        widthPx: state.imageWidthPx,
        heightPx: state.imageHeightPx,
        mimeType: state.imageMimeType,
      },
    });
  }, [
    state.videoUri,
    state.videoDurationSec,
    state.videoWidthPx,
    state.videoHeightPx,
    state.videoMimeType,
    state.imageUri,
    state.imageWidthPx,
    state.imageHeightPx,
    state.imageMimeType,
  ]);

  const acceptedJobId = ack?.type === "accepted" ? ack.jobId : null;
  const initialJobStatus =
    acceptedJobId && ack?.type === "accepted"
      ? {
          jobId: ack.jobId,
          status: ack.status,
          updatedAt: new Date().toISOString(),
        }
      : null;

  const { status: polledJobStatus, isRefreshingStatus } = useJobStatusPolling(
    acceptedJobId,
    initialJobStatus,
  );
  const shouldShowStatusTimeline = isSubmittingJob || ack?.type === "accepted";
  const timelineJobId = acceptedJobId ?? "pending";
  const timelineStatus = polledJobStatus?.status ?? "queued";
  const timelineEtaSeconds = polledJobStatus?.etaSeconds;
  const timelineFailure = polledJobStatus?.failure;
  const videoCreditPerSecond = credits?.videoCreditPerSecond ?? null;
  const creditsNeeded = React.useMemo(() => {
    if (videoCreditPerSecond == null || state.videoDurationSec == null) return null;
    if (!Number.isFinite(state.videoDurationSec) || state.videoDurationSec <= 0)
      return null;
    return Math.ceil(state.videoDurationSec * videoCreditPerSecond);
  }, [state.videoDurationSec, videoCreditPerSecond]);
  const generateButtonLabel = isRestoringDraft
    ? "Loading draft…"
    : isSubmittingJob
      ? "Submitting…"
      : isAcknowledgingDisclosure
        ? "Acknowledging…"
        : creditsNeeded != null
          ? `Generate (${creditsNeeded.toLocaleString()} credits)`
          : "Generate";
  const creditBadgeText = isLoadingCredits
    ? "Credits: …"
    : credits
      ? `Credits: ${credits.balance.toLocaleString()}`
      : "Credits: —";
  const creditRateText =
    videoCreditPerSecond != null
      ? `Rate: ${videoCreditPerSecond.toLocaleString()} credits/sec`
      : "Rate: —";

  React.useEffect(() => {
    if (!shouldShowStatusTimeline) {
      hasAutoScrolledToStatusRef.current = false;
    }
  }, [shouldShowStatusTimeline]);

  return (
    <ThemedView style={styles.container} testID="create-job.screen">
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.headerSticky}>
          <ScreenHeader
            title="Create"
            subtitle=""
            rightSlot={
              <View style={styles.creditsRightSlot}>
                <View
                  testID="create-job.credits.badge"
                  style={[
                    styles.creditBadge,
                    {
                      borderColor: colors.borderMuted,
                      backgroundColor: colors.backgroundElementMuted,
                    },
                  ]}
                >
                  <ThemedText type="small" style={{ color: colors.text }}>
                    {creditBadgeText}
                  </ThemedText>
                  <ThemedText
                    testID="create-job.credits.rate"
                    type="small"
                    style={{ color: colors.textSecondary }}
                  >
                    {creditRateText}
                  </ThemedText>
                </View>
                <Pressable
                  testID="create-job.credits.add-button"
                  accessibilityRole="button"
                  accessibilityLabel="Add credits"
                  onPress={() => {
                    router.push("/paywall");
                  }}
                  style={({ pressed }) => [
                    styles.addCreditsButton,
                    {
                      borderColor: colors.borderMuted,
                      backgroundColor: pressed
                        ? colors.backgroundSelected
                        : colors.backgroundElementMuted,
                    },
                  ]}
                >
                  <ThemedText
                    type="smallBold"
                    style={[styles.addCreditsButtonLabel, { color: colors.primary }]}
                  >
                    +
                  </ThemedText>
                </Pressable>
              </View>
            }
          />
        </View>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BottomTabInset + Spacing.four },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {isRestoringDraft ? (
            <View
              testID="create-job.draft-restoring.banner"
              accessibilityRole="text"
              style={[
                styles.draftBanner,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.backgroundElementMuted,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Restoring your draft…
              </ThemedText>
            </View>
          ) : null}

          {!isRestoringDraft && draftRestoreNotice === "restored" ? (
            <View
              testID="create-job.draft-restored.banner"
              accessibilityRole="text"
              style={[
                styles.draftBanner,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.infoSurface,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                Draft restored — your previous selections were kept.
              </ThemedText>
              <Pressable
                testID="create-job.draft-restored.dismiss"
                accessibilityRole="button"
                accessibilityLabel="Dismiss draft restored message"
                onPress={dismissDraftNotice}
                style={styles.draftDismiss}
              >
                <ThemedText type="small" style={{ color: colors.primary }}>
                  Dismiss
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {!isRestoringDraft && draftRestoreNotice === "corrupted" ? (
            <View
              testID="create-job.draft-corrupted.banner"
              accessibilityRole="text"
              style={[
                styles.draftBanner,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                Your saved draft could not be loaded (files missing). Please
                pick media again.
              </ThemedText>
              <Pressable
                testID="create-job.draft-corrupted.dismiss"
                accessibilityRole="button"
                accessibilityLabel="Dismiss draft error message"
                onPress={dismissDraftNotice}
                style={styles.draftDismiss}
              >
                <ThemedText type="small" style={{ color: colors.primary }}>
                  OK
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {/* <ConstraintGuidance colorScheme={colorScheme} /> */}

          <FormSection label="">
            <MediaSlotPicker
              variant="video"
              colorScheme={colorScheme}
              label="Source video"
              helper="The character in this video will be swapped"
              uri={state.videoUri}
              videoDurationSec={state.videoDurationSec}
              displayName={state.videoLabel}
              testID="create-job.upload-video.button"
              accessibilityLabel="Choose source video from library"
              onPress={pickVideo}
              onClear={clearVideo}
              validationResult={validation.video}
            />

            <MediaSlotPicker
              variant="image"
              colorScheme={colorScheme}
              label="Reference character image"
              helper="The character in this image will be swapped with the character in the source video"
              uri={state.imageUri}
              displayName={state.imageLabel}
              testID="create-job.upload-image.button"
              accessibilityLabel="Choose reference image from library"
              onPress={pickImage}
              onClear={clearImage}
              validationResult={validation.image}
            />
          </FormSection>

          <Pressable
            testID="create-job.submit.button"
            accessibilityRole="button"
            accessibilityLabel="Generate"
            disabled={
              isSubmittingJob || isRestoringDraft || isAcknowledgingDisclosure
            }
            onPress={() => {
              void submit();
            }}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity:
                  isSubmittingJob ||
                  isRestoringDraft ||
                  isAcknowledgingDisclosure
                    ? 0.6
                    : pressed
                      ? 0.85
                      : 1,
                borderColor: colors.primary,
              },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: colors.onPrimary }}>
              {generateButtonLabel}
            </ThemedText>
          </Pressable>

          {creditsError ? (
            <View
              testID="create-job.credits.error"
              style={[
                styles.ackRateLimited,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
              accessibilityRole="alert"
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                {creditsError}
              </ThemedText>
            </View>
          ) : null}

          {shouldShowStatusTimeline ? (
            <View
              style={styles.acceptedStack}
              onLayout={(event) => {
                if (hasAutoScrolledToStatusRef.current) return;
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, event.nativeEvent.layout.y - Spacing.three),
                  animated: true,
                });
                hasAutoScrolledToStatusRef.current = true;
              }}
            >
              <SectionCard>
                <JobStatusTimeline
                  jobId={timelineJobId}
                  status={timelineStatus}
                  etaSeconds={timelineEtaSeconds}
                  failure={timelineFailure}
                />
                {polledJobStatus?.status === "ready" ? (
                  <ReadyResultScreen
                    jobStatus={polledJobStatus}
                    colorScheme={colorScheme}
                    embedded
                  />
                ) : null}
              </SectionCard>

              {polledJobStatus?.status === "failed" &&
              polledJobStatus.failure?.retryable ? (
                <Pressable
                  testID="job-status.retry.button"
                  accessibilityRole="button"
                  accessibilityLabel="Retry job"
                  onPress={() => {
                    void submit();
                  }}
                  disabled={isSubmittingJob || isRefreshingStatus}
                  style={({ pressed }) => [
                    styles.retryButton,
                    {
                      backgroundColor: colors.primary,
                      opacity:
                        isSubmittingJob || isRefreshingStatus
                          ? 0.6
                          : pressed
                            ? 0.85
                            : 1,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <ThemedText type="small" style={{ color: colors.onPrimary }}>
                    {isRefreshingStatus ? "Refreshing…" : "Retry"}
                  </ThemedText>
                </Pressable>
              ) : null}

              {polledJobStatus?.status === "failed" &&
              polledJobStatus.failure &&
              !polledJobStatus.failure.retryable ? (
                <View style={{ marginTop: 0 }}>
                  <ThemedText type="small" style={{ color: colors.text }}>
                    Failed. This error cannot be retried.
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: colors.textSecondary }}
                  >
                    Reason: {polledJobStatus.failure.reasonCode}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {ack?.type === "rate-limited" ? (
            <View
              testID="create-job.submit.ack.rate-limited"
              style={[
                styles.ackRateLimited,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.backgroundElementMuted,
                },
              ]}
              accessibilityRole="alert"
              accessibilityLabel="Rate limited"
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                Temporarily limited
              </ThemedText>
              <ThemedText
                testID="create-job.submit.ack.rate-limited.message"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                {ack.message}
                {ack.retryAfterSec != null
                  ? ` You can try again in about ${ack.retryAfterSec} seconds.`
                  : ""}
              </ThemedText>
            </View>
          ) : null}

          {ack?.type === "policy-blocked" ? (
            <View
              testID="create-job.policy-blocked.container"
              style={[
                styles.ackPolicyBlocked,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
              accessibilityRole="alert"
              accessibilityLabel="Submission blocked by policy"
            >
              <ThemedText
                testID="create-job.policy-blocked.title"
                type="small"
                style={{ color: colors.text }}
              >
                Cannot submit this media
              </ThemedText>
              <ThemedText
                testID="create-job.policy-blocked.message"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                {ack.message}
              </ThemedText>
              <ThemedText
                testID="create-job.policy-blocked.guidance"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                {ack.guidance}
              </ThemedText>
              <ThemedText
                testID="create-job.policy-blocked.trace"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                Trace ID: {ack.traceId || "—"}
              </ThemedText>
              <ThemedText
                testID="create-job.policy-blocked.code"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                Policy code: {ack.policyCode}
              </ThemedText>
            </View>
          ) : null}

          {ack?.type === "abuse-restricted" ? (
            <View
              testID="create-job.abuse-restricted.container"
              style={[
                styles.ackPolicyBlocked,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
              accessibilityRole="alert"
              accessibilityLabel="Submission blocked by abuse restriction"
            >
              <ThemedText
                testID="create-job.abuse-restricted.title"
                type="small"
                style={{ color: colors.text }}
              >
                Submission temporarily unavailable
              </ThemedText>
              <ThemedText
                testID="create-job.abuse-restricted.message"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                {ack.message}
              </ThemedText>
              <ThemedText
                testID="create-job.abuse-restricted.guidance"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                If you believe this is a mistake, contact support and include
                the trace ID.
              </ThemedText>
              <ThemedText
                testID="create-job.abuse-restricted.trace"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}
              >
                Trace ID: {ack.traceId || "—"}
              </ThemedText>
            </View>
          ) : null}

          {ack?.type === "insufficient-credit" ? (
            <View
              testID="create-job.insufficient-credit.container"
              style={[
                styles.ackPolicyBlocked,
                {
                  borderColor: colors.warningIcon,
                  backgroundColor: colors.dangerSurface,
                },
              ]}
              accessibilityRole="alert"
              accessibilityLabel="Insufficient credits"
            >
              <ThemedText
                testID="create-job.insufficient-credit.title"
                type="small"
                style={{ color: colors.text }}
              >
                Not enough credits
              </ThemedText>
              <ThemedText
                testID="create-job.insufficient-credit.message"
                type="small"
                style={{ color: colors.textSecondary }}
              >
                {ack.message}
              </ThemedText>
              <ThemedText
                testID="create-job.insufficient-credit.details"
                type="small"
                style={{ color: colors.textSecondary }}
              >
                Current: {ack.balance.toLocaleString()} | Required:{" "}
                {ack.required.toLocaleString()} | Missing:{" "}
                {ack.shortfall.toLocaleString()}
              </ThemedText>
              <ThemedText
                testID="create-job.insufficient-credit.rate"
                type="small"
                style={{ color: colors.textSecondary }}
              >
                Cost rate: {ack.videoCreditPerSecond.toLocaleString()} credits/sec
              </ThemedText>
            </View>
          ) : null}

          {ack?.type === "rejected" ? (
            <View
              testID="create-job.submit.ack.rejected"
              style={styles.ackRejected}
              accessibilityRole="text"
            >
              <ThemedText type="small" style={{ color: colors.text }}>
                Rejected
              </ThemedText>
              {ack.violations.length > 0 ? (
                ack.violations.map((v, idx) => (
                  <View key={`${v.code}.${idx}`}>
                    <ThemedText
                      testID={`create-job.submit.ack.rejection.reason.${v.code}.${idx}`}
                      type="small"
                      accessibilityRole="text"
                      style={{ color: colors.warningIcon }}
                    >
                      {v.message}
                    </ThemedText>
                    <ThemedText
                      testID={`create-job.submit.ack.rejection.fix-action.${v.code}.${idx}`}
                      type="small"
                      accessibilityRole="text"
                      style={{ color: colors.textSecondary }}
                    >
                      {v.fixAction}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText
                  testID="create-job.submit.ack.rejected.code"
                  type="small"
                  accessibilityRole="text"
                  style={{ color: colors.textSecondary }}
                >
                  {ack.code}
                </ThemedText>
              )}
            </View>
          ) : null}

          {/* <View style={styles.footerNote} accessibilityRole="text">
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Validators use the same limits shown here before your job runs.
            </ThemedText>
          </View> */}
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
    paddingTop: Spacing.two,
  },
  headerSticky: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  creditsRightSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  creditBadge: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  addCreditsButton: {
    borderWidth: 1,
    borderRadius: Radius.full,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  addCreditsButtonLabel: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "700",
  },
  acceptedStack: {
    gap: Spacing.three,
  },
  footerNote: {
    marginTop: Spacing.two,
  },
  draftBanner: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  draftDismiss: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.one,
  },
  submitButton: {
    alignSelf: "stretch",
    borderWidth: 0,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.three,
  },
  ackRejected: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    backgroundColor: "transparent",
  },
  ackRateLimited: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  ackPolicyBlocked: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
});
