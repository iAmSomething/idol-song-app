import {
  normalizeTrustedPushPayload,
  resolvePushRouteTarget,
} from './pushNotificationRouting';

describe('push notification routing', () => {
  test('normalizes trusted push payload fields', () => {
    expect(
      normalizeTrustedPushPayload({
        event_type: 'trusted_upcoming_signal',
        entity_slug: 'yena',
        destination: {
          kind: 'entity_detail',
          entity_slug: 'yena',
        },
      }),
    ).toEqual({
      notification_event_id: null,
      event_type: 'trusted_upcoming_signal',
      event_reason: null,
      event_reason_value: null,
      destination: {
        kind: 'entity_detail',
        entity_slug: 'yena',
        release_id: null,
        scheduled_date: null,
        scheduled_month: null,
      },
      entity_slug: 'yena',
      entity_name: null,
      headline: null,
      scheduled_date: null,
      scheduled_month: null,
      date_precision: null,
      date_status: null,
      release_format: null,
      release_id: null,
      source_url: null,
      source_type: null,
    });
  });

  test('routes canonical release destinations to release detail', () => {
    const resolved = resolvePushRouteTarget({
      destination: {
        kind: 'release_detail',
        release_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    expect(resolved).toEqual({
      destinationKind: 'release_detail',
      target: {
        pathname: '/releases/[id]',
        params: {
          id: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    });
  });

  test('routes entity destinations to team detail', () => {
    const resolved = resolvePushRouteTarget({
      destination: {
        kind: 'entity_detail',
        entity_slug: 'blackpink',
      },
    });

    expect(resolved).toEqual({
      destinationKind: 'entity_detail',
      target: {
        pathname: '/artists/[slug]',
        params: {
          slug: 'blackpink',
        },
      },
    });
  });

  test('falls back to calendar exact date for scheduled alerts', () => {
    const resolved = resolvePushRouteTarget({
      scheduled_date: '2026-03-11',
    });

    expect(resolved).toEqual({
      destinationKind: 'calendar',
      target: {
        pathname: '/(tabs)/calendar',
        params: {
          month: '2026-03',
          date: '2026-03-11',
          sheet: 'open',
        },
      },
    });
  });

  test('falls back to calendar month when only a month bucket exists', () => {
    const resolved = resolvePushRouteTarget({
      scheduled_month: '2026-04',
    });

    expect(resolved).toEqual({
      destinationKind: 'calendar',
      target: {
        pathname: '/(tabs)/calendar',
        params: {
          month: '2026-04',
        },
      },
    });
  });
});
