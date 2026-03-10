import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getDebugMetadata, isDebugMetadataAvailable } from '../../src/config/debugMetadata';

export default function DebugMetadataScreen() {
  const available = isDebugMetadataAvailable();
  const metadata = getDebugMetadata();
  const rows = [
    ['Profile', metadata.profile],
    ['Runtime mode', metadata.runtimeMode],
    ['Runtime issue count', `${metadata.runtimeIssueCount}`],
    ['Runtime issues', metadata.runtimeIssues.length > 0 ? metadata.runtimeIssues.join(' | ') : 'None'],
    ['Build version', metadata.buildVersion],
    ['Dataset version', metadata.datasetVersion ?? 'Unavailable'],
    ['Commit hash', metadata.commitSha ?? 'Unavailable'],
    ['Data source mode', metadata.dataSourceMode],
    ['Data source policy', metadata.dataSourcePolicy],
    ['API base URL', metadata.apiBaseUrl ?? 'Bundled-only'],
    ['API host', metadata.apiHost ?? 'Bundled-only'],
    ['Analytics enabled', metadata.analyticsEnabled ? 'Yes' : 'No'],
    ['Feature gates', metadata.featureGateSummary],
    ['Analytics event count', `${metadata.analyticsEventCount}`],
    ['Latest analytics event', metadata.latestAnalyticsEvent ?? 'None'],
  ] as const;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Debug Metadata' }} />
      <Text style={styles.eyebrow}>DEBUG ONLY</Text>
      <Text style={styles.title}>Runtime Metadata</Text>
      <Text style={styles.body}>
        {available
          ? 'This route is for internal preview/development inspection only and is intentionally not linked from the main user-facing tabs.'
          : 'Debug metadata is intentionally hidden from production user surfaces. Use preview or development builds for runtime inspection.'}
      </Text>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f7f6f2',
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
    marginBottom: 18,
    fontSize: 16,
    lineHeight: 24,
    color: '#5e554d',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd5cd',
    backgroundColor: '#fffcf7',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  row: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#87634d',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1f1b17',
  },
});
