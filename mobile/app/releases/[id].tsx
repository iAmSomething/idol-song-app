import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default function ReleaseDetailPlaceholderScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = getSingleParam(params.id);
  const isValid = typeof id === 'string' && id.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: isValid ? id : 'Release Detail' }} />
      <Text style={styles.eyebrow}>PUSH DETAIL</Text>
      <Text style={styles.title}>Release Detail</Text>
      <Text style={styles.body}>
        {isValid
          ? `id param is wired: ${id}`
          : 'Missing or invalid id. The final screen should show a safe empty or recovery state instead of crashing.'}
      </Text>
      <Text style={styles.meta}>Path contract: /releases/[id]</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fcfbf8',
  },
  eyebrow: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#87634d',
  },
  title: {
    marginBottom: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1b17',
  },
  body: {
    marginBottom: 12,
    fontSize: 16,
    lineHeight: 24,
    color: '#5e554d',
  },
  meta: {
    fontSize: 13,
    color: '#8a7e72',
  },
});
