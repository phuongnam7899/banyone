import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SectionCard } from '@/components/ui/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { JobStatusPayload } from '@/features/job-status/types/job-status';
import { useTheme } from '@/hooks/use-theme';
import { usePreviewExport } from '../hooks/use-preview-export';

type Props = {
  jobStatus: JobStatusPayload;
  colorScheme: 'light' | 'dark';
  embedded?: boolean;
};

export function PreviewExportPanel({ jobStatus, colorScheme: _colorScheme, embedded = false }: Props) {
  const theme = useTheme();
  const [isPreviewModalVisible, setIsPreviewModalVisible] = React.useState(false);
  const preview = usePreviewExport(jobStatus.jobId, jobStatus.status, {
    qualityTier: jobStatus.qualityTier,
    serverTimeToPreviewMs: jobStatus.timeToPreviewMs,
  });
  const RootComponent = embedded ? View : SectionCard;

  const primaryBtn = (pressed: boolean, disabled?: boolean) => ({
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    opacity: disabled ? 0.55 : pressed ? 0.9 : 1,
  });

  const secondaryBtn = (pressed: boolean, disabled?: boolean) => ({
    backgroundColor: theme.backgroundElementMuted,
    borderColor: theme.primary,
    opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
  });

  return (
    <RootComponent style={[styles.root, embedded ? styles.rootEmbedded : null]} testID="job-result.preview.root">
      {!embedded ? <ThemedText type="smallBold">Result</ThemedText> : null}
      {preview.stage === 'loading' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Loading preview…
        </ThemedText>
      ) : null}

      {preview.stage === 'ready' ? (
        <View style={styles.ready}>
          <View style={styles.actionRow}>
            <Pressable
              testID="job-result.preview-result.button"
              accessibilityRole="button"
              disabled={!preview.preview?.previewUri}
              onPress={() => {
                setIsPreviewModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.actionButton,
                secondaryBtn(pressed, !preview.preview?.previewUri),
              ]}>
              <View style={styles.actionButtonContent}>
                <MaterialIcons name="play-circle-outline" size={16} color={theme.primary} />
                <ThemedText type="smallBold" style={[styles.actionButtonLabel, { color: theme.primary }]}>
                  Preview
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              testID="job-result.download.button"
              accessibilityRole="button"
              onPress={() => {
                void preview.exportToLibrary();
              }}
              style={({ pressed }) => [styles.actionButton, primaryBtn(pressed, preview.isExporting)]}>
              <View style={styles.actionButtonContent}>
                <MaterialIcons name="download" size={16} color={theme.onPrimary} />
                <ThemedText type="smallBold" style={[styles.actionButtonLabel, { color: theme.onPrimary }]}>
                  {preview.isExporting ? 'Downloading…' : 'Download'}
                </ThemedText>
              </View>
            </Pressable>

            {/*
              Temporarily hidden per product request.
              Keep the share flow in hook/service intact for easy re-enable.
            */}
            {false ? (
              <Pressable
                testID="job-result.share.button"
                accessibilityRole="button"
                disabled={!preview.canShare || preview.isSharing}
                onPress={() => {
                  void preview.shareExported();
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  secondaryBtn(pressed, !preview.canShare || preview.isSharing),
                ]}>
                <View style={styles.actionButtonContent}>
                  <MaterialIcons name="ios-share" size={16} color={theme.primary} />
                  <ThemedText type="smallBold" style={[styles.actionButtonLabel, { color: theme.primary }]}>
                    {preview.isSharing ? 'Opening share…' : 'Share'}
                  </ThemedText>
                </View>
              </Pressable>
            ) : null}
          </View>

          <Modal
            animationType="fade"
            transparent
            visible={isPreviewModalVisible}
            onRequestClose={() => {
              setIsPreviewModalVisible(false);
            }}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.modalHeader}>
                  <ThemedText type="smallBold">Preview Result</ThemedText>
                  <Pressable
                    testID="job-result.preview-result.close.button"
                    accessibilityRole="button"
                    accessibilityLabel="Close preview popup"
                    onPress={() => {
                      setIsPreviewModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.closeButton,
                      secondaryBtn(pressed),
                      { borderColor: theme.border },
                    ]}>
                    <MaterialIcons name="close" size={18} color={theme.primary} />
                  </Pressable>
                </View>

                <View testID="job-result.preview-result.modal.body" style={styles.modalBody}>
                  {Platform.OS === 'web' && preview.preview?.previewUri ? (
                    React.createElement('iframe', {
                      src: preview.preview.previewUri,
                      title: 'Preview result video',
                      allow: 'autoplay; fullscreen',
                      style: styles.previewFrame,
                    })
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Preview playback is available on web in this popup.
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          </Modal>

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
            style={({ pressed }) => [styles.actionButton, styles.actionButtonFull, primaryBtn(pressed)]}>
            <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
              Retry
            </ThemedText>
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
    </RootComponent>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  rootEmbedded: {
    marginTop: Spacing.two,
  },
  ready: {
    gap: Spacing.three,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actionButtonLabel: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionButtonFull: {
    alignSelf: 'stretch',
    minWidth: undefined,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 260,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    minHeight: 220,
    marginTop: Spacing.three,
    borderRadius: Radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  error: {
    gap: Spacing.two,
  },
});
