import type { RouteResumeTarget } from './routeResume';

export type PushRouteHandlingMode = 'cold_start' | 'background_resume' | 'foreground_open' | 'foreground_dismiss';

export type TrustedPushPayload = {
  notification_event_id?: string | null;
  event_type?: string | null;
  event_reason?: string | null;
  event_reason_value?: string | null;
  destination?: {
    kind?: string | null;
    entity_slug?: string | null;
    release_id?: string | null;
    scheduled_date?: string | null;
    scheduled_month?: string | null;
  } | null;
  entity_slug?: string | null;
  entity_name?: string | null;
  headline?: string | null;
  scheduled_date?: string | null;
  scheduled_month?: string | null;
  date_precision?: string | null;
  date_status?: string | null;
  release_format?: string | null;
  release_id?: string | null;
  source_url?: string | null;
  source_type?: string | null;
};

export type ResolvedPushRoute = {
  target: RouteResumeTarget;
  destinationKind: 'release_detail' | 'entity_detail' | 'calendar';
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readDestination(value: unknown): TrustedPushPayload['destination'] {
  if (!isRecord(value)) {
    return null;
  }

  return {
    kind: asString(value.kind),
    entity_slug: asString(value.entity_slug),
    release_id: asString(value.release_id),
    scheduled_date: asString(value.scheduled_date),
    scheduled_month: asString(value.scheduled_month),
  };
}

export function normalizeTrustedPushPayload(value: unknown): TrustedPushPayload | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    notification_event_id: asString(value.notification_event_id),
    event_type: asString(value.event_type),
    event_reason: asString(value.event_reason),
    event_reason_value: asString(value.event_reason_value),
    destination: readDestination(value.destination),
    entity_slug: asString(value.entity_slug),
    entity_name: asString(value.entity_name),
    headline: asString(value.headline),
    scheduled_date: asString(value.scheduled_date),
    scheduled_month: asString(value.scheduled_month),
    date_precision: asString(value.date_precision),
    date_status: asString(value.date_status),
    release_format: asString(value.release_format),
    release_id: asString(value.release_id),
    source_url: asString(value.source_url),
    source_type: asString(value.source_type),
  };
}

function buildCalendarTarget(payload: TrustedPushPayload): RouteResumeTarget {
  const scheduledDate = payload.destination?.scheduled_date ?? payload.scheduled_date;
  if (scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return {
      pathname: '/(tabs)/calendar',
      params: {
        month: scheduledDate.slice(0, 7),
        date: scheduledDate,
        sheet: 'open',
      },
    };
  }

  const scheduledMonth = payload.destination?.scheduled_month ?? payload.scheduled_month;
  if (scheduledMonth && /^\d{4}-\d{2}$/.test(scheduledMonth)) {
    return {
      pathname: '/(tabs)/calendar',
      params: {
        month: scheduledMonth,
      },
    };
  }

  return {
    pathname: '/(tabs)/calendar',
  };
}

export function resolvePushRouteTarget(payload: TrustedPushPayload | null): ResolvedPushRoute {
  if (!payload) {
    return {
      destinationKind: 'calendar',
      target: buildCalendarTarget({}),
    };
  }

  const destinationKind = payload.destination?.kind;
  const releaseId = payload.destination?.release_id ?? payload.release_id;
  if (destinationKind === 'release_detail' && releaseId) {
    return {
      destinationKind: 'release_detail',
      target: {
        pathname: '/releases/[id]',
        params: {
          id: releaseId,
        },
      },
    };
  }

  const entitySlug = payload.destination?.entity_slug ?? payload.entity_slug;
  if ((destinationKind === 'entity_detail' || destinationKind === null || destinationKind === undefined) && entitySlug) {
    return {
      destinationKind: 'entity_detail',
      target: {
        pathname: '/artists/[slug]',
        params: {
          slug: entitySlug,
        },
      },
    };
  }

  return {
    destinationKind: 'calendar',
    target: buildCalendarTarget(payload),
  };
}
