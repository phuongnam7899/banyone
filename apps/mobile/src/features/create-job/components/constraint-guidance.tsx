import { getCreateJobConstraintBullets } from '@banyone/contracts';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  colorScheme: 'light' | 'dark';
};

export function ConstraintGuidance({ colorScheme }: Props) {
  const colors = Colors[colorScheme];
  const bullets = getCreateJobConstraintBullets();
  const a11ySummary = ['Requirements', ...bullets.map((b) => `${b.title}: ${b.body}`)].join('. ');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.infoSurface, borderColor: colors.borderMuted }]}
      accessible
      accessibilityLabel={a11ySummary}
      testID="create-job.requirements.section">
      <View style={styles.cardHeader}>
        <View style={[styles.headerIconWrap, { backgroundColor: colors.primaryMuted }]}>
          <ThemedText
            type="smallBold"
            style={{ color: colors.primary }}
            accessibilityElementsHidden
            importantForAccessibility="no">
            i
          </ThemedText>
        </View>
        <ThemedText type="defaultSemiBold" style={{ color: colors.onInfoSurface }}>
          Requirements
        </ThemedText>
      </View>
      {bullets.map((b) => (
        <View key={b.key} style={styles.row}>
          <ThemedText
            type="small"
            style={[styles.dot, { color: colors.warningIcon }]}
            accessibilityElementsHidden
            importantForAccessibility="no">
            ●
          </ThemedText>
          <View style={styles.rowBody}>
            <ThemedText type="defaultSemiBold" style={{ color: colors.onInfoSurface }}>
              {b.title}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.onInfoSurface }}>
              {b.body}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  dot: {
    marginTop: 2,
    lineHeight: 16,
  },
});
