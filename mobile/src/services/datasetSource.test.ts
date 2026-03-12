import type { MobileRuntimeConfig } from '../config/runtime';

import {
  DATASET_ARTIFACTS,
  DATASET_CONTRACT_ID,
  isBackendDatasetSelection,
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
      mode: 'backend-api',
      datasetVersion: 'v1-test',
      ...dataSourceOverrides,
    },
    services: {
      apiBaseUrl: 'https://example.com/api',
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
  test('uses backend api selection for development builds too', () => {
    const selection = selectDatasetSource(buildRuntimeConfig());

    expect(isBackendDatasetSelection(selection)).toBe(true);
    if (!isBackendDatasetSelection(selection)) {
      throw new Error('Expected development selection to use backend-api.');
    }

    expect(selection.kind).toBe('backend-api');
    expect(selection.reason).toBe('profile_default');
    expect(selection.apiBaseUrl).toBe('https://example.com/api');
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
  });

  test('preserves artifact contract across development and preview selections', () => {
    const development = selectDatasetSource(buildRuntimeConfig());
    const preview = selectDatasetSource(buildRuntimeConfig({ profile: 'preview' }));

    expect(development.contractId).toBe(DATASET_CONTRACT_ID);
    expect(preview.contractId).toBe(DATASET_CONTRACT_ID);
    expect(development.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
    expect(preview.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
  });
});
