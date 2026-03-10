import type { MobileRuntimeConfig } from '../config/runtime';
import { getRuntimeConfig } from '../config/runtime';
import type { ActiveMobileDataset } from './activeDataset';

import type {
  MusicService,
  ServiceHandoffFailureCode,
  ServiceHandoffMode,
  ServiceHandoffTarget,
} from './handoff';

export type AnalyticsSurface =
  | 'search'
  | 'calendar'
  | 'radar'
  | 'entity_detail'
  | 'release_detail';

export type SearchSegment = 'entities' | 'releases' | 'upcoming';
export type CalendarFilterMode = 'all' | 'releases' | 'upcoming';
export type SearchSubmitSource = 'input' | 'recent';

export type AnalyticsEventMap = {
  search_submitted: {
    query: string;
    submitSource: 'input' | 'recent';
    activeSegment: SearchSegment;
    resultCounts: {
      entities: number;
      releases: number;
      upcoming: number;
    };
    hadResults: boolean;
  };
  search_result_opened: {
    query: string;
    activeSegment: SearchSegment;
    resultType: 'team' | 'release' | 'upcoming';
    targetId: string;
    matchKind: string;
  };
  calendar_date_drill_opened: {
    date: string;
    source: 'grid' | 'nearest_upcoming';
    filterMode: CalendarFilterMode;
    releaseCount: number;
    upcomingCount: number;
  };
  calendar_quick_jump_used: {
    target: 'today' | 'nearest_upcoming';
    fromMonth: string;
    toMonth: string;
  };
  calendar_filter_changed: {
    filterMode: CalendarFilterMode;
    month: string;
  };
  service_handoff_attempted: {
    surface: 'release_detail';
    service: MusicService;
    mode: ServiceHandoffMode;
  };
  service_handoff_completed: {
    surface: 'release_detail';
    service: MusicService;
    mode: ServiceHandoffMode;
    ok: boolean;
    target: ServiceHandoffTarget | null;
    failureCode: ServiceHandoffFailureCode | null;
  };
  dataset_degraded: {
    surface: AnalyticsSurface;
    activeSource: string;
    runtimeMode: 'normal' | 'degraded';
    issueCount: number;
  };
  dataset_load_failed: {
    surface: AnalyticsSurface;
    errorMessage: string;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export type AnalyticsEventRecord<Name extends AnalyticsEventName = AnalyticsEventName> = {
  name: Name;
  payload: AnalyticsEventMap[Name];
  occurredAt: string;
  profile: MobileRuntimeConfig['profile'];
  dataSourceMode: MobileRuntimeConfig['dataSource']['mode'];
  buildVersion: string;
};

const MAX_DEBUG_EVENTS = 50;

let recentAnalyticsEvents: AnalyticsEventRecord[] = [];

function pushDebugEvent(event: AnalyticsEventRecord): void {
  recentAnalyticsEvents = [event, ...recentAnalyticsEvents].slice(0, MAX_DEBUG_EVENTS);
}

export function trackAnalyticsEvent<Name extends AnalyticsEventName>(
  name: Name,
  payload: AnalyticsEventMap[Name],
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now: () => string = () => new Date().toISOString(),
): boolean {
  if (!runtimeConfig.featureGates.analytics) {
    return false;
  }

  const event: AnalyticsEventRecord<Name> = {
    name,
    payload,
    occurredAt: now(),
    profile: runtimeConfig.profile,
    dataSourceMode: runtimeConfig.dataSource.mode,
    buildVersion: runtimeConfig.build.version,
  };

  pushDebugEvent(event);

  if (runtimeConfig.logging.level !== 'error') {
    console.info('[mobile-analytics]', event.name, event.payload);
  }

  return true;
}

export function getRecentAnalyticsEvents(): AnalyticsEventRecord[] {
  return [...recentAnalyticsEvents];
}

export function getLatestAnalyticsEvent(): AnalyticsEventRecord | null {
  return recentAnalyticsEvents[0] ?? null;
}

export function resetAnalyticsEvents(): void {
  recentAnalyticsEvents = [];
}

export function trackDatasetDegraded(
  surface: AnalyticsSurface,
  source: Pick<ActiveMobileDataset, 'activeSource' | 'issues' | 'runtimeState'>,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now?: () => string,
): boolean {
  return trackAnalyticsEvent(
    'dataset_degraded',
    {
      surface,
      activeSource: source.activeSource,
      runtimeMode: source.runtimeState.mode,
      issueCount: source.issues.length,
    },
    runtimeConfig,
    now,
  );
}

export function trackDatasetLoadFailed(
  surface: AnalyticsSurface,
  errorMessage: string,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now?: () => string,
): boolean {
  return trackAnalyticsEvent(
    'dataset_load_failed',
    {
      surface,
      errorMessage,
    },
    runtimeConfig,
    now,
  );
}
