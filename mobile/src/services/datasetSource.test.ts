import type { MobileRuntimeConfig } from '../config/runtime';
import {
  BUNDLED_DATASET_BASE_PATH,
  DATASET_ARTIFACTS,
  DATASET_CONTRACT_ID,
  isBundledDatasetSelection,
  isRemoteDatasetSelection,
  selectDatasetSource,
} from './datasetSource';

function buildRuntimeConfig(
  overrides: Partial<MobileRuntimeConfig> = {},
  dataSourceOverrides: Partial<MobileRuntimeConfig['dataSource']> = {},
  featureGateOverrides: Partial<MobileRuntimeConfig['featureGates']> = {},
): MobileRuntimeConfig {
  return {
    profile: overrides.profile ?? 'development',
    dataSource: {
      mode: overrides.profile === 'production' ? 'production-static' : overrides.profile === 'preview' ? 'preview-static' : 'bundled-static',
      remoteDatasetUrl: null,
      datasetVersion: 'v1-test',
      ...dataSourceOverrides,
    },
    services: {
      apiBaseUrl: null,
      analyticsWriteKey: null,
      ...overrides.services,
    },
    logging: {
      level: overrides.profile === 'production' ? 'error' : 'debug',
      ...overrides.logging,
    },
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
      ...featureGateOverrides,
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
      throw new Error('Expected bundled dataset selection.');
    }

    expect(selection.kind).toBe('bundled-static');
    expect(selection.reason).toBe('profile_default');
    expect(selection.bundledBasePath).toBe(BUNDLED_DATASET_BASE_PATH);
    expect(selection.contractId).toBe(DATASET_CONTRACT_ID);
    expect(selection.mixingAllowed).toBe(false);
  });

  test('keeps preview on bundled data when remote refresh is disabled', () => {
    const selection = selectDatasetSource(
      buildRuntimeConfig(
        { profile: 'preview' },
        {
          mode: 'preview-static',
          remoteDatasetUrl: 'https://example.com/dataset.json',
        },
      ),
    );

    expect(isBundledDatasetSelection(selection)).toBe(true);
    expect(selection.reason).toBe('preview_remote_disabled');
  });

  test('switches preview builds to the remote dataset when explicitly enabled', () => {
    const selection = selectDatasetSource(
      buildRuntimeConfig(
        { profile: 'preview' },
        {
          mode: 'preview-static',
          remoteDatasetUrl: 'https://example.com/dataset.json',
          datasetVersion: 'preview-v2',
        },
        {
          remoteRefresh: true,
        },
      ),
    );

    expect(isRemoteDatasetSelection(selection)).toBe(true);
    if (!isRemoteDatasetSelection(selection)) {
      throw new Error('Expected preview remote dataset selection.');
    }

    expect(selection.kind).toBe('preview-remote');
    expect(selection.reason).toBe('preview_remote_enabled');
    expect(selection.remoteDatasetUrl).toBe('https://example.com/dataset.json');
    expect(selection.datasetVersion).toBe('preview-v2');
    expect(selection.mixingAllowed).toBe(false);
  });

  test('preserves the same artifact contract between bundled and remote selections', () => {
    const bundled = selectDatasetSource(buildRuntimeConfig());
    const remote = selectDatasetSource(
      buildRuntimeConfig(
        { profile: 'preview' },
        {
          mode: 'preview-static',
          remoteDatasetUrl: 'https://example.com/dataset.json',
        },
        {
          remoteRefresh: true,
        },
      ),
    );

    expect(bundled.contractId).toBe(DATASET_CONTRACT_ID);
    expect(remote.contractId).toBe(DATASET_CONTRACT_ID);
    expect(bundled.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
    expect(remote.artifacts.map((artifact) => artifact.id)).toEqual(DATASET_ARTIFACTS.map((artifact) => artifact.id));
  });
});
