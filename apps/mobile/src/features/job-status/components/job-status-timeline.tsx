import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { JobFailureMetadata, JobStatusStage } from '../types/job-status';

type Props = {
  jobId: string;
  status: JobStatusStage;
  etaSeconds?: number;
  failure?: JobFailureMetadata;
};

const STEPPER_STAGES: JobStatusStage[] = ['queued', 'processing', 'ready'];

function stageIcon(stage: JobStatusStage): string {
  switch (stage) {
    case 'queued':
      return '◷';
    case 'processing':
      return '⚙';
    case 'ready':
      return '✓';
    case 'failed':
      return '!';
  }
}

function stageLabel(stage: JobStatusStage): string {
  switch (stage) {
    case 'queued':
      return 'Queue';
    case 'processing':
      return 'Process';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
  }
}

function resolveStepperStage(status: JobStatusStage): JobStatusStage {
  return status === 'failed' ? 'processing' : status;
}

export function JobStatusTimeline({ jobId, status, etaSeconds, failure }: Props) {
  const theme = useTheme();
  const activeStepperStage = resolveStepperStage(status);
  const activeIndex = STEPPER_STAGES.indexOf(activeStepperStage);
  const currentStageText = stageLabel(status);

  return (
    <View
      style={styles.root}
      testID="job-status.timeline.root"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Job ${jobId} status: ${currentStageText}`}>
      <View style={styles.stepperCard}>
        <View style={styles.stepperRow}>
          {STEPPER_STAGES.map((stage, index) => {
            const isCurrent = stage === activeStepperStage;
            const isComplete = index < activeIndex || (status === 'ready' && stage === 'ready');
            const isUpcoming = index > activeIndex;
            const showLoading = isCurrent && (stage === 'queued' || stage === 'processing') && status !== 'failed';
            const icon = stageIcon(stage);
            const circleBorderColor = isUpcoming
              ? theme.borderMuted
              : isComplete
                ? theme.successSurface
                : theme.primary;
            const circleBackgroundColor = isUpcoming
              ? theme.backgroundElement
              : isComplete
                ? theme.successSurface
                : theme.primary;
            const iconColor = isComplete ? theme.onSuccessSurface : theme.onPrimary;

            return (
              <React.Fragment key={stage}>
                <View testID={`job-status.timeline.item.${stage}`} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      {
                        borderColor: circleBorderColor,
                        backgroundColor: circleBackgroundColor,
                      },
                    ]}>
                    {showLoading ? (
                      <ActivityIndicator size="small" color={theme.onPrimary} />
                    ) : isComplete || isCurrent ? (
                      <ThemedText type="smallBold" style={[styles.stepIcon, { color: iconColor }]}>
                        {icon}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText
                    type="small"
                    themeColor={isUpcoming ? 'textSecondary' : 'text'}
                    style={styles.stepLabel}>
                    {stageLabel(stage)}
                  </ThemedText>
                </View>
                {index < STEPPER_STAGES.length - 1 ? (
                  (() => {
                    const leftStepDone = isComplete;
                    const rightStep = STEPPER_STAGES[index + 1];
                    const rightStepDone =
                      index + 1 < activeIndex || (status === 'ready' && rightStep === 'ready');
                    const connectorColor =
                      leftStepDone && rightStepDone
                        ? theme.successSurface
                        : index < activeIndex
                          ? theme.primary
                          : theme.borderMuted;

                    return (
                      <View
                        style={[
                          styles.connector,
                          {
                            backgroundColor: connectorColor,
                          },
                        ]}
                      />
                    );
                  })()
                ) : null}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      <View testID="job-status.timeline.item.failed" style={styles.failedContainer}>
        {status === 'failed' ? (
          <View
            style={[
              styles.failedBanner,
              {
                backgroundColor: theme.dangerSurface,
                borderColor: theme.borderMuted,
              },
            ]}>
            <ThemedText type="smallBold" themeColor="onDangerSurface">
              {stageIcon('failed')} Failed
            </ThemedText>
            {failure ? (
              <ThemedText type="small" themeColor="onDangerSurface">
                {failure.message}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  stepperCard: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.lg,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    fontSize: 18,
    lineHeight: 20,
  },
  connector: {
    flex: 1,
    height: 2,
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.one,
    marginTop: 15,
  },
  stepLabel: {
    textAlign: 'center',
  },
  failedContainer: {
    minHeight: 1,
  },
  failedBanner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
});

