import type { MobileRuntimeConfig, RuntimeConfigState } from './runtime';
import { getDebugMetadata, isDebugMetadataAvailable } from './debugMetadata';

const previewRuntimeConfig: MobileRuntimeConfig = {
  profile: 'preview',
  dataSource: {
    mode: 'preview-static',
    remoteDatasetUrl: 'https://example.com/dataset.json',
    datasetVersion: 'preview-v1',
  },
  services: {
    apiBaseUrl: 'https://example.com/api',
    analyticsWriteKey: null,
  },
  logging: {
    level: 'debug',
  },
  featureGates: {
    radar: true,
    analytics: false,
    remoteRefresh: true,
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
  test('returns the stable debug metadata fields for preview builds', () => {
    expect(getDebugMetadata(previewRuntimeState)).toEqual({
      profile: 'preview',
      runtimeMode: 'normal',
      runtimeIssues: [],
      buildVersion: '0.1.0',
      datasetVersion: 'preview-v1',
      commitSha: 'abc123',
      dataSourceMode: 'preview-static',
      remoteDatasetUrl: 'https://example.com/dataset.json',
      analyticsEnabled: false,
      radarEnabled: true,
    });
  });

  test('keeps the metadata surface unavailable for production profile', () => {
    expect(isDebugMetadataAvailable(previewRuntimeConfig)).toBe(true);
    expect(
      isDebugMetadataAvailable({
        ...previewRuntimeConfig,
        profile: 'production',
        dataSource: {
          ...previewRuntimeConfig.dataSource,
          mode: 'production-static',
          remoteDatasetUrl: null,
        },
      }),
    ).toBe(false);
  });
});
