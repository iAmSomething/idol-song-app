import { Stack } from 'expo-router';

import { MobileThemeProvider } from '../src/tokens/theme';

export default function RootLayout() {
  return (
    <MobileThemeProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="artists/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="releases/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="debug/metadata" options={{ title: 'Debug Metadata' }} />
      </Stack>
    </MobileThemeProvider>
  );
}
