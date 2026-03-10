import type { RuntimeConfigState } from '../config/runtime';
import { getRuntimeConfigState } from '../config/runtime';
import type { MobileRawDataset } from '../types';

import {
  resolveDatasetFailurePolicy,
  type DatasetFailurePolicy,
} from './datasetFailurePolicy';
import {
  readDatasetCacheEntry,
  writeDatasetCacheEntry,
} from './datasetCache';
import {
  isRemoteDatasetSelection,
  selectDatasetSource,
  type DatasetArtifactDescriptor,
  type DatasetArtifactId,
  type DatasetFreshnessClass,
  type DatasetSelection,
  type PreviewRemoteDatasetSelection,
} from './datasetSource';
import { cloneBundledDatasetFixture } from './bundledDatasetFixture';

type DatasetArtifactValues = {
  artistProfiles: MobileRawDataset['artistProfiles'];
  releases: MobileRawDataset['releases'];
  releaseArtwork: MobileRawDataset['releaseArtwork'];
  releaseDetails: MobileRawDataset['releaseDetails'];
  releaseHistory: MobileRawDataset['releaseHistory'];
  watchlist: NonNullable<MobileRawDataset['watchlist']>;
  upcomingCandidates: MobileRawDataset['upcomingCandidates'];
  teamBadgeAssets: NonNullable<MobileRawDataset['teamBadgeAssets']>;
  youtubeChannelAllowlists: MobileRawDataset['youtubeChannelAllowlists'];
  radarChangeFeed: NonNullable<MobileRawDataset['radarChangeFeed']>;
};

export type ActiveMobileDataset = {
  activeSource: DatasetFailurePolicy['activeSource'];
  cachedArtifactIds: DatasetArtifactId[];
  dataset: MobileRawDataset;
  freshness: {
    rollingReferenceAt: string | null;
    staleFreshnessClasses: DatasetFreshnessClass[];
  };
  issues: string[];
  runtimeState: RuntimeConfigState;
  selection: DatasetSelection;
  sourceLabel: string;
};

export class ActiveDatasetLoadError extends Error {
  constructor(
    public readonly code:
      | 'remote_unavailable'
      | 'invalid_dataset'
      | 'invalid_cache',
    message: string,
  ) {
    super(message);
    this.name = 'ActiveDatasetLoadError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOptionalArray(value: unknown): boolean {
  return value == null || Array.isArray(value);
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
    Array.isArray(value.youtubeChannelAllowlists) &&
    isOptionalArray(value.watchlist) &&
    isOptionalArray(value.teamBadgeAssets) &&
    isOptionalArray(value.radarChangeFeed)
  );
}

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

function getDatasetSourceLabel(
  activeSource: DatasetFailurePolicy['activeSource'],
): string {
  switch (activeSource) {
    case 'preview-remote':
      return 'Preview remote dataset';
    case 'preview-remote-cache':
      return 'Preview remote cached dataset';
    case 'bundled-static':
    default:
      return 'Bundled static dataset';
  }
}

function dedupeIssueMessages(messages: string[]): string[] {
  return [...new Set(messages.filter(Boolean))];
}

function getArtifactValue(
  dataset: MobileRawDataset,
  descriptor: DatasetArtifactDescriptor,
): DatasetArtifactValues[typeof descriptor.id] {
  switch (descriptor.id) {
    case 'artistProfiles':
      return dataset.artistProfiles;
    case 'releases':
      return dataset.releases;
    case 'releaseArtwork':
      return dataset.releaseArtwork;
    case 'releaseDetails':
      return dataset.releaseDetails;
    case 'releaseHistory':
      return dataset.releaseHistory;
    case 'watchlist':
      return Array.isArray(dataset.watchlist) ? dataset.watchlist : [];
    case 'upcomingCandidates':
      return dataset.upcomingCandidates;
    case 'teamBadgeAssets':
      return Array.isArray(dataset.teamBadgeAssets) ? dataset.teamBadgeAssets : [];
    case 'youtubeChannelAllowlists':
      return dataset.youtubeChannelAllowlists;
    case 'radarChangeFeed':
      return Array.isArray(dataset.radarChangeFeed) ? dataset.radarChangeFeed : [];
  }
}

async function writeDatasetCaches(
  dataset: MobileRawDataset,
  selection: PreviewRemoteDatasetSelection,
  cachedAt = new Date().toISOString(),
): Promise<DatasetArtifactId[]> {
  await Promise.all(
    selection.artifacts.map((descriptor) =>
      writeDatasetCacheEntry(
        descriptor.id,
        getArtifactValue(dataset, descriptor),
        selection,
        cachedAt,
      ),
    ),
  );

  return selection.artifacts.map((descriptor) => descriptor.id);
}

async function buildDatasetFromCache(
  selection: PreviewRemoteDatasetSelection,
): Promise<{
  cachedArtifactIds: DatasetArtifactId[];
  dataset: MobileRawDataset;
  rollingReferenceAt: string | null;
}> {
  const entries = await Promise.all(
    selection.artifacts.map(async (descriptor) => {
      const entry = await readDatasetCacheEntry<DatasetArtifactValues[typeof descriptor.id]>(
        descriptor.id,
        selection,
      );

      return {
        descriptor,
        entry,
      };
    }),
  );

  const missing = entries.find(({ entry }) => entry === null);
  if (missing) {
    throw new ActiveDatasetLoadError(
      'invalid_cache',
      `Preview remote cache is missing ${missing.descriptor.id}.`,
    );
  }

  const values = new Map<DatasetArtifactId, DatasetArtifactValues[DatasetArtifactId]>();
  for (const { descriptor, entry } of entries) {
    values.set(descriptor.id, entry!.value);
  }

  const rollingReferenceAt =
    entries
      .filter(({ descriptor }) => descriptor.freshnessClass !== 'stable-profile')
      .map(({ entry }) => entry!.cachedAt)
      .sort()[0] ?? null;

  return {
    cachedArtifactIds: selection.artifacts.map((descriptor) => descriptor.id),
    dataset: normalizeMobileRawDataset({
      artistProfiles: values.get('artistProfiles') as MobileRawDataset['artistProfiles'],
      releases: values.get('releases') as MobileRawDataset['releases'],
      releaseArtwork: values.get('releaseArtwork') as MobileRawDataset['releaseArtwork'],
      releaseDetails: values.get('releaseDetails') as MobileRawDataset['releaseDetails'],
      releaseHistory: values.get('releaseHistory') as MobileRawDataset['releaseHistory'],
      watchlist: values.get('watchlist') as NonNullable<MobileRawDataset['watchlist']>,
      upcomingCandidates: values.get('upcomingCandidates') as MobileRawDataset['upcomingCandidates'],
      teamBadgeAssets: values.get('teamBadgeAssets') as NonNullable<MobileRawDataset['teamBadgeAssets']>,
      youtubeChannelAllowlists: values.get(
        'youtubeChannelAllowlists',
      ) as MobileRawDataset['youtubeChannelAllowlists'],
      radarChangeFeed: values.get('radarChangeFeed') as NonNullable<MobileRawDataset['radarChangeFeed']>,
    }),
    rollingReferenceAt,
  };
}

function buildBundledDatasetResponse(args: {
  cachedArtifactIds: DatasetArtifactId[];
  extraIssues?: string[];
  policy: DatasetFailurePolicy;
  runtimeState: RuntimeConfigState;
}): ActiveMobileDataset {
  const dataset = normalizeMobileRawDataset(cloneBundledDatasetFixture());

  return {
    activeSource: args.policy.activeSource,
    cachedArtifactIds: args.cachedArtifactIds,
    dataset,
    freshness: {
      rollingReferenceAt: null,
      staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
    },
    issues: dedupeIssueMessages([
      ...args.runtimeState.issues.map((issue) => issue.message),
      ...args.policy.issues.map((issue) => issue.message),
      ...(args.extraIssues ?? []),
    ]),
    runtimeState: args.runtimeState,
    selection: args.policy.selection,
    sourceLabel: getDatasetSourceLabel(args.policy.activeSource),
  };
}

export async function loadActiveMobileDataset(
  options: {
    fetchImpl?: typeof fetch;
    runtimeState?: RuntimeConfigState;
  } = {},
): Promise<ActiveMobileDataset> {
  const runtimeState = options.runtimeState ?? getRuntimeConfigState();
  const selection = selectDatasetSource(runtimeState.config);
  const basePolicy = await resolveDatasetFailurePolicy({
    runtimeState,
    selection,
  });

  if (!isRemoteDatasetSelection(selection) || basePolicy.activeSource === 'bundled-static') {
    return buildBundledDatasetResponse({
      cachedArtifactIds: basePolicy.cachedArtifactIds,
      policy: basePolicy,
      runtimeState,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
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

    const dataset = normalizeMobileRawDataset(payload);
    const cachedArtifactIds = await writeDatasetCaches(dataset, selection);

    return {
      activeSource: 'preview-remote',
      cachedArtifactIds,
      dataset,
      freshness: {
        rollingReferenceAt: null,
        staleFreshnessClasses: [],
      },
      issues: dedupeIssueMessages(runtimeState.issues.map((issue) => issue.message)),
      runtimeState,
      selection,
      sourceLabel: getDatasetSourceLabel('preview-remote'),
    };
  } catch (error: unknown) {
    const remoteAvailability =
      error instanceof ActiveDatasetLoadError && error.code === 'invalid_dataset'
        ? {
            message: error.message,
            status: 'invalid' as const,
          }
        : {
            message:
              error instanceof Error
                ? error.message
                : 'Preview remote dataset is unavailable.',
            status: 'unavailable' as const,
          };

    const fallbackPolicy = await resolveDatasetFailurePolicy({
      runtimeState,
      selection,
      remoteAvailability,
    });

    if (fallbackPolicy.activeSource === 'preview-remote-cache') {
      try {
        const cached = await buildDatasetFromCache(selection);

        return {
          activeSource: 'preview-remote-cache',
          cachedArtifactIds: cached.cachedArtifactIds,
          dataset: cached.dataset,
          freshness: {
            rollingReferenceAt: cached.rollingReferenceAt,
            staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
          },
          issues: dedupeIssueMessages([
            ...runtimeState.issues.map((issue) => issue.message),
            ...fallbackPolicy.issues.map((issue) => issue.message),
          ]),
          runtimeState,
          selection: fallbackPolicy.selection,
          sourceLabel: getDatasetSourceLabel('preview-remote-cache'),
        };
      } catch (cacheError: unknown) {
        return buildBundledDatasetResponse({
          cachedArtifactIds: fallbackPolicy.cachedArtifactIds,
          extraIssues: [
            cacheError instanceof Error
              ? cacheError.message
              : 'Preview remote cache could not be restored.',
          ],
          policy: {
            ...fallbackPolicy,
            activeSource: 'bundled-static',
          },
          runtimeState,
        });
      }
    }

    return buildBundledDatasetResponse({
      cachedArtifactIds: fallbackPolicy.cachedArtifactIds,
      policy: fallbackPolicy,
      runtimeState,
    });
  }
}
