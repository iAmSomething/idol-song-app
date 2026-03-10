import { parseRuntimeConfig, resolveRuntimeConfigState } from './runtime';

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
        mode: 'backend-api',
        datasetVersion: {},
      },
      services: {
        apiBaseUrl: 'https://example.com/api',
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
        version: '0.1.0',
        commitSha: {},
      },
    });

    expect(parsed.dataSource.datasetVersion).toBeNull();
    expect(parsed.services.analyticsWriteKey).toBeNull();
    expect(parsed.build.version).toBe('0.1.0');
    expect(parsed.build.commitSha).toBeNull();
  });

  test('rejects analytics gate without write key', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'production',
        dataSource: {
          mode: 'backend-api',
          datasetVersion: null,
        },
        services: {
          apiBaseUrl: 'https://example.com/api',
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
          version: '0.1.0',
          commitSha: null,
        },
      }),
    ).toThrow('analyticsWriteKey');
  });

  test('rejects remote refresh gate outright', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'preview',
        dataSource: {
          mode: 'backend-api',
          datasetVersion: null,
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
          commitSha: null,
        },
      }),
    ).toThrow('remoteRefresh');
  });

  test('requires api base url for preview backend mode', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'preview',
        dataSource: {
          mode: 'backend-api',
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
          remoteRefresh: false,
          mvEmbed: true,
          shareActions: true,
        },
        build: {
          version: '0.1.0',
          commitSha: null,
        },
      }),
    ).toThrow('services.apiBaseUrl');
  });

  test('requires build version to be present', () => {
    expect(() =>
      parseRuntimeConfig({
        profile: 'development',
        dataSource: {
          mode: 'bundled-static',
          datasetVersion: null,
        },
        services: {
          apiBaseUrl: null,
          analyticsWriteKey: null,
        },
        logging: {
          level: 'verbose',
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
    ).toThrow('build.version');
  });

  test('degrades safely when runtime config payload is missing', () => {
    const state = resolveRuntimeConfigState(null, 'preview', '0.3.0');

    expect(state.mode).toBe('degraded');
    expect(state.config.profile).toBe('preview');
    expect(state.config.dataSource.mode).toBe('backend-api');
    expect(state.config.featureGates.remoteRefresh).toBe(false);
    expect(state.config.services.analyticsWriteKey).toBeNull();
    expect(state.config.build.version).toBe('0.3.0');
    expect(state.issues).toEqual([
      expect.objectContaining({
        kind: 'missing_runtime_config',
      }),
    ]);
  });

  test('degrades safely when runtime config payload is invalid', () => {
    const state = resolveRuntimeConfigState(
      {
        profile: 'preview',
        dataSource: {
          mode: 'backend-api',
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
          version: '0.1.0',
          commitSha: null,
        },
      },
      'preview',
      '0.1.0',
    );

    expect(state.mode).toBe('degraded');
    expect(state.config.profile).toBe('preview');
    expect(state.config.dataSource.mode).toBe('backend-api');
    expect(state.config.featureGates.analytics).toBe(false);
    expect(state.config.featureGates.remoteRefresh).toBe(false);
    expect(state.issues).toEqual([
      expect.objectContaining({
        kind: 'invalid_runtime_config',
        message: expect.stringContaining('remoteRefresh'),
      }),
    ]);
  });
});
