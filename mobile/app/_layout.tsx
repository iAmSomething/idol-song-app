import { Stack } from 'expo-router';

import { LaunchGate } from '../src/components/launch/LaunchGate';
import { PushNotificationRuntimeBoundary } from '../src/components/launch/PushNotificationRuntimeBoundary';
import { MobileThemeProvider } from '../src/tokens/theme';

export default function RootLayout() {
  return (
    <MobileThemeProvider>
      <LaunchGate>
        <PushNotificationRuntimeBoundary>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="artists/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="releases/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="settings/notifications" options={{ headerShown: false }} />
            <Stack.Screen name="debug/metadata" options={{ title: 'Debug Metadata' }} />
          </Stack>
        </PushNotificationRuntimeBoundary>
      </LaunchGate>
    </MobileThemeProvider>
  );
}
