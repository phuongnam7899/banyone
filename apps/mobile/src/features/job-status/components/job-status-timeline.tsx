import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { JobFailureMetadata, JobStatusStage } from '../types/job-status';

type Props = {
  jobId: string;
  status: JobStatusStage;
  etaSeconds?: number;
  failure?: JobFailureMetadata;
};

function stageIcon(stage: JobStatusStage): string {
  switch (stage) {
    case 'queued':
      return '•';
    case 'processing':
      return '↻';
    case 'ready':
      return '✓';
    case 'failed':
      return '!';
  }
}

export function JobStatusTimeline({ jobId, status, etaSeconds, failure }: Props) {
  const currentStageText = status;

  return (
    <View
      style={styles.root}
      testID="job-status.timeline.root"
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Job ${jobId} status: ${currentStageText}`}>
      <ThemedText type="small" accessibilityRole="text">
        Current stage: {currentStageText}
      </ThemedText>

      <View style={styles.items}>
        {(['queued', 'processing', 'ready', 'failed'] as const).map((stage) => {
          const isActive = stage === status;
          const icon = stageIcon(stage);
          const isFinal = stage === 'ready' || stage === 'failed';
          const etaCopy =
            isActive && (stage === 'queued' || stage === 'processing') && typeof etaSeconds === 'number'
              ? ` (ETA ~${etaSeconds}s)`
              : '';

          const failureCopy =
            isActive && stage === 'failed' && failure
              ? ` - ${failure.message}`
              : '';

          return (
            <View
              key={stage}
              testID={`job-status.timeline.item.${stage}`}
              style={[styles.item, isActive ? styles.itemActive : null]}>
              <ThemedText type="smallBold" accessibilityRole="text">
                {icon} {stage}
                {etaCopy}
                {failureCopy}
              </ThemedText>

              {!isFinal && isActive ? (
                <ThemedText type="small" accessibilityRole="text" style={styles.activeHint}>
                  {stage}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    gap: 10,
  },
  items: {
    gap: 8,
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: '#1565C0',
  },
  activeHint: {
    fontSize: 12,
  },
});

