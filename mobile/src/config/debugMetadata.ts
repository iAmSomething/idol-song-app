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
  networkPolicy: string;
  apiBaseUrl: string | null;
  apiHost: string | null;
  backendTargetLabel:
    | 'Missing backend target'
    | 'Public preview backend'
    | 'Temporary tunnel backend'
    | 'Custom backend target';
  analyticsEnabled: boolean;
  radarEnabled: boolean;
  featureGateSummary: string;
  analyticsEventCount: number;
  latestAnalyticsEvent: string | null;
};

const LEGACY_PUBLIC_PREVIEW_API_HOST = 'api.idol-song-app.example.com';
const TUNNEL_API_HOST_SUFFIXES = ['trycloudflare.com', 'ngrok-free.app', 'ngrok.io', 'loca.lt'] as const;

function getBackendTargetLabel(apiBaseUrl: string | null): MobileDebugMetadata['backendTargetLabel'] {
  if (!apiBaseUrl) {
    return 'Missing backend target';
  }

  const host = new URL(apiBaseUrl).host;
  if (TUNNEL_API_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return 'Temporary tunnel backend';
  }

  if (host === LEGACY_PUBLIC_PREVIEW_API_HOST) {
    return 'Public preview backend';
  }

  if (host.endsWith('.up.railway.app') && !host.includes('production')) {
    return 'Public preview backend';
  }

  return 'Custom backend target';
}

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
    dataSourcePolicy: 'Backend API only',
    networkPolicy: 'GET timeout 4.5s + 1 retry + cache or explicit error',
    apiBaseUrl: runtimeConfig.services.apiBaseUrl,
    apiHost: runtimeConfig.services.apiBaseUrl ? new URL(runtimeConfig.services.apiBaseUrl).host : null,
    backendTargetLabel: getBackendTargetLabel(runtimeConfig.services.apiBaseUrl),
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
