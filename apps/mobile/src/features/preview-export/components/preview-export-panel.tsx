import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePreviewExport } from '../hooks/use-preview-export';
import type { JobStatusPayload } from '@/features/job-status/types/job-status';

type Props = {
  jobStatus: JobStatusPayload;
  colorScheme: 'light' | 'dark';
};

export function PreviewExportPanel({ jobStatus, colorScheme: _colorScheme }: Props) {
  const preview = usePreviewExport(jobStatus.jobId, jobStatus.status);

  return (
    <View style={styles.root} testID="job-result.preview.root">
      {preview.stage === 'loading' ? <ThemedText type="small">Loading preview…</ThemedText> : null}

      {preview.stage === 'ready' ? (
        <View style={styles.ready}>
          <View testID="job-result.preview.video">
            <ThemedText type="small">Preview ready: {preview.preview?.previewUri ?? 'N/A'}</ThemedText>
          </View>

          <Pressable
            testID="job-result.export.button"
            accessibilityRole="button"
            onPress={() => {
              void preview.exportToLibrary();
            }}
            style={styles.button}>
            <ThemedText type="smallBold">{preview.isExporting ? 'Exporting…' : 'Export'}</ThemedText>
          </Pressable>

          <Pressable
            testID="job-result.share.button"
            accessibilityRole="button"
            disabled={!preview.canShare || preview.isSharing}
            onPress={() => {
              void preview.shareExported();
            }}
            style={[styles.button, !preview.canShare ? styles.buttonDisabled : null]}>
            <ThemedText type="smallBold">{preview.isSharing ? 'Opening share…' : 'Share'}</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {preview.stage === 'failed-preview' ? (
        <View style={styles.error}>
          <ThemedText type="small">{preview.errorMessage}</ThemedText>
          <ThemedText type="small" testID="job-result.error.code">
            Error code: {preview.errorCode}
          </ThemedText>
          <Pressable
            testID="job-result.retry.button"
            accessibilityRole="button"
            onPress={() => {
              void preview.retryPreview();
            }}
            style={styles.button}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {preview.errorCode && preview.stage !== 'failed-preview' ? (
        <View style={styles.error}>
          <ThemedText type="small">{preview.errorMessage}</ThemedText>
          <ThemedText type="small" testID="job-result.error.code">
            Error code: {preview.errorCode}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  ready: {
    gap: Spacing.two,
  },
  error: {
    gap: Spacing.one,
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
