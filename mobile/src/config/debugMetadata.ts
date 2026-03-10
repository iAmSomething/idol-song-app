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
  buildVersion: string;
  datasetVersion: string | null;
  commitSha: string | null;
  dataSourceMode: MobileRuntimeConfig['dataSource']['mode'];
  dataSourcePolicy: string;
  apiBaseUrl: string | null;
  analyticsEnabled: boolean;
  radarEnabled: boolean;
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
    buildVersion: runtimeConfig.build.version,
    datasetVersion: runtimeConfig.dataSource.datasetVersion,
    commitSha: runtimeConfig.build.commitSha,
    dataSourceMode: runtimeConfig.dataSource.mode,
    dataSourcePolicy:
      runtimeConfig.dataSource.mode === 'backend-api'
        ? 'Backend API primary + bundled fallback'
        : 'Bundled static primary',
    apiBaseUrl: runtimeConfig.services.apiBaseUrl,
    analyticsEnabled: runtimeConfig.featureGates.analytics,
    radarEnabled: runtimeConfig.featureGates.radar,
    analyticsEventCount: recentAnalyticsEvents.length,
    latestAnalyticsEvent: latestAnalyticsEvent
      ? `${latestAnalyticsEvent.name} @ ${latestAnalyticsEvent.occurredAt}`
      : null,
  };
}
