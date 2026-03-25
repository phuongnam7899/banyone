import { getCreateJobConstraintBullets } from '@banyone/contracts';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

type Props = {
  colorScheme: 'light' | 'dark';
};

export function ConstraintGuidance({ colorScheme }: Props) {
  const colors = Colors[colorScheme];
  const bullets = getCreateJobConstraintBullets();
  const a11ySummary = ['Requirements', ...bullets.map((b) => `${b.title}: ${b.body}`)].join('. ');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.infoSurface, borderColor: colors.onInfoSurface }]}
      accessible
      accessibilityLabel={a11ySummary}
      testID="create-job.requirements.section">
      <View style={styles.cardHeader}>
        <ThemedText
          type="small"
          style={[styles.headerIcon, { color: colors.onInfoSurface }]}
          accessibilityElementsHidden
          importantForAccessibility="no">
          i
        </ThemedText>
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
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerIcon: {
    width: 22,
    height: 22,
    textAlign: 'center',
    fontWeight: '700',
    borderRadius: 11,
    overflow: 'hidden',
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
