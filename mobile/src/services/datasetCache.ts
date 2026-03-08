import {
  type DatasetArtifactId,
  type DatasetSelection,
  selectDatasetSource,
} from './datasetSource';
import {
  buildDatasetCacheKey,
  readStoredJson,
  removeStoredJson,
  writeStoredJson,
} from './storage';

export type DatasetCacheEntry<T> = {
  artifactId: DatasetArtifactId;
  contractId: DatasetSelection['contractId'];
  datasetVersion: string | null;
  sourceKind: DatasetSelection['kind'];
  cachedAt: string;
  value: T;
};

export function getDatasetCacheKey(
  artifactId: DatasetArtifactId,
  selection: DatasetSelection = selectDatasetSource(),
): string {
  return buildDatasetCacheKey(
    selection.contractId,
    selection.kind,
    selection.datasetVersion,
    artifactId,
  );
}

export async function readDatasetCacheEntry<T>(
  artifactId: DatasetArtifactId,
  selection: DatasetSelection = selectDatasetSource(),
): Promise<DatasetCacheEntry<T> | null> {
  return readStoredJson<DatasetCacheEntry<T>>(getDatasetCacheKey(artifactId, selection));
}

export async function writeDatasetCacheEntry<T>(
  artifactId: DatasetArtifactId,
  value: T,
  selection: DatasetSelection = selectDatasetSource(),
  cachedAt: string = new Date().toISOString(),
): Promise<DatasetCacheEntry<T>> {
  const entry: DatasetCacheEntry<T> = {
    artifactId,
    contractId: selection.contractId,
    datasetVersion: selection.datasetVersion,
    sourceKind: selection.kind,
    cachedAt,
    value,
  };

  await writeStoredJson(getDatasetCacheKey(artifactId, selection), entry);
  return entry;
}

export async function clearDatasetCacheEntry(
  artifactId: DatasetArtifactId,
  selection: DatasetSelection = selectDatasetSource(),
): Promise<void> {
  await removeStoredJson(getDatasetCacheKey(artifactId, selection));
}
