import type { MobileRuntimeConfig } from '../config/runtime';

import {
  getLatestAnalyticsEvent,
  getRecentAnalyticsEvents,
  resetAnalyticsEvents,
  trackDatasetDegraded,
  trackDatasetLoadFailed,
  trackAnalyticsEvent,
} from './analytics';

const analyticsEnabledRuntime: MobileRuntimeConfig = {
  profile: 'preview',
  dataSource: {
    mode: 'backend-api',
    datasetVersion: 'preview-v1',
  },
  services: {
    apiBaseUrl: 'https://example.com/api',
    analyticsWriteKey: 'write-key',
  },
  logging: {
    level: 'debug',
  },
  featureGates: {
    radar: true,
    analytics: true,
    remoteRefresh: false,
    mvEmbed: true,
    shareActions: true,
  },
  build: {
    version: '0.1.0',
    commitSha: 'abc123',
  },
};

describe('mobile analytics service', () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    resetAnalyticsEvents();
  });

  afterAll(() => {
    consoleInfoSpy.mockRestore();
  });

  test('does not emit events when analytics gate is disabled', () => {
    const emitted = trackAnalyticsEvent(
      'search_submitted',
      {
        query: '최예나',
        submitSource: 'input',
        activeSegment: 'entities',
        resultCounts: {
          entities: 1,
          releases: 0,
          upcoming: 0,
        },
        hadResults: true,
      },
      {
        ...analyticsEnabledRuntime,
        featureGates: {
          ...analyticsEnabledRuntime.featureGates,
          analytics: false,
        },
      },
    );

    expect(emitted).toBe(false);
    expect(getRecentAnalyticsEvents()).toEqual([]);
  });

  test('stores recent events when analytics gate is enabled', () => {
    const emitted = trackAnalyticsEvent(
      'calendar_quick_jump_used',
      {
        target: 'today',
        fromMonth: '2026-04',
        toMonth: '2026-03',
      },
      analyticsEnabledRuntime,
      () => '2026-03-09T00:00:00.000Z',
    );

    expect(emitted).toBe(true);
    expect(getLatestAnalyticsEvent()).toEqual({
      name: 'calendar_quick_jump_used',
      payload: {
        target: 'today',
        fromMonth: '2026-04',
        toMonth: '2026-03',
      },
      occurredAt: '2026-03-09T00:00:00.000Z',
      profile: 'preview',
      dataSourceMode: 'backend-api',
      buildVersion: '0.1.0',
    });
  });

  test('sanitizes query-like payloads before storing them', () => {
    trackAnalyticsEvent(
      'search_submitted',
      {
        query: `  ${'최예나 '.repeat(20)}  `,
        submitSource: 'input',
        activeSegment: 'entities',
        resultCounts: {
          entities: 1,
          releases: 0,
          upcoming: 0,
        },
        hadResults: true,
      },
      analyticsEnabledRuntime,
    );

    expect(getLatestAnalyticsEvent()?.payload).toEqual(
      expect.objectContaining({
        query: expect.stringMatching(/^최예나/),
      }),
    );
    expect((getLatestAnalyticsEvent()?.payload as { query: string }).query.length).toBeLessThanOrEqual(80);
  });

  test('keeps only the most recent 50 events', () => {
    for (let index = 0; index < 55; index += 1) {
      trackAnalyticsEvent(
        'dataset_load_failed',
        {
          surface: 'search',
          errorMessage: `error-${index}`,
        },
        analyticsEnabledRuntime,
        () => `2026-03-09T00:00:${`${index}`.padStart(2, '0')}.000Z`,
      );
    }

    const events = getRecentAnalyticsEvents();
    expect(events).toHaveLength(50);
    expect(events[0]?.payload).toEqual({
      surface: 'search',
      errorMessage: 'error-54',
    });
    expect(events.at(-1)?.payload).toEqual({
      surface: 'search',
      errorMessage: 'error-5',
    });
  });

  test('builds dataset degraded and load failed events from active dataset state', () => {
    trackDatasetDegraded(
      'calendar',
      {
        activeSource: 'bundled-static',
        runtimeState: {
          mode: 'degraded',
          config: analyticsEnabledRuntime,
          issues: [],
        },
        issues: ['Runtime config is degraded.'],
      },
      analyticsEnabledRuntime,
      () => '2026-03-09T00:00:00.000Z',
    );

    trackDatasetLoadFailed(
      'release_detail',
      'Release detail dataset could not be loaded right now.',
      analyticsEnabledRuntime,
      () => '2026-03-09T00:00:01.000Z',
    );

    expect(getRecentAnalyticsEvents().map((event) => event.name)).toEqual([
      'failure_observed',
      'dataset_load_failed',
      'failure_observed',
      'dataset_degraded',
    ]);
    expect(getRecentAnalyticsEvents()[1]?.payload).toEqual({
      surface: 'release_detail',
      errorMessage: 'Release detail dataset could not be loaded right now.',
    });
    expect(getLatestAnalyticsEvent()).toEqual(
      expect.objectContaining({
        name: 'failure_observed',
        payload: {
          surface: 'release_detail',
          category: 'blocking',
          code: 'dataset_load_failed',
          retryable: true,
        },
      }),
    );
  });
});
