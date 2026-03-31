import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { ConstraintGuidance } from '@/features/create-job/components/constraint-guidance';
import { MediaSlotPicker } from '@/features/create-job/components/media-slot-picker';
import { InputComplianceChecker } from '@/features/create-job/components/input-compliance-checker';
import { useJobInputSelection } from '@/features/create-job/hooks/use-job-input-selection';
import { useJobSubmission } from '@/features/create-job/hooks/use-job-submission';
import { JobStatusTimeline } from '@/features/job-status/components/job-status-timeline';
import { useJobStatusPolling } from '@/features/job-status/hooks/use-job-status-polling';
import { ReadyResultScreen } from '@/features/preview-export/screens/ready-result-screen';
import { validateJobInputCompliance } from '@banyone/contracts';

type Props = {
  colorScheme: 'light' | 'dark';
};

export function CreateJobScreen({ colorScheme }: Props) {
  const colors = Colors[colorScheme];
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

  const { isSubmittingJob, ack, submit } = useJobSubmission(createGenerationJobBody, jobSubmissionOptions);

  React.useEffect(() => {
    if (ack?.type === 'accepted') {
      void clearPersistedDraftAfterAcceptedJob();
    }
  }, [ack, clearPersistedDraftAfterAcceptedJob]);

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

  const acceptedJobId = ack?.type === 'accepted' ? ack.jobId : null;
  const initialJobStatus =
    acceptedJobId && ack?.type === 'accepted'
      ? { jobId: ack.jobId, status: ack.status, updatedAt: new Date().toISOString() }
      : null;

  const { status: polledJobStatus, isRefreshingStatus } = useJobStatusPolling(
    acceptedJobId,
    initialJobStatus,
  );

  return (
    <ThemedView style={styles.container} testID="create-job.screen">
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.four }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              New creation
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Pick one source video and one reference image. Limits below match what we will validate before submit.
            </ThemedText>
          </View>

          {isRestoringDraft ? (
            <View
              testID="create-job.draft-restoring.banner"
              accessibilityRole="text"
              style={[styles.draftBanner, { borderColor: colors.textSecondary }]}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Restoring your draft…
              </ThemedText>
            </View>
          ) : null}

          {!isRestoringDraft && draftRestoreNotice === 'restored' ? (
            <View
              testID="create-job.draft-restored.banner"
              accessibilityRole="text"
              style={[styles.draftBanner, { borderColor: colors.primary }]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Draft restored — your previous selections were kept.
              </ThemedText>
              <Pressable
                testID="create-job.draft-restored.dismiss"
                accessibilityRole="button"
                accessibilityLabel="Dismiss draft restored message"
                onPress={dismissDraftNotice}
                style={styles.draftDismiss}>
                <ThemedText type="small" style={{ color: colors.primary }}>
                  Dismiss
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {!isRestoringDraft && draftRestoreNotice === 'corrupted' ? (
            <View
              testID="create-job.draft-corrupted.banner"
              accessibilityRole="text"
              style={[styles.draftBanner, { borderColor: colors.warningIcon }]}>
              <ThemedText type="small" style={{ color: colors.text }}>
                Your saved draft could not be loaded (files missing). Please pick media again.
              </ThemedText>
              <Pressable
                testID="create-job.draft-corrupted.dismiss"
                accessibilityRole="button"
                accessibilityLabel="Dismiss draft error message"
                onPress={dismissDraftNotice}
                style={styles.draftDismiss}>
                <ThemedText type="small" style={{ color: colors.primary }}>
                  OK
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <ConstraintGuidance colorScheme={colorScheme} />

          <MediaSlotPicker
            variant="video"
            colorScheme={colorScheme}
            label="Source video"
            helper="Choose a single video from your library. Replacing picks swaps the clip in this slot."
            uri={state.videoUri}
            displayName={state.videoLabel}
            testID="create-job.upload-video.button"
            accessibilityLabel="Choose source video from library"
            onPress={pickVideo}
            onClear={clearVideo}
          />

          <MediaSlotPicker
            variant="image"
            colorScheme={colorScheme}
            label="Reference image"
            helper="Choose one still image. This slot only accepts photos—not another video."
            uri={state.imageUri}
            displayName={state.imageLabel}
            testID="create-job.upload-image.button"
            accessibilityLabel="Choose reference image from library"
            onPress={pickImage}
            onClear={clearImage}
          />

          <InputComplianceChecker
            colorScheme={colorScheme}
            video={validation.video}
            image={validation.image}
            onPickVideo={pickVideo}
            onPickImage={pickImage}
          />

          <Pressable
            testID="create-job.submit.button"
            accessibilityRole="button"
            accessibilityLabel="Submit"
            disabled={isSubmittingJob || isRestoringDraft}
            onPress={() => {
              void submit();
            }}
            style={({ pressed }) => [
              styles.submitButton,
              {
                backgroundColor: colors.primary,
                opacity: isSubmittingJob || isRestoringDraft ? 0.6 : pressed ? 0.85 : 1,
                borderColor: colors.primary,
              },
            ]}>
            <ThemedText type="small" style={{ color: colors.onPrimary }}>
              {isRestoringDraft ? 'Loading draft…' : isSubmittingJob ? 'Submitting…' : 'Submit'}
            </ThemedText>
          </Pressable>

          {ack?.type === 'accepted' ? (
            <View style={{ gap: 12 }}>
              <View
                testID="create-job.submit.ack.accepted"
                style={styles.ackAccepted}
                accessibilityRole="text">
                <ThemedText type="small" style={{ color: colors.text }}>
                  Accepted
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary }}>
                  Job ID: {ack.jobId}
                </ThemedText>
              </View>

              {polledJobStatus ? (
                <View style={{ marginTop: 0 }}>
                  <JobStatusTimeline
                    jobId={ack.jobId}
                    status={polledJobStatus.status}
                    etaSeconds={polledJobStatus.etaSeconds}
                    failure={polledJobStatus.failure}
                  />
                </View>
              ) : null}

              {polledJobStatus?.status === 'ready' ? (
                <ReadyResultScreen jobStatus={polledJobStatus} colorScheme={colorScheme} />
              ) : null}

              {polledJobStatus?.status === 'failed' && polledJobStatus.failure?.retryable ? (
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
                      opacity: isSubmittingJob || isRefreshingStatus ? 0.6 : pressed ? 0.85 : 1,
                      borderColor: colors.primary,
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: colors.onPrimary }}>
                    {isRefreshingStatus ? 'Refreshing…' : 'Retry'}
                  </ThemedText>
                </Pressable>
              ) : null}

              {polledJobStatus?.status === 'failed' &&
              polledJobStatus.failure &&
              !polledJobStatus.failure.retryable ? (
                <View style={{ marginTop: 0 }}>
                  <ThemedText type="small" style={{ color: colors.text }}>
                    Failed. This error cannot be retried.
                  </ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    Reason: {polledJobStatus.failure.reasonCode}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}

          {ack?.type === 'rate-limited' ? (
            <View
              testID="create-job.submit.ack.rate-limited"
              style={[styles.ackRateLimited, { borderColor: colors.textSecondary }]}
              accessibilityRole="alert"
              accessibilityLabel="Rate limited">
              <ThemedText type="small" style={{ color: colors.text }}>
                Temporarily limited
              </ThemedText>
              <ThemedText
                testID="create-job.submit.ack.rate-limited.message"
                type="small"
                accessibilityRole="text"
                style={{ color: colors.textSecondary }}>
                {ack.message}
                {ack.retryAfterSec != null
                  ? ` You can try again in about ${ack.retryAfterSec} seconds.`
                  : ''}
              </ThemedText>
            </View>
          ) : null}

          {ack?.type === 'rejected' ? (
            <View testID="create-job.submit.ack.rejected" style={styles.ackRejected} accessibilityRole="text">
              <ThemedText type="small" style={{ color: colors.text }}>
                Rejected
              </ThemedText>
              {ack.violations.length > 0
                ? ack.violations.map((v, idx) => (
                    <View key={`${v.code}.${idx}`}>
                      <ThemedText
                        testID={`create-job.submit.ack.rejection.reason.${v.code}.${idx}`}
                        type="small"
                        accessibilityRole="text"
                        style={{ color: colors.warningIcon }}>
                        {v.message}
                      </ThemedText>
                      <ThemedText
                        testID={`create-job.submit.ack.rejection.fix-action.${v.code}.${idx}`}
                        type="small"
                        accessibilityRole="text"
                        style={{ color: colors.textSecondary }}>
                        {v.fixAction}
                      </ThemedText>
                    </View>
                  ))
                : (
                    <ThemedText
                      testID="create-job.submit.ack.rejected.code"
                      type="small"
                      accessibilityRole="text"
                      style={{ color: colors.textSecondary }}>
                      {ack.code}
                    </ThemedText>
                  )}
            </View>
          ) : null}

          <View style={styles.footerNote} accessibilityRole="text">
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              Submission and deep validation arrive in the next stories; here you will always see the same limits the
              validators will use.
            </ThemedText>
          </View>
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
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    textAlign: 'left',
  },
  footerNote: {
    marginTop: Spacing.two,
  },
  draftBanner: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  draftDismiss: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  submitButton: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ackAccepted: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    backgroundColor: 'transparent',
  },
  retryButton: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  ackRejected: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    backgroundColor: 'transparent',
  },
  ackRateLimited: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
});
