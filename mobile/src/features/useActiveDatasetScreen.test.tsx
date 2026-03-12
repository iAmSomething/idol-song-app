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
const mockCreateBackendReadClient = jest.fn();
const mockTrackDatasetDegraded = jest.fn();
const mockTrackDatasetLoadFailed = jest.fn();

class MockBackendReadError extends Error {
  requestId: string | null;

  constructor(message: string, requestId?: string | null) {
    super(message);
    this.name = 'BackendReadError';
    this.requestId = requestId ?? null;
  }
}

jest.mock('../config/runtime', () => ({
  getRuntimeConfigState: () => mockGetRuntimeConfigState(),
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
        expoProjectId: null,
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
  loadBackend?: (client: unknown) => Promise<{ data: { value: string }; generatedAt?: string | null }>;
}) {
  const state = useActiveDatasetScreen({
    surface: 'search',
    reloadKey: props.reloadKey ?? 0,
    cacheKey: 'search:test',
    fallbackErrorMessage: 'Search failed.',
    loadBackend: props.loadBackend,
  });

  if (state.kind !== 'ready') {
    return (
      <>
        <Text testID="hook-state">{state.kind}</Text>
        {'message' in state ? <Text testID="hook-message">{state.message}</Text> : null}
      </>
    );
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
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('prefers backend data and writes a persisted snapshot in backend-api mode', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    const client = { name: 'backend-client' };
    mockCreateBackendReadClient.mockReturnValue(client);
    const loadBackend = jest.fn(async (receivedClient: unknown) => {
      expect(receivedClient).toBe(client);
      return {
        data: { value: 'backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      };
    });

    const tree = await renderHarness({ loadBackend });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-api');
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('backend');
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

    await renderHarness({
      loadBackend: async () => ({
        data: { value: 'fresh-backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      }),
    });

    const tree = await renderHarness({
      loadBackend: async () => {
        throw new Error('Backend timed out.');
      },
    });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-cache');
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('fresh-backend');
    expect(tree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain('Backend timed out.');
  });

  test('returns an explicit error when live backend fails without cache', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    const tree = await renderHarness({
      loadBackend: async () => {
        throw new MockBackendReadError('Backend timed out.', 'req_no_cache_1');
      },
    });

    expect(tree.root.findByProps({ testID: 'hook-state' }).props.children).toBe('error');
    expect(tree.root.findByProps({ testID: 'hook-message' }).props.children).toContain(
      '저장된 스냅샷이 없어 현재 화면을 열 수 없습니다.',
    );
    expect(tree.root.findByProps({ testID: 'hook-message' }).props.children).toContain('req_no_cache_1');
  });

  test('uses cached backend data while runtime is degraded', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('normal'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    await renderHarness({
      loadBackend: async () => ({
        data: { value: 'cached-backend' },
        generatedAt: '2026-03-10T00:00:00.000Z',
      }),
    });

    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('degraded'));

    const tree = await renderHarness({
      loadBackend: async () => ({
        data: { value: 'ignored' },
      }),
    });

    expect(tree.root.findByProps({ testID: 'hook-source' }).props.children).toBe('backend-cache');
    expect(tree.root.findByProps({ testID: 'hook-value' }).props.children).toBe('cached-backend');
    expect(tree.root.findByProps({ testID: 'hook-issues' }).props.children).toContain('Runtime config is degraded.');
  });

  test('returns an explicit error when runtime is degraded and cache is unavailable', async () => {
    mockGetRuntimeConfigState.mockReturnValue(buildRuntimeState('degraded'));
    mockCreateBackendReadClient.mockReturnValue({ name: 'backend-client' });

    const tree = await renderHarness({
      loadBackend: async () => ({
        data: { value: 'backend' },
      }),
    });

    expect(tree.root.findByProps({ testID: 'hook-state' }).props.children).toBe('error');
    expect(tree.root.findByProps({ testID: 'hook-message' }).props.children).toContain(
      '런타임이 degraded 상태이고 저장된 백엔드 스냅샷이 없습니다.',
    );
  });
});
