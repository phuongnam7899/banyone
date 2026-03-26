import { InputViolation, SlotValidationResult } from '@banyone/contracts';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  colorScheme: 'light' | 'dark';
  video: SlotValidationResult;
  image: SlotValidationResult;
  onPickVideo: () => void;
  onPickImage: () => void;
};

const TEST_ID_ROOT = 'create-job.input-compliance-checker';

function slotTestID(slot: 'video' | 'image') {
  return `${TEST_ID_ROOT}.${slot}`;
}

function messageTestID(slot: 'video' | 'image', code: string) {
  return `${TEST_ID_ROOT}.${slot}.violation.${code}.message`;
}

function fixButtonTestID(slot: 'video' | 'image', code: string) {
  return `${TEST_ID_ROOT}.${slot}.violation.${code}.fix-action`;
}

function stageTestID(slot: 'video' | 'image', status: SlotValidationResult['status']) {
  return `${TEST_ID_ROOT}.${slot}.stage.${status}`;
}

function StageLabel({ status, colorScheme, slot }: { status: SlotValidationResult['status']; colorScheme: 'light' | 'dark'; slot: 'video' | 'image' }) {
  const colors = Colors[colorScheme];
  const label =
    status === 'pending' ? 'Validating…' : status === 'valid' ? 'Ready' : 'Needs fix';

  return (
    <ThemedText
      testID={stageTestID(slot, status)}
      type="small"
      accessibilityRole="text"
      style={{ color: colors.textSecondary }}>
      {label}
    </ThemedText>
  );
}

function ViolationBlock({
  slot,
  violation,
  onFix,
  colorScheme,
}: {
  slot: 'video' | 'image';
  violation: InputViolation;
  onFix: () => void;
  colorScheme: 'light' | 'dark';
}) {
  const colors = Colors[colorScheme];
  return (
    <View style={styles.violationBlock}>
      <ThemedText
        testID={messageTestID(slot, violation.code)}
        accessibilityRole="text"
        accessibilityLabel={violation.message}
        type="small"
        style={{ color: colors.warningIcon }}>
        {violation.message}
      </ThemedText>

      <Pressable
        testID={fixButtonTestID(slot, violation.code)}
        accessibilityRole="button"
        accessibilityLabel={violation.fixAction}
        onPress={onFix}
        style={({ pressed }) => [styles.fixButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]} >
        <ThemedText type="small" style={{ color: colors.onPrimary }}>
          {violation.fixAction}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export function InputComplianceChecker({ colorScheme, video, image, onPickVideo, onPickImage }: Props) {
  return (
    <View testID={TEST_ID_ROOT} style={[styles.card, { borderColor: Colors[colorScheme].textSecondary }]}>
      <View style={styles.slotBlock}>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.half }}>
          Source video
        </ThemedText>
        <View testID={slotTestID('video')}>
          <StageLabel status={video.status} slot="video" colorScheme={colorScheme} />
          {video.status === 'invalid-with-fix'
            ? video.violations.map((v, idx) => (
                <ViolationBlock
                  key={`${v.code}.${idx}`}
                  slot="video"
                  violation={v}
                  onFix={onPickVideo}
                  colorScheme={colorScheme}
                />
              ))
            : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.slotBlock}>
        <ThemedText type="defaultSemiBold" style={{ marginBottom: Spacing.half }}>
          Reference image
        </ThemedText>
        <View testID={slotTestID('image')}>
          <StageLabel status={image.status} slot="image" colorScheme={colorScheme} />
          {image.status === 'invalid-with-fix'
            ? image.violations.map((v, idx) => (
                <ViolationBlock
                  key={`${v.code}.${idx}`}
                  slot="image"
                  violation={v}
                  onFix={onPickImage}
                  colorScheme={colorScheme}
                />
              ))
            : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  slotBlock: {
    gap: Spacing.half,
  },
  divider: {
    height: 1,
    backgroundColor: 'transparent',
  },
  violationBlock: {
    gap: Spacing.half,
  },
  fixButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    alignSelf: 'flex-start',
  },
});

