import { parseRuntimeConfig } from './runtime';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

describe('parseRuntimeConfig', () => {
  test('normalizes Expo empty-object optional fields to null', () => {
    const parsed = parseRuntimeConfig({
      profile: 'preview',
      dataSource: {
        mode: 'preview-static',
        remoteDatasetUrl: {},
        datasetVersion: {},
      },
      services: {
        apiBaseUrl: {},
        analyticsWriteKey: {},
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
        commitSha: {},
      },
    });

    expect(parsed.dataSource.remoteDatasetUrl).toBeNull();
    expect(parsed.dataSource.datasetVersion).toBeNull();
    expect(parsed.services.apiBaseUrl).toBeNull();
    expect(parsed.services.analyticsWriteKey).toBeNull();
    expect(parsed.build.commitSha).toBeNull();
  });

  test('rejects analytics gate without write key', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'production',
        dataSource: {
          mode: 'production-static',
          remoteDatasetUrl: null,
          datasetVersion: null,
        },
        services: {
          apiBaseUrl: null,
          analyticsWriteKey: null,
        },
        logging: {
          level: 'error',
        },
        featureGates: {
          radar: true,
          analytics: true,
          remoteRefresh: false,
          mvEmbed: true,
          shareActions: true,
        },
        build: {
          commitSha: null,
        },
      }),
    ).toThrow('analyticsWriteKey');
  });

  test('rejects remote refresh without remote dataset url', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'preview',
        dataSource: {
          mode: 'preview-static',
          remoteDatasetUrl: null,
          datasetVersion: null,
        },
        services: {
          apiBaseUrl: null,
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
          commitSha: null,
        },
      }),
    ).toThrow('remoteDatasetUrl');
  });

  test('rejects remote dataset settings outside preview profile', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'production',
        dataSource: {
          mode: 'production-static',
          remoteDatasetUrl: 'https://example.com/dataset.json',
          datasetVersion: 'preview-v1',
        },
        services: {
          apiBaseUrl: null,
          analyticsWriteKey: null,
        },
        logging: {
          level: 'error',
        },
        featureGates: {
          radar: true,
          analytics: false,
          remoteRefresh: false,
          mvEmbed: true,
          shareActions: true,
        },
        build: {
          commitSha: null,
        },
      }),
    ).toThrow('remoteDatasetUrl');
  });
});
