import type { RuntimeConfigState } from '../config/runtime';

import { loadActiveMobileDataset } from './activeDataset';
import { writeDatasetCacheEntry } from './datasetCache';
import {
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';
import { selectDatasetSource } from './datasetSource';
import { cloneBundledDatasetFixture } from './bundledDatasetFixture';

function buildRuntimeState(overrides: Partial<RuntimeConfigState> = {}): RuntimeConfigState {
  return {
    mode: 'normal',
    config: {
      profile: 'development',
      dataSource: {
        mode: 'bundled-static',
        remoteDatasetUrl: null,
        datasetVersion: 'fixture-v1',
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
        version: '0.1.0',
        commitSha: null,
      },
    },
    issues: [],
    ...overrides,
  };
}

describe('loadActiveMobileDataset', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const adapter: KeyValueStorageAdapter = {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    };

    setStorageAdapter(adapter);
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('returns bundled fixture for bundled-static runtime selection', async () => {
    const result = await loadActiveMobileDataset({
      runtimeState: buildRuntimeState(),
    });

    expect(result.activeSource).toBe('bundled-static');
    expect(result.cachedArtifactIds).toEqual([]);
    expect(result.selection.kind).toBe('bundled-static');
    expect(result.sourceLabel).toBe('Bundled static dataset');
    expect(result.dataset.artistProfiles.length).toBeGreaterThan(0);
  });

  test('loads a remote dataset when preview-remote is active', async () => {
    const result = await loadActiveMobileDataset({
      runtimeState: buildRuntimeState({
        config: {
          ...buildRuntimeState().config,
          profile: 'preview',
          dataSource: {
            mode: 'preview-static',
            remoteDatasetUrl: 'https://example.com/mobile-dataset.json',
            datasetVersion: 'preview-v1',
          },
          featureGates: {
            ...buildRuntimeState().config.featureGates,
            remoteRefresh: true,
          },
        },
      }),
      fetchImpl: jest.fn(async () => ({
        ok: true,
        json: async () => ({
          artistProfiles: [],
          releases: [],
          upcomingCandidates: [],
          releaseArtwork: [],
          releaseDetails: [],
          releaseHistory: [],
          youtubeChannelAllowlists: [],
        }),
      })) as unknown as typeof fetch,
    });

    expect(result.activeSource).toBe('preview-remote');
    expect(result.cachedArtifactIds.length).toBeGreaterThan(0);
    expect(result.selection.kind).toBe('preview-remote');
    expect(result.sourceLabel).toBe('Preview remote dataset');
    expect(result.dataset.artistProfiles).toEqual([]);
  });

  test('falls back to bundled degraded mode when the remote payload is invalid', async () => {
    const runtimeState = buildRuntimeState({
      config: {
        ...buildRuntimeState().config,
        profile: 'preview',
        dataSource: {
          mode: 'preview-static',
          remoteDatasetUrl: 'https://example.com/mobile-dataset.json',
          datasetVersion: 'preview-v1',
        },
        featureGates: {
          ...buildRuntimeState().config.featureGates,
          remoteRefresh: true,
        },
      },
    });

    const result = await loadActiveMobileDataset({
      runtimeState,
      fetchImpl: jest.fn(async () => ({
        ok: true,
        json: async () => ({ nope: true }),
      })) as unknown as typeof fetch,
    });

    expect(result.activeSource).toBe('bundled-static');
    expect(result.selection.kind).toBe('bundled-static');
    expect(result.issues).toContain(
      'Remote dataset payload does not match the expected contract.',
    );
  });

  test('restores the preview remote cache when the remote dataset is unavailable', async () => {
    const runtimeState = buildRuntimeState({
      config: {
        ...buildRuntimeState().config,
        profile: 'preview',
        dataSource: {
          mode: 'preview-static',
          remoteDatasetUrl: 'https://example.com/mobile-dataset.json',
          datasetVersion: 'preview-v1',
        },
        featureGates: {
          ...buildRuntimeState().config.featureGates,
          remoteRefresh: true,
        },
      },
    });
    const selection = selectDatasetSource(runtimeState.config);
    const fixture = cloneBundledDatasetFixture();

    if (selection.kind !== 'preview-remote') {
      throw new Error('Expected preview-remote selection for cache test.');
    }

    await Promise.all(
      selection.artifacts.map((artifact) =>
        writeDatasetCacheEntry(
          artifact.id,
          (() => {
            switch (artifact.id) {
              case 'artistProfiles':
                return fixture.artistProfiles;
              case 'releases':
                return fixture.releases;
              case 'releaseArtwork':
                return fixture.releaseArtwork;
              case 'releaseDetails':
                return fixture.releaseDetails;
              case 'releaseHistory':
                return fixture.releaseHistory;
              case 'watchlist':
                return fixture.watchlist ?? [];
              case 'upcomingCandidates':
                return fixture.upcomingCandidates;
              case 'teamBadgeAssets':
                return fixture.teamBadgeAssets ?? [];
              case 'youtubeChannelAllowlists':
                return fixture.youtubeChannelAllowlists;
              case 'radarChangeFeed':
                return fixture.radarChangeFeed ?? [];
            }
          })(),
          selection,
          '2026-03-10T00:00:00.000Z',
        ),
      ),
    );

    const result = await loadActiveMobileDataset({
      runtimeState,
      fetchImpl: jest.fn(async () => ({
        ok: false,
        status: 503,
      })) as unknown as typeof fetch,
    });

    expect(result.activeSource).toBe('preview-remote-cache');
    expect(result.sourceLabel).toBe('Preview remote cached dataset');
    expect(result.cachedArtifactIds).toHaveLength(selection.artifacts.length);
    expect(result.freshness.rollingReferenceAt).toBe('2026-03-10T00:00:00.000Z');
    expect(result.dataset.artistProfiles.length).toBe(fixture.artistProfiles.length);
  });
});
