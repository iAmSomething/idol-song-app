import type { MobileRuntimeConfig } from '../config/runtime';

import {
  BUNDLED_DATASET_BASE_PATH,
  DATASET_ARTIFACTS,
  DATASET_CONTRACT_ID,
  isBackendDatasetSelection,
  isBundledDatasetSelection,
  selectDatasetSource,
} from './datasetSource';

function buildRuntimeConfig(
  overrides: Partial<MobileRuntimeConfig> = {},
  dataSourceOverrides: Partial<MobileRuntimeConfig['dataSource']> = {},
): MobileRuntimeConfig {
  const profile = overrides.profile ?? 'development';

  return {
    profile,
    dataSource: {
      mode: profile === 'development' ? 'bundled-static' : 'backend-api',
      datasetVersion: 'v1-test',
      ...dataSourceOverrides,
    },
    services: {
      apiBaseUrl: profile === 'development' ? null : 'https://example.com/api',
      analyticsWriteKey: null,
      expoProjectId: null,
      ...overrides.services,
    },
    logging: {
      level: profile === 'production' ? 'error' : 'debug',
      ...overrides.logging,
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
      commitSha: 'test-sha',
      ...overrides.build,
    },
  };
}

describe('selectDatasetSource', () => {
  test('uses the bundled dataset for development builds', () => {
    const selection = selectDatasetSource(buildRuntimeConfig());

    expect(isBundledDatasetSelection(selection)).toBe(true);
    if (!isBundledDatasetSelection(selection)) {
      throw new Error('Expected development selection to use bundled-static.');
    }

    expect(selection.kind).toBe('bundled-static');
    expect(selection.reason).toBe('profile_default');
    expect(selection.bundledBasePath).toBe(BUNDLED_DATASET_BASE_PATH);
    expect(selection.contractId).toBe(DATASET_CONTRACT_ID);
    expect(selection.mixingAllowed).toBe(false);
  });

  test('uses backend selection as the primary source when runtime prefers backend api', () => {
    const selection = selectDatasetSource(
      buildRuntimeConfig({ profile: 'preview' }, { mode: 'backend-api', datasetVersion: 'preview-v2' }),
    );

    expect(isBackendDatasetSelection(selection)).toBe(true);
    if (!isBackendDatasetSelection(selection)) {
      throw new Error('Expected preview selection to use backend-api.');
    }

    expect(selection.kind).toBe('backend-api');
    expect(selection.reason).toBe('profile_default');
    expect(selection.datasetVersion).toBe('preview-v2');
    expect(selection.apiBaseUrl).toBe('https://example.com/api');
    expect(selection.bundledFallbackBasePath).toBe(BUNDLED_DATASET_BASE_PATH);
  });

  test('preserves artifact contract across development and backend-primary selections', () => {
    const development = selectDatasetSource(buildRuntimeConfig());
    const preview = selectDatasetSource(buildRuntimeConfig({ profile: 'preview' }));

    expect(development.contractId).toBe(DATASET_CONTRACT_ID);
    expect(preview.contractId).toBe(DATASET_CONTRACT_ID);
    expect(development.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
    expect(preview.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
  });
});
