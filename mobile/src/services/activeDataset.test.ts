import type { RuntimeConfigState } from '../config/runtime';

import { loadActiveMobileDataset } from './activeDataset';
import {
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from './storage';

function buildRuntimeState(overrides: Partial<RuntimeConfigState> = {}): RuntimeConfigState {
  return {
    mode: 'normal',
    config: {
      profile: 'development',
      dataSource: {
        mode: 'bundled-static',
        datasetVersion: 'fixture-v1',
      },
      services: {
        apiBaseUrl: null,
        analyticsWriteKey: null,
        expoProjectId: null,
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
    expect(result.selection.kind).toBe('bundled-static');
    expect(result.sourceLabel).toBe('Bundled fallback dataset');
    expect(result.dataset.artistProfiles.length).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });

  test('falls back to bundled degraded mode when runtime config is degraded', async () => {
    const result = await loadActiveMobileDataset({
      runtimeState: buildRuntimeState({
        mode: 'degraded',
        issues: [
          {
            kind: 'invalid_runtime_config',
            message: 'Runtime config is degraded.',
          },
        ],
      }),
    });

    expect(result.activeSource).toBe('bundled-static');
    expect(result.selection.kind).toBe('bundled-static');
    expect(result.selection.reason).toBe('runtime_degraded');
    expect(result.issues).toContain('Runtime config is degraded.');
  });

  test('uses bundled selection even when runtime prefers backend api', async () => {
    const base = buildRuntimeState();
    const result = await loadActiveMobileDataset({
      runtimeState: {
        ...base,
        config: {
          ...base.config,
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
        },
      },
    });

    expect(result.activeSource).toBe('bundled-static');
    expect(result.selection.reason).toBe('backend_primary_fallback');
    expect(result.sourceLabel).toBe('Bundled fallback dataset');
  });
});
