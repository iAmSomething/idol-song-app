import type { RuntimeConfigState } from '../config/runtime';
import {
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';
import type { PreviewRemoteDatasetSelection } from './datasetSource';
import { writeDatasetCacheEntry } from './datasetCache';
import { resolveDatasetFailurePolicy } from './datasetFailurePolicy';

function createMemoryStorage(): KeyValueStorageAdapter {
  const values = new Map<string, string>();

  return {
    async getItem(key) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

function createRuntimeState(mode: RuntimeConfigState['mode'] = 'normal'): RuntimeConfigState {
  return {
    mode,
    config: {
      profile: 'preview',
      dataSource: {
        mode: 'preview-static',
        remoteDatasetUrl: mode === 'normal' ? 'https://example.com/dataset.json' : null,
        datasetVersion: 'preview-v2',
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
        remoteRefresh: mode === 'normal',
        mvEmbed: true,
        shareActions: true,
      },
      build: {
        version: '0.1.0',
        commitSha: 'test-sha',
      },
    },
    issues:
      mode === 'degraded'
        ? [
            {
              kind: 'invalid_runtime_config',
              message: 'Runtime config only allows remoteRefresh in the preview profile.',
            },
          ]
        : [],
  };
}

function createPreviewSelection(): PreviewRemoteDatasetSelection {
  return {
    kind: 'preview-remote',
    reason: 'preview_remote_enabled',
    contractId: 'idol-song-mobile-static-v1',
    datasetVersion: 'preview-v2',
    mixingAllowed: false,
    remoteDatasetUrl: 'https://example.com/dataset.json',
    artifacts: [
      {
        id: 'artistProfiles',
        freshnessClass: 'stable-profile',
        relativePath: 'artistProfiles.json',
      },
      {
        id: 'releases',
        freshnessClass: 'rolling-release',
        relativePath: 'releases.json',
      },
    ],
  };
}

describe('dataset failure policy', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('falls back to bundled degraded mode when runtime config is already degraded', async () => {
    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('degraded'),
    });

    expect(policy.mode).toBe('degraded');
    expect(policy.activeSource).toBe('bundled-static');
    expect(policy.selection.kind).toBe('bundled-static');
    expect(policy.selection.reason).toBe('runtime_degraded');
    expect(policy.issues).toEqual([
      expect.objectContaining({
        kind: 'invalid_runtime_config',
      }),
    ]);
  });

  test('stays in normal mode when preview remote dataset is available', async () => {
    const selection = createPreviewSelection();
    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('normal'),
      selection,
      remoteAvailability: {
        status: 'available',
      },
    });

    expect(policy.mode).toBe('normal');
    expect(policy.activeSource).toBe('preview-remote');
    expect(policy.selection).toEqual(selection);
    expect(policy.issues).toEqual([]);
  });

  test('falls back to last-known-good remote cache when remote dataset is unavailable', async () => {
    const selection = createPreviewSelection();
    await writeDatasetCacheEntry('artistProfiles', { rows: 1 }, selection, '2026-03-08T00:00:00.000Z');
    await writeDatasetCacheEntry('releases', { rows: 2 }, selection, '2026-03-08T00:00:00.000Z');

    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('normal'),
      selection,
      remoteAvailability: {
        status: 'unavailable',
        message: 'Fetch failed with 503.',
      },
    });

    expect(policy.mode).toBe('degraded');
    expect(policy.activeSource).toBe('preview-remote-cache');
    expect(policy.selection).toEqual(selection);
    expect(policy.cachedArtifactIds).toEqual(['artistProfiles', 'releases']);
    expect(policy.issues).toEqual([
      {
        kind: 'remote_dataset_unavailable',
        message: 'Fetch failed with 503.',
      },
    ]);
  });

  test('falls back to bundled dataset when remote dataset is invalid and cache is incomplete', async () => {
    const selection = createPreviewSelection();
    await writeDatasetCacheEntry('artistProfiles', { rows: 1 }, selection, '2026-03-08T00:00:00.000Z');

    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('normal'),
      selection,
      remoteAvailability: {
        status: 'invalid',
      },
    });

    expect(policy.mode).toBe('degraded');
    expect(policy.activeSource).toBe('bundled-static');
    expect(policy.selection.kind).toBe('bundled-static');
    expect(policy.selection.reason).toBe('remote_unavailable');
    expect(policy.cachedArtifactIds).toEqual(['artistProfiles']);
    expect(policy.issues).toEqual([
      {
        kind: 'remote_dataset_invalid',
        message: 'Preview remote dataset payload is invalid.',
      },
    ]);
  });
});
