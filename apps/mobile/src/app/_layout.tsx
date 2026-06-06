import { ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { BanyoneAuthProvider } from '@/features/auth/auth-context';
import { GenerationCreditsProvider } from '@/features/create-job/hooks/use-generation-credits';
import { PushLifecycleNotificationsHost } from '@/features/notifications/components/push-lifecycle-notifications-host';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];
  const navigationTheme = React.useMemo<Theme>(
    () => ({
      dark: scheme === 'dark',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.backgroundElement,
        text: colors.text,
        border: colors.borderMuted,
        notification: colors.warningIcon,
      },
      fonts: {
        regular: {
          fontFamily: 'System',
          fontWeight: '400',
        },
        medium: {
          fontFamily: 'System',
          fontWeight: '500',
        },
        bold: {
          fontFamily: 'System',
          fontWeight: '700',
        },
        heavy: {
          fontFamily: 'System',
          fontWeight: '800',
        },
      },
    }),
    [colors, scheme],
  );

  return (
    <BanyoneAuthProvider>
      <GenerationCreditsProvider>
        <PushLifecycleNotificationsHost />
        <ThemeProvider value={navigationTheme}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="paywall"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </ThemeProvider>
      </GenerationCreditsProvider>
    </BanyoneAuthProvider>
  );
}
