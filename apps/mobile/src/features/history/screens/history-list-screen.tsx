import { useRouter } from "expo-router";
import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader, SectionCard } from "@/components/ui/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Radius, Spacing } from "@/constants/theme";
import { usePreviewExport } from "@/features/preview-export/hooks/use-preview-export";
import { useTheme } from "@/hooks/use-theme";

import { useJobHistoryList } from "../hooks/use-job-history";
import { toStatusLabel, type HistoryListItem } from "../types/history";

function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function HistoryListScreen(): React.JSX.Element {
  const router = useRouter();
  const theme = useTheme();
  const { items, isLoading } = useJobHistoryList();

  if (isLoading) {
    return (
      <ThemedView style={styles.flex1}>
        <View style={styles.center} testID="history.list.loading">
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Loading your jobs…
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (items.length === 0) {
    return (
      <ThemedView style={styles.flex1}>
        <SafeAreaView style={styles.safeEmpty} edges={["top", "left", "right"]}>
          <ScreenHeader
            title="History"
            subtitle="Past generation jobs appear here."
          />
          <View style={styles.center} testID="history.empty.state">
            <ThemedText type="screenTitle" style={styles.emptyTitle}>
              No jobs yet
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.emptySubtitle}
            >
              Create your first generation to see it listed here.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              testID="history.empty.create-cta.button"
              onPress={() => router.push("/create-job")}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                Create job
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex1}>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BottomTabInset + Spacing.four },
          ]}
          testID="history.list.screen"
        >
          <ScreenHeader title="History" subtitle="" />

          {items.map((item) => (
            <SectionCard
              key={item.jobId}
              style={styles.listCard}
              testID={`history.list.item.${item.jobId}`}
            >
              <View style={styles.cardRow}>
                <View
                  style={[
                    styles.thumbnailFrame,
                    {
                      backgroundColor: theme.backgroundElementMuted,
                      borderColor: theme.borderMuted,
                    },
                  ]}
                >
                  {item.sourceImageUrl ? (
                    <Image
                      style={styles.thumbnailImage}
                      source={{ uri: item.sourceImageUrl }}
                      contentFit="cover"
                      testID={`history.list.thumbnail.${item.jobId}`}
                    />
                  ) : (
                    <View
                      style={styles.thumbnailPlaceholder}
                      testID={`history.list.thumbnail.placeholder.${item.jobId}`}
                    >
                      <MaterialIcons
                        name="image-not-supported"
                        size={16}
                        color={theme.textSecondary}
                      />
                    </View>
                  )}
                </View>
                <View style={styles.cardMain}>
                  <View style={styles.cardTop}>
                    <ThemedText type="smallBold">
                      {toStatusLabel(item.status)}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      numberOfLines={1}
                    >
                      {formatLocalDateTime(item.updatedAt)}
                    </ThemedText>
                  </View>
                  <HistoryItemActions item={item} />
                </View>
              </View>
            </SectionCard>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HistoryItemActions({
  item,
}: {
  item: HistoryListItem;
}): React.JSX.Element {
  const theme = useTheme();
  const [isPreviewModalVisible, setIsPreviewModalVisible] =
    React.useState(false);
  const preview = usePreviewExport(item.jobId, item.status);
  const isReady = item.status === "ready";
  const canPreview =
    isReady &&
    Boolean(preview.preview?.previewUri) &&
    preview.stage === "ready";
  const canDownload = isReady && !preview.isExporting;

  return (
    <View style={styles.actionRow}>
      <Pressable
        testID={`history.list.preview.button.${item.jobId}`}
        accessibilityRole="button"
        disabled={!canPreview}
        onPress={() => {
          setIsPreviewModalVisible(true);
        }}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: theme.backgroundElementMuted,
            borderColor: theme.primary,
            opacity: !canPreview ? 0.55 : pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.actionButtonContent}>
          <MaterialIcons
            name="play-circle-outline"
            size={14}
            color={theme.primary}
          />
          <ThemedText
            type="smallBold"
            style={[styles.actionButtonLabel, { color: theme.primary }]}
          >
            Preview
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        testID={`history.list.download.button.${item.jobId}`}
        accessibilityRole="button"
        disabled={!canDownload}
        onPress={() => {
          void preview.exportToLibrary();
        }}
        style={({ pressed }) => [
          styles.actionButton,
          {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            opacity: !canDownload ? 0.55 : pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.actionButtonContent}>
          <MaterialIcons name="download" size={14} color={theme.onPrimary} />
          <ThemedText
            type="smallBold"
            style={[styles.actionButtonLabel, { color: theme.onPrimary }]}
          >
            {preview.isExporting ? "Downloading…" : "Download"}
          </ThemedText>
        </View>
      </Pressable>
      <Modal
        animationType="fade"
        transparent
        visible={isPreviewModalVisible}
        onRequestClose={() => {
          setIsPreviewModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="smallBold">Preview Result</ThemedText>
              <Pressable
                testID={`history.list.preview.close.button.${item.jobId}`}
                accessibilityRole="button"
                accessibilityLabel="Close preview popup"
                onPress={() => {
                  setIsPreviewModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.closeButton,
                  {
                    backgroundColor: theme.backgroundElementMuted,
                    borderColor: theme.borderMuted,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <MaterialIcons name="close" size={18} color={theme.primary} />
              </Pressable>
            </View>

            <View
              testID={`history.list.preview.modal.body.${item.jobId}`}
              style={styles.modalBody}
            >
              {Platform.OS === "web" && preview.preview?.previewUri ? (
                React.createElement("iframe", {
                  src: preview.preview.previewUri,
                  title: `Preview result video ${item.jobId}`,
                  allow: "autoplay; fullscreen",
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
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  safe: { flex: 1 },
  safeEmpty: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingTop: Spacing.three,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  emptyTitle: { textAlign: "center" },
  emptySubtitle: { textAlign: "center", maxWidth: 320 },
  listCard: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  cardRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "center",
  },
  thumbnailFrame: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMain: {
    flex: 1,
    gap: Spacing.one + Spacing.half,
  },
  cardTop: { gap: Spacing.half },
  primaryButton: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.one + Spacing.half,
    alignItems: "stretch",
  },
  actionButton: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  actionButtonLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.three,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 260,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  closeButton: {
    borderWidth: 1,
    borderRadius: Radius.md,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
    minHeight: 220,
    marginTop: Spacing.three,
    borderRadius: Radius.md,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  previewFrame: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
});
