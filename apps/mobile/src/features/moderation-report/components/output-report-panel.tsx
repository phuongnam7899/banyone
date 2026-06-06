import { OUTPUT_REPORT_REASON_CATEGORIES, type OutputReportReasonCategory } from '@banyone/contracts';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useOutputReportSubmission } from '@/features/moderation-report/hooks/use-output-report-submission';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  jobId: string;
};

export function OutputReportPanel({ jobId }: Props) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedReason, setSelectedReason] =
    React.useState<OutputReportReasonCategory>('OTHER');
  const [details, setDetails] = React.useState('');
  const { isSubmitting, submission, submitReport, reset } =
    useOutputReportSubmission(jobId);

  const openReport = React.useCallback(() => {
    setIsOpen(true);
    reset();
  }, [reset]);

  const closeReport = React.useCallback(() => {
    setIsOpen(false);
    setDetails('');
    reset();
  }, [reset]);

  return (
    <View style={styles.root}>
      <Pressable
        testID="job-result.report.open.button"
        accessibilityRole="button"
        onPress={openReport}
        style={({ pressed }) => [
          styles.openButton,
          {
            borderColor: theme.borderMuted,
            backgroundColor: theme.backgroundElement,
            opacity: pressed ? 0.9 : 1,
          },
        ]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Report this output
        </ThemedText>
      </Pressable>

      {isOpen ? (
        <View
          style={[
            styles.sheet,
            {
              borderColor: theme.borderMuted,
              backgroundColor: theme.backgroundElement,
            },
          ]}
          testID="job-result.report.sheet">
          <ThemedText type="overline" themeColor="textSecondary">
            Reason
          </ThemedText>
          <View style={styles.reasons}>
            {OUTPUT_REPORT_REASON_CATEGORIES.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  testID={`job-result.report.category.${reason}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedReason(reason)}
                  style={[
                    styles.reasonButton,
                    {
                      borderColor: selected ? theme.primary : theme.borderMuted,
                      backgroundColor: selected ? theme.primaryMuted : 'transparent',
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: selected ? theme.primary : theme.text }}>
                    {reason}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            testID="job-result.report.details.input"
            value={details}
            onChangeText={setDetails}
            placeholder="Optional details"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
            style={[
              styles.input,
              {
                borderColor: theme.borderMuted,
                color: theme.text,
                backgroundColor: theme.background,
              },
            ]}
          />

          <View style={styles.actions}>
            <Pressable
              testID="job-result.report.submit.button"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => {
                void submitReport(selectedReason, details);
              }}
              style={({ pressed }) => [
                styles.primaryAction,
                {
                  backgroundColor: theme.primary,
                  opacity: isSubmitting ? 0.55 : pressed ? 0.92 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {isSubmitting ? 'Submitting…' : 'Submit report'}
              </ThemedText>
            </Pressable>
            <Pressable
              testID="job-result.report.cancel.button"
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={closeReport}
              style={({ pressed }) => [
                styles.secondaryAction,
                {
                  borderColor: theme.borderMuted,
                  opacity: isSubmitting ? 0.5 : pressed ? 0.88 : 1,
                },
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          </View>

          {submission.kind === 'success' ? (
            <ThemedText type="small" testID="job-result.report.confirmation" themeColor="primary">
              Report received. ID: {submission.data.reportId}
            </ThemedText>
          ) : null}

          {submission.kind === 'error' ? (
            <View style={styles.error} testID="job-result.report.error">
              <ThemedText type="small">{submission.message}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {submission.code}
                {submission.traceId ? ` (${submission.traceId})` : ''}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  openButton: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  reasonButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  primaryAction: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  secondaryAction: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  error: {
    gap: Spacing.one,
  },
});
