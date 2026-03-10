import type { RuntimeConfigState } from '../config/runtime';
import { getRuntimeConfigState } from '../config/runtime';
import type { MobileRawDataset } from '../types';

import { resolveDatasetFailurePolicy } from './datasetFailurePolicy';
import { selectDatasetSource, type DatasetSelection } from './datasetSource';
import { cloneBundledDatasetFixture } from './bundledDatasetFixture';

export type ActiveMobileDataset = {
  activeSource: 'bundled-static';
  dataset: MobileRawDataset;
  freshness: {
    rollingReferenceAt: string | null;
    staleFreshnessClasses: string[];
  };
  issues: string[];
  runtimeState: RuntimeConfigState;
  selection: DatasetSelection;
  sourceLabel: string;
};

function normalizeMobileRawDataset(dataset: MobileRawDataset): MobileRawDataset {
  return {
    ...dataset,
    watchlist: Array.isArray(dataset.watchlist) ? dataset.watchlist : [],
    teamBadgeAssets: Array.isArray(dataset.teamBadgeAssets)
      ? dataset.teamBadgeAssets
      : [],
    radarChangeFeed: Array.isArray(dataset.radarChangeFeed)
      ? dataset.radarChangeFeed
      : [],
  };
}

function getDatasetSourceLabel(): string {
  return 'Bundled static dataset';
}

function dedupeIssueMessages(messages: string[]): string[] {
  return [...new Set(messages.filter(Boolean))];
}

function buildBundledDatasetResponse(args: {
  extraIssues?: string[];
  selection: DatasetSelection;
  runtimeState: RuntimeConfigState;
}): ActiveMobileDataset {
  const dataset = normalizeMobileRawDataset(cloneBundledDatasetFixture());

  return {
    activeSource: 'bundled-static',
    dataset,
    freshness: {
      rollingReferenceAt: null,
      staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
    },
    issues: dedupeIssueMessages([
      ...args.runtimeState.issues.map((issue) => issue.message),
      ...(args.extraIssues ?? []),
    ]),
    runtimeState: args.runtimeState,
    selection: args.selection,
    sourceLabel: getDatasetSourceLabel(),
  };
}

export async function loadActiveMobileDataset(
  options: {
    runtimeState?: RuntimeConfigState;
  } = {},
): Promise<ActiveMobileDataset> {
  const runtimeState = options.runtimeState ?? getRuntimeConfigState();
  const selection = selectDatasetSource(runtimeState.config);
  const basePolicy = await resolveDatasetFailurePolicy({
    runtimeState,
    selection,
  });
  return buildBundledDatasetResponse({
    extraIssues: basePolicy.issues.map((issue) => issue.message),
    selection: basePolicy.selection,
    runtimeState,
  });
}
