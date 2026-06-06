import React from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCardElevation, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

type SectionCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
} & Pick<ViewProps, 'testID' | 'accessibilityLabel' | 'accessibilityRole'>;

/** Elevated surface for grouped content (forms, status, results). */
export function SectionCard({
  children,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole,
}: SectionCardProps): React.ReactElement {
  const theme = useTheme();
  const scheme = useColorScheme();
  const colorScheme = scheme === 'dark' ? 'dark' : 'light';
  return (
    <ThemedView
      type="backgroundElement"
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.sectionCard,
        getCardElevation(colorScheme),
        {
          borderColor: theme.borderMuted,
        },
        style,
      ]}>
      {children}
    </ThemedView>
  );
}

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** Omit the brand line with `null`; default label is “Banyone”. */
  eyebrow?: string | null;
};

export function ScreenHeader({ title, subtitle, rightSlot, eyebrow }: ScreenHeaderProps): React.ReactElement {
  const eyebrowLabel = eyebrow === undefined ? 'Banyone' : eyebrow;
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerTextBlock}>
        {eyebrow !== null && eyebrowLabel ? (
          <ThemedText type="overline" themeColor="primary" style={styles.headerEyebrow}>
            {eyebrowLabel}
          </ThemedText>
        ) : null}
        <ThemedText type="screenTitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightSlot ? <View style={styles.headerRight}>{rightSlot}</View> : null}
    </View>
  );
}

type FormSectionProps = {
  label: string;
  children: React.ReactNode;
};

/** Grouped form block with a modern uppercase label. */
export function FormSection({ label, children }: FormSectionProps): React.ReactElement {
  return (
    <View style={styles.formSection}>
      <ThemedText type="overline" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.formSectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  headerTextBlock: {
    flex: 1,
    gap: Spacing.two,
  },
  headerEyebrow: {
    marginBottom: Spacing.half,
  },
  headerSubtitle: {
    marginTop: Spacing.half,
    maxWidth: 520,
  },
  headerRight: {
    paddingTop: Spacing.three,
  },
  formSection: {
    gap: Spacing.two,
  },
  formSectionBody: {
    gap: Spacing.three,
  },
});
