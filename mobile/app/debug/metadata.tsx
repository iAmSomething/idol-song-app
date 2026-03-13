import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MOBILE_TEXT_SCALE_LIMITS } from '../../src/tokens/accessibility';
import { useAppTheme, type MobileTheme } from '../../src/tokens/theme';
import { getDebugMetadata, isDebugMetadataAvailable } from '../../src/config/debugMetadata';

export default function DebugMetadataScreen() {
  const available = isDebugMetadataAvailable();
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (!available) {
    return <Redirect href="/(tabs)/calendar" />;
  }

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
    ['Backend target', metadata.backendTargetLabel],
    ['API base URL', metadata.apiBaseUrl ?? 'Not configured'],
    ['API host', metadata.apiHost ?? 'Not configured'],
    ['Analytics enabled', metadata.analyticsEnabled ? 'Yes' : 'No'],
    ['Feature gates', metadata.featureGateSummary],
    ['Analytics event count', `${metadata.analyticsEventCount}`],
    ['Latest analytics event', metadata.latestAnalyticsEvent ?? 'None'],
  ] as const;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Debug Metadata' }} />
      <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.eyebrow}>DEBUG ONLY</Text>
      <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.screenTitle} style={styles.title}>Runtime Metadata</Text>
      <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.body}>
        This route is for internal preview/development inspection only and is intentionally not linked from the main user-facing tabs.
      </Text>
      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.meta} style={styles.label}>{label}</Text>
            <Text allowFontScaling maxFontSizeMultiplier={MOBILE_TEXT_SCALE_LIMITS.body} style={styles.value}>{value}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(theme: MobileTheme) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.space[24],
      paddingVertical: theme.space[24],
      backgroundColor: theme.colors.surface.base,
    },
    eyebrow: {
      marginBottom: theme.space[8],
      ...theme.typography.meta,
      letterSpacing: 1.2,
      color: theme.colors.text.brand,
    },
    title: {
      marginBottom: theme.space[12],
      ...theme.typography.screenTitle,
      color: theme.colors.text.primary,
    },
    body: {
      marginBottom: theme.space[16],
      ...theme.typography.body,
      color: theme.colors.text.secondary,
    },
    card: {
      borderRadius: theme.radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.surface.elevated,
      paddingHorizontal: theme.space[16],
      paddingVertical: theme.space[12],
      gap: theme.space[12],
    },
    row: {
      gap: theme.space[4],
    },
    label: {
      ...theme.typography.meta,
      letterSpacing: 0.8,
      color: theme.colors.text.brand,
      textTransform: 'uppercase',
    },
    value: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
    },
  });
}
