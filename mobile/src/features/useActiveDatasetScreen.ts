import React from 'react';

import type { ActiveMobileDataset } from '../services/activeDataset';
import { loadActiveMobileDataset } from '../services/activeDataset';
import {
  trackDatasetDegraded,
  trackDatasetLoadFailed,
  type AnalyticsSurface,
} from '../services/analytics';

export type ActiveDatasetScreenState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'error';
      message: string;
    }
  | {
      kind: 'ready';
      source: ActiveMobileDataset;
    };

type UseActiveDatasetScreenOptions = {
  surface: AnalyticsSurface;
  reloadKey: number;
  fallbackErrorMessage: string;
};

export function buildActiveDatasetEventKey(source: Pick<ActiveMobileDataset, 'issues' | 'runtimeState' | 'selection'>): string {
  if (source.runtimeState.mode === 'degraded' || source.issues.length > 0) {
    return `degraded:${source.selection.kind}:${source.runtimeState.mode}:${source.issues.join('|')}`;
  }

  return `ready:${source.selection.kind}`;
}

export function useActiveDatasetScreen({
  fallbackErrorMessage,
  reloadKey,
  surface,
}: UseActiveDatasetScreenOptions): ActiveDatasetScreenState {
  const [state, setState] = React.useState<ActiveDatasetScreenState>({ kind: 'loading' });
  const datasetEventKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    void loadActiveMobileDataset()
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
  }, [fallbackErrorMessage, reloadKey, surface]);

  return state;
}
