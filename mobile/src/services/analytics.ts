import type { MobileRuntimeConfig } from '../config/runtime';
import { getRuntimeConfig } from '../config/runtime';
import type { ScreenDataSource } from '../features/screenDataSource';

import type { ExternalLinkFailureCode } from './externalLinks';
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
export type ObservabilityFailureCategory = 'blocking' | 'degraded' | 'external_failure' | 'data_quality';

export type AnalyticsEventMap = {
  calendar_viewed: {
    currentMonth: string;
  };
  radar_viewed: {
    enabledSections: number;
  };
  search_viewed: {
    activeSegment: SearchSegment;
  };
  team_detail_viewed: {
    teamSlug: string;
  };
  release_detail_viewed: {
    releaseId: string;
  };
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
  radar_filter_applied: {
    statusFilter: string;
    actTypeFilter: string;
    enabledSections: string[];
  };
  radar_card_opened: {
    section: 'featured_upcoming' | 'weekly_upcoming' | 'change_feed' | 'long_gap' | 'rookie';
    teamSlug: string;
  };
  team_detail_latest_release_opened: {
    teamSlug: string;
    releaseId: string;
  };
  team_detail_album_opened: {
    teamSlug: string;
    releaseId: string;
  };
  release_detail_track_service_opened: {
    releaseId: string;
    trackTitle: string;
    service: MusicService;
    mode: ServiceHandoffMode;
  };
  release_detail_album_service_opened: {
    releaseId: string;
    service: MusicService;
    mode: ServiceHandoffMode;
  };
  release_detail_mv_opened: {
    releaseId: string;
    mode: ServiceHandoffMode;
  };
  source_link_opened: {
    surface: AnalyticsSurface;
    linkType: 'official' | 'source' | 'artist_source';
    host: string | null;
    ok: boolean;
    failureCode: ExternalLinkFailureCode | null;
  };
  service_handoff_attempted: {
    surface: AnalyticsSurface;
    service: MusicService;
    mode: ServiceHandoffMode;
  };
  service_handoff_opened: {
    surface: AnalyticsSurface;
    service: MusicService;
    mode: ServiceHandoffMode;
    target: ServiceHandoffTarget;
  };
  service_handoff_failed: {
    surface: AnalyticsSurface;
    service: MusicService;
    mode: ServiceHandoffMode;
    failureCode: ServiceHandoffFailureCode;
    retryable: boolean;
  };
  service_handoff_completed: {
    surface: AnalyticsSurface;
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
  failure_observed: {
    surface: AnalyticsSurface;
    category: ObservabilityFailureCategory;
    code: string;
    retryable: boolean;
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
const MAX_ANALYTICS_QUERY_LENGTH = 80;
const MAX_ANALYTICS_TEXT_LENGTH = 120;

let recentAnalyticsEvents: AnalyticsEventRecord[] = [];

function pushDebugEvent(event: AnalyticsEventRecord): void {
  recentAnalyticsEvents = [event, ...recentAnalyticsEvents].slice(0, MAX_DEBUG_EVENTS);
}

function sanitizeText(value: string, maxLength: number = MAX_ANALYTICS_TEXT_LENGTH): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function sanitizeAnalyticsPayload<Name extends AnalyticsEventName>(
  name: Name,
  payload: AnalyticsEventMap[Name],
): AnalyticsEventMap[Name] {
  switch (name) {
    case 'search_submitted': {
      const currentPayload = payload as AnalyticsEventMap['search_submitted'];
      return {
        ...currentPayload,
        query: sanitizeText(currentPayload.query, MAX_ANALYTICS_QUERY_LENGTH),
      } as AnalyticsEventMap[Name];
    }
    case 'search_result_opened': {
      const currentPayload = payload as AnalyticsEventMap['search_result_opened'];
      return {
        ...currentPayload,
        query: sanitizeText(currentPayload.query, MAX_ANALYTICS_QUERY_LENGTH),
      } as AnalyticsEventMap[Name];
    }
    case 'release_detail_track_service_opened': {
      const currentPayload = payload as AnalyticsEventMap['release_detail_track_service_opened'];
      return {
        ...currentPayload,
        trackTitle: sanitizeText(currentPayload.trackTitle, MAX_ANALYTICS_QUERY_LENGTH),
      } as AnalyticsEventMap[Name];
    }
    case 'dataset_load_failed': {
      const currentPayload = payload as AnalyticsEventMap['dataset_load_failed'];
      return {
        ...currentPayload,
        errorMessage: sanitizeText(currentPayload.errorMessage),
      } as AnalyticsEventMap[Name];
    }
    case 'failure_observed': {
      const currentPayload = payload as AnalyticsEventMap['failure_observed'];
      return {
        ...currentPayload,
        code: sanitizeText(currentPayload.code, 64),
      } as AnalyticsEventMap[Name];
    }
    default:
      return payload;
  }
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
    payload: sanitizeAnalyticsPayload(name, payload),
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
  source: Pick<ScreenDataSource, 'activeSource' | 'issues' | 'runtimeState'>,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now?: () => string,
): boolean {
  const emitted = trackAnalyticsEvent(
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

  trackFailureObserved(surface, 'degraded', 'dataset_degraded', false, runtimeConfig, now);
  return emitted;
}

export function trackDatasetLoadFailed(
  surface: AnalyticsSurface,
  errorMessage: string,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now?: () => string,
): boolean {
  const emitted = trackAnalyticsEvent(
    'dataset_load_failed',
    {
      surface,
      errorMessage,
    },
    runtimeConfig,
    now,
  );

  trackFailureObserved(surface, 'blocking', 'dataset_load_failed', true, runtimeConfig, now);
  return emitted;
}

export function trackFailureObserved(
  surface: AnalyticsSurface,
  category: ObservabilityFailureCategory,
  code: string,
  retryable: boolean,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  now?: () => string,
): boolean {
  return trackAnalyticsEvent(
    'failure_observed',
    {
      surface,
      category,
      code,
      retryable,
    },
    runtimeConfig,
    now,
  );
}

export function classifyServiceHandoffFailureCategory(
  code: ServiceHandoffFailureCode,
): ObservabilityFailureCategory {
  if (code === 'handoff_unavailable') {
    return 'data_quality';
  }

  return 'external_failure';
}

export function classifyExternalLinkFailureCategory(
  code: ExternalLinkFailureCode,
): ObservabilityFailureCategory {
  if (code === 'external_link_open_failed') {
    return 'external_failure';
  }

  return 'data_quality';
}
