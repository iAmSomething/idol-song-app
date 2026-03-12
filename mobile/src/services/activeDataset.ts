import type { MobileRawDataset } from '../types';

import { cloneBundledDatasetFixture } from './bundledDatasetFixture';

export type BundledFixtureDataset = {
  activeSource: 'bundled-fixture';
  dataset: MobileRawDataset;
  freshness: {
    rollingReferenceAt: string | null;
    staleFreshnessClasses: string[];
  };
  issues: string[];
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

function dedupeIssueMessages(messages: string[]): string[] {
  return [...new Set(messages.filter(Boolean))];
}

export async function loadBundledFixtureDataset(
  extraIssues: string[] = [],
): Promise<BundledFixtureDataset> {
  return {
    activeSource: 'bundled-fixture',
    dataset: normalizeMobileRawDataset(cloneBundledDatasetFixture()),
    freshness: {
      rollingReferenceAt: null,
      staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
    },
    issues: dedupeIssueMessages(extraIssues),
    sourceLabel: 'Bundled fixture dataset (debug only)',
  };
}
