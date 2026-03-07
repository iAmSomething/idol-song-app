import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="artists/[slug]" options={{ title: 'Artist Detail' }} />
      <Stack.Screen name="releases/[id]" options={{ title: 'Release Detail' }} />
    </Stack>
  );
}
