import {
  getRuntimeConfigState,
  type RuntimeConfigIssue,
  type RuntimeConfigState,
} from '../config/runtime';
import {
  createBundledDatasetSelection,
  isRemoteDatasetSelection,
  selectDatasetSource,
  type DatasetArtifactId,
  type DatasetSelection,
  type PreviewRemoteDatasetSelection,
} from './datasetSource';
import { readDatasetCacheEntry } from './datasetCache';

export type RemoteDatasetAvailability =
  | {
      status: 'available';
    }
  | {
      status: 'unavailable' | 'invalid';
      message?: string;
    };

export type DatasetFailurePolicyIssueKind =
  | RuntimeConfigIssue['kind']
  | 'remote_dataset_unavailable'
  | 'remote_dataset_invalid';

export type DatasetFailurePolicyIssue = {
  kind: DatasetFailurePolicyIssueKind;
  message: string;
};

export type DatasetFailurePolicy = {
  mode: 'normal' | 'degraded';
  activeSource: 'bundled-static' | 'preview-remote' | 'preview-remote-cache';
  selection: DatasetSelection;
  cachedArtifactIds: DatasetArtifactId[];
  issues: DatasetFailurePolicyIssue[];
};

function toFailurePolicyIssues(issues: RuntimeConfigIssue[]): DatasetFailurePolicyIssue[] {
  return issues.map((issue) => ({
    kind: issue.kind,
    message: issue.message,
  }));
}

async function readCachedArtifactIds(
  selection: PreviewRemoteDatasetSelection,
): Promise<DatasetArtifactId[]> {
  const cachedArtifactIds = await Promise.all(
    selection.artifacts.map(async (artifact) => {
      const entry = await readDatasetCacheEntry(artifact.id, selection);
      return entry ? artifact.id : null;
    }),
  );

  return cachedArtifactIds.filter((artifactId): artifactId is DatasetArtifactId => artifactId !== null);
}

function hasCompleteCachedDataset(
  selection: PreviewRemoteDatasetSelection,
  cachedArtifactIds: DatasetArtifactId[],
): boolean {
  return (
    selection.artifacts.length > 0 &&
    cachedArtifactIds.length === selection.artifacts.length
  );
}

export async function resolveDatasetFailurePolicy(options: {
  runtimeState?: RuntimeConfigState;
  selection?: DatasetSelection;
  remoteAvailability?: RemoteDatasetAvailability;
} = {}): Promise<DatasetFailurePolicy> {
  const runtimeState = options.runtimeState ?? getRuntimeConfigState();

  if (runtimeState.mode === 'degraded') {
    return {
      mode: 'degraded',
      activeSource: 'bundled-static',
      selection: createBundledDatasetSelection(
        runtimeState.config.dataSource.datasetVersion,
        'runtime_degraded',
      ),
      cachedArtifactIds: [],
      issues: toFailurePolicyIssues(runtimeState.issues),
    };
  }

  const selection = options.selection ?? selectDatasetSource(runtimeState.config);
  const remoteAvailability = options.remoteAvailability ?? { status: 'available' as const };

  if (!isRemoteDatasetSelection(selection)) {
    return {
      mode: 'normal',
      activeSource: 'bundled-static',
      selection,
      cachedArtifactIds: [],
      issues: [],
    };
  }

  if (remoteAvailability.status === 'available') {
    return {
      mode: 'normal',
      activeSource: 'preview-remote',
      selection,
      cachedArtifactIds: [],
      issues: [],
    };
  }

  const cachedArtifactIds = await readCachedArtifactIds(selection);
  const issueKind =
    remoteAvailability.status === 'invalid' ? 'remote_dataset_invalid' : 'remote_dataset_unavailable';
  const issueMessage =
    remoteAvailability.message ??
    (remoteAvailability.status === 'invalid'
      ? 'Preview remote dataset payload is invalid.'
      : 'Preview remote dataset is unavailable.');

  if (hasCompleteCachedDataset(selection, cachedArtifactIds)) {
    return {
      mode: 'degraded',
      activeSource: 'preview-remote-cache',
      selection,
      cachedArtifactIds,
      issues: [
        {
          kind: issueKind,
          message: issueMessage,
        },
      ],
    };
  }

  return {
    mode: 'degraded',
    activeSource: 'bundled-static',
    selection: createBundledDatasetSelection(selection.datasetVersion, 'remote_unavailable'),
    cachedArtifactIds,
    issues: [
      {
        kind: issueKind,
        message: issueMessage,
      },
    ],
  };
}
