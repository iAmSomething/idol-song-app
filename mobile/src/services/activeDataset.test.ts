import type { RuntimeConfigState } from '../config/runtime';

import { loadActiveMobileDataset } from './activeDataset';

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
  test('returns bundled fixture for bundled-static runtime selection', async () => {
    const result = await loadActiveMobileDataset({
      runtimeState: buildRuntimeState(),
    });

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

    expect(result.selection.kind).toBe('preview-remote');
    expect(result.sourceLabel).toBe('Preview remote dataset');
    expect(result.dataset.artistProfiles).toEqual([]);
  });

  test('throws a typed error when the remote dataset payload is invalid', async () => {
    await expect(
      loadActiveMobileDataset({
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
          json: async () => ({ nope: true }),
        })) as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({
      code: 'invalid_dataset',
    });
  });
});
