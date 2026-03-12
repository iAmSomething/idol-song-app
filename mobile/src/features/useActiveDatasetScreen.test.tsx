import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { useActiveDatasetScreen } from './useActiveDatasetScreen';
import {
  resetStorageAdapter,
  setStorageAdapter,
  type KeyValueStorageAdapter,
} from '../services/storage';
import { readScreenSnapshotCacheEntry } from '../services/screenSnapshotCache';

const mockGetRuntimeConfigState = jest.fn();
const mockGetRuntimeConfig = jest.fn();
const mockCreateBackendReadClient = jest.fn();
const mockTrackDatasetDegraded = jest.fn();
const mockTrackDatasetLoadFailed = jest.fn();

class MockBackendReadError extends Error {
  status: number | null;
  code: string | null;
  requestId: string | null;

  constructor(
    message: string,
    options: { status?: number | null; code?: string | null; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'BackendReadError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

jest.mock('../config/runtime', () => ({
  getRuntimeConfigState: () => mockGetRuntimeConfigState(),
  getRuntimeConfig: () => mockGetRuntimeConfig(),
}));

jest.mock('../services/backendReadClient', () => ({
  BackendReadError: MockBackendReadError,
  createBackendReadClient: (...args: unknown[]) => mockCreateBackendReadClient(...args),
}));

jest.mock('../services/analytics', () => ({
  trackDatasetDegraded: (...args: unknown[]) => mockTrackDatasetDegraded(...args),
  trackDatasetLoadFailed: (...args: unknown[]) => mockTrackDatasetLoadFailed(...args),
}));

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

function buildRuntimeState(mode: 'normal' | 'degraded' = 'normal') {
  return {
    mode,
    config: {
      profile: 'preview',
      dataSource: {
        mode: 'backend-api',
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
        remoteRefresh: false,
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
              message: 'Runtime config is degraded.',
            },
          ]
        : [],
  };
}

function Harness(props: {
  reloadKey?: number;
  loadBundled: () => Promise<{ value: string }>;
  loadBackend?: (client: unknown) => Promise<{ data: { value: string }; generatedAt?: string | null }>;
}) {
  const state = useActiveDatasetScreen({
    surface: 'search',
    reloadKey: props.reloadKey ?? 0,
    cacheKey: 'search:test',
    fallbackErrorMessage: 'Search failed.',
    loadBundled: props.loadBundled,
    loadBackend: props.loadBackend,
  });

  if (state.kind !== 'ready') {
    return <Text testID="hook-state">{state.kind}</Text>;
  }

  return (
    <>
      <Text testID="hook-state">{state.kind}</Text>
      <Text testID="hook-source">{state.source.activeSource}</Text>
      <Text testID="hook-label">{state.source.sourceLabel}</Text>
      <Text testID="hook-value">{state.source.data.value}</Text>
      <Text testID="hook-issues">{state.source.issues.join('|')}</Text>
    </>
  );
}

async function renderHarness(props: React.ComponentProps<typeof Harness>) {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<Harness {...props} />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

describe('useActiveDatasetScreen', () => {
  beforeEach(() => {
    setStorageAdapter(createMemoryStorage());
    mockCreateBackendReadClient.mockReset();
    mockTrackDatasetDegraded.mockReset();
    mockTrackDatasetLoadFailed.mockReset();
    mockGetRuntimeConfig.mockReturnValue(buildRuntimeState('normal').config);
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('prefers backend data and writes a persisted snapshot in backend-api mode', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    const client = { name: 'backend-client' };
    mockCreateBackendReadClient.mockReturnValue(client);
    const loadBundled = jest.fn(async () => ({ value: 'bundled' }));
    const loadBackend = jest.fn(async (receivedClient: unknown) => {
      expect(receivedClient).toBe(client);
      return {
        data: { value: 'backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      };
    });

    const tree = await renderHarness({
      loadBundled,
      loadBackend,
    });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-api');
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('backend');
    expect(loadBundled).not.toHaveBeenCalled();
    await expect(readScreenSnapshotCacheEntry<{ value: string }>('search', 'search:test')).resolves.toEqual(
      expect.objectContaining({
        generatedAt: '2026-03-10T00:00:00.000Z',
        value: { value: 'backend' },
      }),
    );
  });

  test('reuses cached backend data when the backend request fails', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    const firstTree = await renderHarness({
      loadBundled: async () => ({ value: 'bundled' }),
      loadBackend: async () => ({
        data: { value: 'fresh-backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      }),
    });

    expect(firstTree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-api');

    const secondTree = await renderHarness({
      loadBundled: async () => ({ value: 'bundled' }),
      loadBackend: async () => {
        throw new Error('Backend timed out.');
      },
    });

    expect(secondTree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-cache');
    expect(secondTree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('fresh-backend');
    expect(secondTree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain('Backend timed out.');
  });

  test('uses bundled-static-fallback instead of bundled-static after a live backend failure without cache', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    const tree = await renderHarness({
      loadBundled: async () => ({ value: 'bundled-fallback' }),
      loadBackend: async () => {
        throw new MockBackendReadError('Backend timed out.', {
          code: 'timeout',
          requestId: 'req_no_cache_1',
        });
      },
    });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe(
      'bundled-static-fallback',
    );
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('bundled-fallback');
    expect(tree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain(
      '저장된 스냅샷이 없어 앱 번들 데이터로 전환합니다.',
    );
  });

  test('appends the backend request id when cached fallback is used after a live failure', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    await renderHarness({
      loadBundled: async () => ({ value: 'bundled' }),
      loadBackend: async () => ({
        data: { value: 'fresh-backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      }),
    });

    const tree = await renderHarness({
      loadBundled: async () => ({ value: 'bundled' }),
      loadBackend: async () => {
        throw new MockBackendReadError('백엔드 응답이 지연되어 요청을 중단했습니다. 다시 시도해 주세요.', {
          code: 'timeout',
          requestId: 'req_test_123',
        });
      },
    });

    expect(tree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain('요청 ID: req_test_123');
  });

  test('falls back to bundled data when runtime is degraded and cache is unavailable', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('degraded'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });
    const loadBundled = jest.fn(async () => ({ value: 'bundled-fallback' }));

    const tree = await renderHarness({
      loadBundled,
      loadBackend: async () => ({
        data: { value: 'backend' },
      }),
    });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('bundled-static');
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('bundled-fallback');
    expect(tree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain('Runtime config is degraded.');
    expect(loadBundled).toHaveBeenCalledTimes(1);
  });
});
