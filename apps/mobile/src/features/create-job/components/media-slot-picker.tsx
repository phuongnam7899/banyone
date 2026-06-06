import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { SlotValidationResult } from "@banyone/contracts";
import { getThumbnailAsync } from "expo-video-thumbnails";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, getCardElevation, Radius, Spacing } from "@/constants/theme";

type SlotVariant = "video" | "image";

type Props = {
  variant: SlotVariant;
  colorScheme: "light" | "dark";
  label: string;
  helper: string;
  uri: string | null;
  videoDurationSec?: number | null;
  displayName: string | null;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  onClear?: () => void;
  validationResult?: SlotValidationResult;
};

const MIN_TOUCH = 48;
const EMPTY_MIN_HEIGHT = 104;
function thumbnailTimesMs(videoDurationSec?: number | null): number[] {
  const safeDurationSec =
    typeof videoDurationSec === "number" && Number.isFinite(videoDurationSec)
      ? videoDurationSec
      : null;
  const preferredFromDuration =
    safeDurationSec != null
      ? Math.max(0, Math.min(3000, Math.floor((safeDurationSec * 1000) / 3)))
      : null;
  const candidates = [
    preferredFromDuration,
    1000,
    1500,
    250,
    0,
  ].filter((time): time is number => typeof time === "number");

  return Array.from(new Set(candidates));
}

async function createWebVideoThumbnail(
  uri: string,
  videoDurationSec?: number | null,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = uri;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const fail = () => {
      cleanup();
      resolve(null);
    };

    const capture = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = Math.max(1, video.videoWidth || 1);
        const height = Math.max(1, video.videoHeight || 1);
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return fail();
        context.drawImage(video, 0, 0, width, height);
        const dataUri = canvas.toDataURL("image/jpeg", 0.8);
        cleanup();
        resolve(dataUri);
      } catch {
        fail();
      }
    };

    video.addEventListener("loadeddata", () => {
      const desiredFromKnownDuration =
        typeof videoDurationSec === "number" && Number.isFinite(videoDurationSec)
          ? Math.max(0, Math.min(3, videoDurationSec / 3))
          : null;
      const seekTo =
        desiredFromKnownDuration != null
          ? desiredFromKnownDuration
          : video.duration > 1
            ? Math.min(video.duration / 3, 3)
            : 0;
      try {
        if (seekTo === 0) {
          capture();
          return;
        }
        video.currentTime = seekTo;
      } catch {
        capture();
      }
    });
    video.addEventListener("seeked", capture);
    video.addEventListener("error", fail);
  });
}

async function createNativeVideoThumbnail(
  uri: string,
  videoDurationSec?: number | null,
): Promise<string | null> {
  for (const time of thumbnailTimesMs(videoDurationSec)) {
    try {
      const result = await getThumbnailAsync(uri, { time });
      if (result.uri) return result.uri;
    } catch {
      // Try next fallback timestamp.
    }
  }
  return null;
}

export function MediaSlotPicker({
  variant,
  colorScheme,
  label,
  helper,
  uri,
  videoDurationSec,
  displayName,
  testID,
  accessibilityLabel,
  onPress,
  onClear,
  validationResult,
}: Props) {
  const colors = Colors[colorScheme];
  const hasAsset = Boolean(uri);
  const [videoPreviewUri, setVideoPreviewUri] = React.useState<string | null>(
    null,
  );
  const isValid = hasAsset && validationResult?.status === "valid";
  const showInvalid =
    hasAsset && validationResult?.status === "invalid-with-fix";
  const invalidMessages =
    showInvalid && validationResult
      ? validationResult.violations.map((violation) => violation.message)
      : [];
  const previewUri = variant === "video" ? videoPreviewUri : uri;

  React.useEffect(() => {
    if (variant !== "video" || !uri) {
      setVideoPreviewUri(null);
      return;
    }

    let isActive = true;
    setVideoPreviewUri(null);

    const loadPreview =
      Platform.OS === "web"
        ? createWebVideoThumbnail(uri, videoDurationSec)
        : createNativeVideoThumbnail(uri, videoDurationSec);

    void loadPreview
      .then((result) => {
        if (!isActive) return;
        setVideoPreviewUri(result);
      })
      .catch(() => {
        if (!isActive) return;
        setVideoPreviewUri(null);
      });

    return () => {
      isActive = false;
    };
  }, [variant, uri, videoDurationSec]);

  return (
    <View style={styles.block}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText type="small" style={{ color: colors.textSecondary }}>
        {helper}
      </ThemedText>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) =>
          hasAsset && uri
            ? [
                styles.picker,
                styles.pickerFilled,
                getCardElevation(colorScheme),
                {
                  minHeight: MIN_TOUCH,
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.backgroundElement,
                  opacity: pressed ? 0.96 : 1,
                },
              ]
            : [
                styles.picker,
                styles.pickerEmpty,
                {
                  minHeight: EMPTY_MIN_HEIGHT,
                  borderColor: colors.primary,
                  backgroundColor: pressed
                    ? colors.backgroundSelected
                    : colors.primaryMuted,
                  opacity: pressed ? 0.95 : 1,
                },
              ]
        }
      >
        {hasAsset && uri ? (
          <View style={styles.previewRow}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={[
                  variant === "video" ? styles.thumbVideo : styles.thumbImage,
                  variant === "video"
                    ? { backgroundColor: colors.overlayScrim }
                    : null,
                ]}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View
                style={[
                  styles.thumbVideo,
                  styles.videoThumbFallback,
                  { backgroundColor: colors.overlayScrim },
                ]}
              >
                <MaterialIcons
                  name="videocam"
                  size={16}
                  color={colors.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
            )}
            <View
              style={styles.previewTextBlock}
              accessibilityLabel={displayName ?? "selected file"}
            >
              <ThemedText
                type="smallBold"
                numberOfLines={2}
                style={{ color: colors.text }}
              >
                {displayName ?? "Selected"}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                Tap to replace
              </ThemedText>
            </View>
            {isValid ? (
              <View
                style={[
                  styles.validBadge,
                  {
                    // borderColor: colors.onSuccessSurface,
                    backgroundColor: colors.successSurface,
                  },
                ]}
                accessibilityLabel="Valid selection"
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: colors.onSuccessSurface }}
                >
                  ✓
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyInner}>
            <ThemedText type="smallBold" style={{ color: colors.primary }}>
              Choose from library
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: colors.textSecondary, textAlign: "center" }}
            >
              {variant === "video" ? "Video file" : "Photo"}
            </ThemedText>
          </View>
        )}
      </Pressable>
      {invalidMessages.length > 0 ? (
        <View style={styles.invalidMessageBlock}>
          {invalidMessages.map((message, idx) => (
            <ThemedText
              key={`${message}.${idx}`}
              type="small"
              style={{ color: colors.warningIcon }}
            >
              {message}
            </ThemedText>
          ))}
        </View>
      ) : null}
      {hasAsset && onClear ? (
        <Pressable
          testID={`${testID}.clear`}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          onPress={onClear}
          style={({ pressed }) => [
            styles.clearBtn,
            {
              minHeight: MIN_TOUCH,
              opacity: pressed ? 0.85 : 1,
              borderColor: colors.borderMuted,
              backgroundColor: colors.backgroundElement,
            },
          ]}
        >
          <View style={styles.clearBtnContent}>
            <MaterialIcons
              name="delete-outline"
              size={16}
              color={colors.onDangerSurface}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <ThemedText type="small" style={{ color: colors.onDangerSurface }}>
              Remove selection
            </ThemedText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: "stretch",
    gap: Spacing.two,
  },
  picker: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    justifyContent: "center",
  },
  pickerFilled: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerEmpty: {
    borderWidth: 1.5,
    borderStyle: Platform.OS === "ios" ? "dashed" : "solid",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  previewTextBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  validBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyInner: {
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  thumbImage: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
  },
  thumbVideo: {
    width: 72,
    height: 48,
    borderRadius: Radius.md,
  },
  videoThumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.one,
    justifyContent: "center",
  },
  clearBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  invalidMessageBlock: {
    gap: Spacing.half,
    marginTop: Spacing.half,
  },
});
