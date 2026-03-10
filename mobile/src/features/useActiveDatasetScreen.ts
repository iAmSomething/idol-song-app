import React from 'react';

import { getRuntimeConfigState } from '../config/runtime';
import {
  trackDatasetDegraded,
  trackDatasetLoadFailed,
  type AnalyticsSurface,
} from '../services/analytics';
import { createBackendReadClient } from '../services/backendReadClient';
import {
  readScreenSnapshotCacheEntry,
  writeScreenSnapshotCacheEntry,
} from '../services/screenSnapshotCache';
import type { ScreenDataSource } from './screenDataSource';

type BackendLoadResult<T> = {
  data: T;
  generatedAt?: string | null;
};

export type ActiveDatasetScreenState<T> =
  | {
      kind: 'disabled';
    }
  | {
      kind: 'loading';
    }
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'ready';
      source: ScreenDataSource<T>;
    };

type UseActiveDatasetScreenOptions<T> = {
  enabled?: boolean;
  surface: AnalyticsSurface;
  reloadKey: number | string;
  cacheKey: string;
  fallbackErrorMessage: string;
  loadBundled: () => Promise<T>;
  loadBackend?: (client: ReturnType<typeof createBackendReadClient>) => Promise<BackendLoadResult<T>>;
};

export function buildActiveDatasetEventKey(
  source: Pick<ScreenDataSource<unknown>, 'activeSource' | 'issues' | 'runtimeState'>,
): string {
  if (source.runtimeState.mode === 'degraded' || source.issues.length > 0) {
    return `degraded:${source.activeSource}:${source.runtimeState.mode}:${source.issues.join('|')}`;
  }

  return `ready:${source.activeSource}`;
}

function dedupeIssues(issues: string[]): string[] {
  return [...new Set(issues.filter(Boolean))];
}

function buildReadySource<T>(args: {
  activeSource: ScreenDataSource<T>['activeSource'];
  sourceLabel: string;
  data: T;
  issues?: string[];
  runtimeState: ScreenDataSource<T>['runtimeState'];
  rollingReferenceAt?: string | null;
  cachedAt?: string | null;
  generatedAt?: string | null;
}): ScreenDataSource<T> {
  return {
    activeSource: args.activeSource,
    sourceLabel: args.sourceLabel,
    data: args.data,
    issues: dedupeIssues(args.issues ?? []),
    freshness: {
      rollingReferenceAt: args.rollingReferenceAt ?? null,
      staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
      cachedAt: args.cachedAt ?? null,
      generatedAt: args.generatedAt ?? null,
    },
    runtimeState: args.runtimeState,
  };
}

export function useActiveDatasetScreen<T>({
  enabled = true,
  cacheKey,
  fallbackErrorMessage,
  loadBackend,
  loadBundled,
  reloadKey,
  surface,
}: UseActiveDatasetScreenOptions<T>): ActiveDatasetScreenState<T> {
  const [state, setState] = React.useState<ActiveDatasetScreenState<T>>(
    enabled ? { kind: 'loading' } : { kind: 'disabled' },
  );
  const datasetEventKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setState({ kind: 'disabled' });
      datasetEventKeyRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    setState({ kind: 'loading' });

    const runtimeState = getRuntimeConfigState();
    const runtimeIssues = runtimeState.issues.map((issue) => issue.message);
    const backendEnabled =
      runtimeState.mode === 'normal' &&
      runtimeState.config.dataSource.mode === 'backend-api' &&
      Boolean(runtimeState.config.services.apiBaseUrl) &&
      typeof loadBackend === 'function';

    async function loadScreenSource(): Promise<ScreenDataSource<T>> {
      if (backendEnabled) {
        try {
          const client = createBackendReadClient(runtimeState.config);
          const backendResult = await loadBackend!(client);
          await writeScreenSnapshotCacheEntry(surface, cacheKey, backendResult.data, {
            generatedAt: backendResult.generatedAt ?? null,
          });

          return buildReadySource({
            activeSource: 'backend-api',
            sourceLabel: 'Backend API',
            data: backendResult.data,
            issues: runtimeIssues,
            runtimeState,
            rollingReferenceAt: backendResult.generatedAt ?? null,
            generatedAt: backendResult.generatedAt ?? null,
          });
        } catch (error) {
          const backendMessage =
            error instanceof Error ? error.message : fallbackErrorMessage;
          const cached = await readScreenSnapshotCacheEntry<T>(surface, cacheKey);

          if (cached) {
            return buildReadySource({
              activeSource: 'backend-cache',
              sourceLabel: 'Cached backend snapshot',
              data: cached.value,
              issues: [...runtimeIssues, backendMessage],
              runtimeState,
              rollingReferenceAt: cached.generatedAt ?? cached.cachedAt,
              cachedAt: cached.cachedAt,
              generatedAt: cached.generatedAt,
            });
          }

          const bundledData = await loadBundled();
          return buildReadySource({
            activeSource: 'bundled-static-fallback',
            sourceLabel: 'Bundled static fallback',
            data: bundledData,
            issues: [...runtimeIssues, backendMessage],
            runtimeState,
          });
        }
      }

      if (runtimeState.mode === 'degraded') {
        const cached = await readScreenSnapshotCacheEntry<T>(surface, cacheKey);
        if (cached) {
          return buildReadySource({
            activeSource: 'backend-cache',
            sourceLabel: 'Cached backend snapshot',
            data: cached.value,
            issues: runtimeIssues,
            runtimeState,
            rollingReferenceAt: cached.generatedAt ?? cached.cachedAt,
            cachedAt: cached.cachedAt,
            generatedAt: cached.generatedAt,
          });
        }
      }

      const bundledData = await loadBundled();
      return buildReadySource({
        activeSource: 'bundled-static',
        sourceLabel: 'Bundled static dataset',
        data: bundledData,
        issues: runtimeIssues,
        runtimeState,
      });
    }

    void loadScreenSource()
      .then((source) => {
        if (cancelled) {
          return;
        }

        const datasetEventKey = buildActiveDatasetEventKey(source);
        if (datasetEventKeyRef.current !== datasetEventKey) {
          datasetEventKeyRef.current = datasetEventKey;
          if (source.runtimeState.mode === 'degraded' || source.issues.length > 0) {
            trackDatasetDegraded(surface, source);
          }
        }

        setState({
          kind: 'ready',
          source,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : fallbackErrorMessage;
        const datasetEventKey = `error:${message}`;
        if (datasetEventKeyRef.current !== datasetEventKey) {
          datasetEventKeyRef.current = datasetEventKey;
          trackDatasetLoadFailed(surface, message);
        }

        setState({
          kind: 'error',
          message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, fallbackErrorMessage, loadBackend, loadBundled, reloadKey, surface]);

  return state;
}
