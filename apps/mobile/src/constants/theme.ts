/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

/** Soft canvas + elevated surfaces (modern app shell). */
export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    textOnDark: '#f8fafc',
    background: '#e2e8f0',
    backgroundElement: '#ffffff',
    backgroundElementMuted: '#f8fafc',
    backgroundSelected: '#dbe6f4',
    overlayScrim: 'rgba(2, 6, 23, 0.44)',
    /** Primary CTA — strong contrast on white. */
    primary: '#1d4ed8',
    onPrimary: '#ffffff',
    linkPrimary: '#2563eb',
    brandPrimary: '#1a73e8',
    onBrandPrimary: '#ffffff',
    infoSurface: '#dbeafe',
    onInfoSurface: '#1e40af',
    successSurface: '#dcfce7',
    onSuccessSurface: '#166534',
    dangerSurface: '#fee2e2',
    onDangerSurface: '#991b1b',
    warningIcon: '#ca8a04',
    borderMuted: '#e2e8f0',
    /** Tint for empty media slots / chips. */
    primaryMuted: 'rgba(37, 99, 235, 0.1)',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textOnDark: '#f8fafc',
    background: '#020617',
    backgroundElement: '#0f172a',
    backgroundElementMuted: '#1e293b',
    backgroundSelected: '#1e293b',
    overlayScrim: 'rgba(2, 6, 23, 0.74)',
    primary: '#60a5fa',
    onPrimary: '#0b1220',
    linkPrimary: '#93c5fd',
    brandPrimary: '#3b82f6',
    onBrandPrimary: '#f8fafc',
    infoSurface: '#172554',
    onInfoSurface: '#dbeafe',
    successSurface: '#16a34a',
    onSuccessSurface: '#dcfce7',
    dangerSurface: '#7f1d1d',
    onDangerSurface: '#fee2e2',
    warningIcon: '#fbbf24',
    borderMuted: '#334155',
    primaryMuted: 'rgba(96, 165, 250, 0.14)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Consistent corner radii for cards, buttons, and chrome. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Floating card shadow — use on white/slate surfaces (not inside nested cards). */
export function getCardElevation(colorScheme: 'light' | 'dark'): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow:
        colorScheme === 'dark'
          ? '0 12px 40px rgba(0, 0, 0, 0.45)'
          : '0 12px 40px rgba(15, 23, 42, 0.09)',
    } as ViewStyle;
  }
  if (Platform.OS === 'android') {
    return { elevation: colorScheme === 'dark' ? 10 : 5 };
  }
  return {
    shadowColor: colorScheme === 'dark' ? '#000000' : '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.09,
    shadowRadius: 20,
  };
}

/** Space to leave above a bottom tab bar so scroll content is not obscured. */
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 108 }) ?? 0;
export const MaxContentWidth = 800;
