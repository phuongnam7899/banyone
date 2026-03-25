import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type SlotVariant = 'video' | 'image';

type Props = {
  variant: SlotVariant;
  colorScheme: 'light' | 'dark';
  label: string;
  helper: string;
  uri: string | null;
  displayName: string | null;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
  onClear?: () => void;
};

const MIN_TOUCH = 44;

export function MediaSlotPicker({
  variant,
  colorScheme,
  label,
  helper,
  uri,
  displayName,
  testID,
  accessibilityLabel,
  onPress,
  onClear,
}: Props) {
  const colors = Colors[colorScheme];
  const hasAsset = Boolean(uri);

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
        style={({ pressed }) => [
          styles.picker,
          {
            minHeight: MIN_TOUCH,
            borderColor: colors.textSecondary,
            backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
          },
        ]}>
        {hasAsset && uri ? (
          <View style={styles.previewRow}>
            <Image
              source={{ uri }}
              style={variant === 'video' ? styles.thumbVideo : styles.thumbImage}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <ThemedText
              type="small"
              numberOfLines={2}
              style={{ flex: 1, color: colors.text }}
              accessibilityLabel={displayName ?? 'selected file'}>
              {displayName ?? 'Selected'}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
            Tap to choose from library
          </ThemedText>
        )}
      </Pressable>
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
              borderColor: colors.textSecondary,
            },
          ]}>
          <ThemedText type="small" style={{ color: colors.textSecondary }}>
            Remove selection
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  picker: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thumbImage: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
  },
  thumbVideo: {
    width: 56,
    height: 40,
    borderRadius: Spacing.two,
    backgroundColor: '#000',
  },
  clearBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginTop: Spacing.one,
    justifyContent: 'center',
  },
});
