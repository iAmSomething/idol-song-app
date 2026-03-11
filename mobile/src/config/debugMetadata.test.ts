import type { MobileRuntimeConfig, RuntimeConfigState } from './runtime';
import { getDebugMetadata, isDebugMetadataAvailable } from './debugMetadata';
import { resetAnalyticsEvents, trackAnalyticsEvent } from '../services/analytics';

const previewRuntimeConfig: MobileRuntimeConfig = {
  profile: 'preview',
  dataSource: {
    mode: 'backend-api',
    datasetVersion: 'preview-v1',
  },
  services: {
    apiBaseUrl: 'https://example.com/api',
    analyticsWriteKey: null,
    expoProjectId: null,
  },
  logging: {
    level: 'debug',
  },
  featureGates: {
    radar: true,
    analytics: false,
    remoteRefresh: false,
    mvEmbed: true,
    shareActions: true,
  },
  build: {
    version: '0.1.0',
    commitSha: 'abc123',
  },
};

const previewRuntimeState: RuntimeConfigState = {
  mode: 'normal',
  config: previewRuntimeConfig,
  issues: [],
};

describe('debug metadata helpers', () => {
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

  test('returns the stable debug metadata fields for preview builds', () => {
    trackAnalyticsEvent(
      'dataset_degraded',
      {
        surface: 'search',
        activeSource: 'bundled-static',
        runtimeMode: 'normal',
        issueCount: 1,
      },
      {
        ...previewRuntimeConfig,
        services: {
          ...previewRuntimeConfig.services,
          analyticsWriteKey: 'write-key',
        },
        featureGates: {
          ...previewRuntimeConfig.featureGates,
          analytics: true,
        },
      },
      () => '2026-03-09T00:00:00.000Z',
    );

    expect(getDebugMetadata(previewRuntimeState)).toEqual({
      profile: 'preview',
      runtimeMode: 'normal',
      runtimeIssues: [],
      runtimeIssueCount: 0,
      buildVersion: '0.1.0',
      datasetVersion: 'preview-v1',
      commitSha: 'abc123',
      dataSourceMode: 'backend-api',
      dataSourcePolicy: 'Backend API primary + bundled fallback',
      networkPolicy: 'GET timeout 4.5s + 1 retry + cache/bundled degraded fallback',
      apiBaseUrl: 'https://example.com/api',
      apiHost: 'example.com',
      backendTargetLabel: 'Custom backend target',
      analyticsEnabled: false,
      radarEnabled: true,
      featureGateSummary: 'radar:on, analytics:off, remoteRefresh:off, mvEmbed:on, shareActions:on',
      analyticsEventCount: 1,
      latestAnalyticsEvent: 'dataset_degraded @ 2026-03-09T00:00:00.000Z',
    });
  });

  test('labels the stable preview backend and tunnel fallback distinctly', () => {
    expect(
      getDebugMetadata({
        ...previewRuntimeState,
        config: {
          ...previewRuntimeConfig,
          services: {
            ...previewRuntimeConfig.services,
            apiBaseUrl: 'https://api.idol-song-app.example.com',
          },
        },
      }).backendTargetLabel,
    ).toBe('Public preview backend');

    expect(
      getDebugMetadata({
        ...previewRuntimeState,
        config: {
          ...previewRuntimeConfig,
          services: {
            ...previewRuntimeConfig.services,
            apiBaseUrl: 'https://idol-song-app-preview.trycloudflare.com',
          },
        },
      }).backendTargetLabel,
    ).toBe('Temporary tunnel backend');
  });

  test('keeps the metadata surface unavailable for production profile', () => {
    expect(isDebugMetadataAvailable(previewRuntimeConfig)).toBe(true);
    expect(
      isDebugMetadataAvailable({
        ...previewRuntimeConfig,
        profile: 'production',
      }),
    ).toBe(false);
  });
});
