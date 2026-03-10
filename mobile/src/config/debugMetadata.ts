import {
  getRuntimeConfig,
  getRuntimeConfigState,
  type MobileRuntimeConfig,
  type RuntimeConfigState,
} from './runtime';
import { getLatestAnalyticsEvent, getRecentAnalyticsEvents } from '../services/analytics';

export type MobileDebugMetadata = {
  profile: MobileRuntimeConfig['profile'];
  runtimeMode: RuntimeConfigState['mode'];
  runtimeIssues: string[];
  runtimeIssueCount: number;
  buildVersion: string;
  datasetVersion: string | null;
  commitSha: string | null;
  dataSourceMode: MobileRuntimeConfig['dataSource']['mode'];
  dataSourcePolicy: string;
  apiBaseUrl: string | null;
  apiHost: string | null;
  analyticsEnabled: boolean;
  radarEnabled: boolean;
  featureGateSummary: string;
  analyticsEventCount: number;
  latestAnalyticsEvent: string | null;
};

export function isDebugMetadataAvailable(runtimeConfig: MobileRuntimeConfig = getRuntimeConfig()): boolean {
  return runtimeConfig.profile !== 'production';
}

export function getDebugMetadata(
  runtimeState: RuntimeConfigState = getRuntimeConfigState(),
): MobileDebugMetadata {
  const runtimeConfig = runtimeState.config;
  const recentAnalyticsEvents = getRecentAnalyticsEvents();
  const latestAnalyticsEvent = getLatestAnalyticsEvent();

  return {
    profile: runtimeConfig.profile,
    runtimeMode: runtimeState.mode,
    runtimeIssues: runtimeState.issues.map((issue) => issue.message),
    runtimeIssueCount: runtimeState.issues.length,
    buildVersion: runtimeConfig.build.version,
    datasetVersion: runtimeConfig.dataSource.datasetVersion,
    commitSha: runtimeConfig.build.commitSha,
    dataSourceMode: runtimeConfig.dataSource.mode,
    dataSourcePolicy:
      runtimeConfig.dataSource.mode === 'backend-api'
        ? 'Backend API primary + bundled fallback'
        : 'Bundled static primary',
    apiBaseUrl: runtimeConfig.services.apiBaseUrl,
    apiHost: runtimeConfig.services.apiBaseUrl ? new URL(runtimeConfig.services.apiBaseUrl).host : null,
    analyticsEnabled: runtimeConfig.featureGates.analytics,
    radarEnabled: runtimeConfig.featureGates.radar,
    featureGateSummary: Object.entries(runtimeConfig.featureGates)
      .map(([key, enabled]) => `${key}:${enabled ? 'on' : 'off'}`)
      .join(', '),
    analyticsEventCount: recentAnalyticsEvents.length,
    latestAnalyticsEvent: latestAnalyticsEvent
      ? `${latestAnalyticsEvent.name} @ ${latestAnalyticsEvent.occurredAt}`
      : null,
  };
}
