import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { BanyoneAuthProvider } from '@/features/auth/auth-context';
import { PushLifecycleNotificationsHost } from '@/features/notifications/components/push-lifecycle-notifications-host';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <BanyoneAuthProvider>
      <PushLifecycleNotificationsHost />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </BanyoneAuthProvider>
  );
}
