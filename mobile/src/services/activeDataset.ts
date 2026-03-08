import { getRuntimeConfigState, type RuntimeConfigState } from '../config/runtime';
import type { MobileRawDataset } from '../types';

import {
  isRemoteDatasetSelection,
  selectDatasetSource,
  type DatasetSelection,
} from './datasetSource';
import { cloneBundledDatasetFixture } from './bundledDatasetFixture';

export type ActiveMobileDataset = {
  dataset: MobileRawDataset;
  selection: DatasetSelection;
  runtimeState: RuntimeConfigState;
  sourceLabel: string;
  issues: string[];
};

export class ActiveDatasetLoadError extends Error {
  constructor(
    public readonly code: 'remote_unavailable' | 'invalid_dataset',
    message: string,
  ) {
    super(message);
    this.name = 'ActiveDatasetLoadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMobileRawDataset(value: unknown): value is MobileRawDataset {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.artistProfiles) &&
    Array.isArray(value.releases) &&
    Array.isArray(value.upcomingCandidates) &&
    Array.isArray(value.releaseArtwork) &&
    Array.isArray(value.releaseDetails) &&
    Array.isArray(value.releaseHistory) &&
    Array.isArray(value.youtubeChannelAllowlists)
  );
}

function getDatasetSourceLabel(selection: DatasetSelection): string {
  return selection.kind === 'preview-remote' ? 'Preview remote dataset' : 'Bundled static dataset';
}

export async function loadActiveMobileDataset(options: {
  runtimeState?: RuntimeConfigState;
  fetchImpl?: typeof fetch;
} = {}): Promise<ActiveMobileDataset> {
  const runtimeState = options.runtimeState ?? getRuntimeConfigState();
  const selection = selectDatasetSource(runtimeState.config);
  const issues = runtimeState.issues.map((issue) => issue.message);

  if (!isRemoteDatasetSelection(selection)) {
    return {
      dataset: cloneBundledDatasetFixture(),
      selection,
      runtimeState,
      sourceLabel: getDatasetSourceLabel(selection),
      issues,
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(selection.remoteDatasetUrl);

  if (!response.ok) {
    throw new ActiveDatasetLoadError(
      'remote_unavailable',
      `Remote dataset request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();
  if (!isMobileRawDataset(payload)) {
    throw new ActiveDatasetLoadError(
      'invalid_dataset',
      'Remote dataset payload does not match the expected contract.',
    );
  }

  return {
    dataset: payload,
    selection,
    runtimeState,
    sourceLabel: getDatasetSourceLabel(selection),
    issues,
  };
}
