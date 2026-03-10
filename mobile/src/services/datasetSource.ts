import { getRuntimeConfig, type MobileRuntimeConfig } from '../config/runtime';

export type DatasetContractId = 'idol-song-mobile-static-v1';
export type DatasetSourceKind = 'bundled-static';
export type DatasetArtifactId =
  | 'artistProfiles'
  | 'releases'
  | 'releaseArtwork'
  | 'releaseDetails'
  | 'releaseHistory'
  | 'watchlist'
  | 'upcomingCandidates'
  | 'teamBadgeAssets'
  | 'youtubeChannelAllowlists'
  | 'radarChangeFeed';
export type DatasetFreshnessClass = 'stable-profile' | 'rolling-release' | 'rolling-upcoming';

export type DatasetArtifactDescriptor = {
  id: DatasetArtifactId;
  freshnessClass: DatasetFreshnessClass;
  relativePath: string;
};

type DatasetSelectionBase = {
  kind: DatasetSourceKind;
  contractId: DatasetContractId;
  datasetVersion: string | null;
  mixingAllowed: false;
  artifacts: DatasetArtifactDescriptor[];
};

export type BundledDatasetSelection = DatasetSelectionBase & {
  kind: 'bundled-static';
  reason: 'profile_default' | 'backend_api_mode' | 'runtime_degraded';
  bundledBasePath: string;
};
export type DatasetSelection = BundledDatasetSelection;

export const DATASET_CONTRACT_ID: DatasetContractId = 'idol-song-mobile-static-v1';
export const BUNDLED_DATASET_BASE_PATH = 'mobile/assets/datasets/v1';

export const DATASET_ARTIFACTS: DatasetArtifactDescriptor[] = [
  {
    id: 'artistProfiles',
    freshnessClass: 'stable-profile',
    relativePath: 'artistProfiles.json',
  },
  {
    id: 'releases',
    freshnessClass: 'rolling-release',
    relativePath: 'releases.json',
  },
  {
    id: 'releaseArtwork',
    freshnessClass: 'stable-profile',
    relativePath: 'releaseArtwork.json',
  },
  {
    id: 'releaseDetails',
    freshnessClass: 'stable-profile',
    relativePath: 'releaseDetails.json',
  },
  {
    id: 'releaseHistory',
    freshnessClass: 'rolling-release',
    relativePath: 'releaseHistory.json',
  },
  {
    id: 'watchlist',
    freshnessClass: 'rolling-upcoming',
    relativePath: 'watchlist.json',
  },
  {
    id: 'upcomingCandidates',
    freshnessClass: 'rolling-upcoming',
    relativePath: 'upcomingCandidates.json',
  },
  {
    id: 'teamBadgeAssets',
    freshnessClass: 'stable-profile',
    relativePath: 'teamBadgeAssets.json',
  },
  {
    id: 'youtubeChannelAllowlists',
    freshnessClass: 'stable-profile',
    relativePath: 'youtubeChannelAllowlists.json',
  },
  {
    id: 'radarChangeFeed',
    freshnessClass: 'rolling-upcoming',
    relativePath: 'radarChangeFeed.json',
  },
];

export function createBundledDatasetSelection(
  datasetVersion: string | null,
  reason: BundledDatasetSelection['reason'],
): BundledDatasetSelection {
  return {
    kind: 'bundled-static',
    reason,
    contractId: DATASET_CONTRACT_ID,
    datasetVersion,
    mixingAllowed: false,
    bundledBasePath: BUNDLED_DATASET_BASE_PATH,
    artifacts: DATASET_ARTIFACTS,
  };
}

export function selectDatasetSource(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): DatasetSelection {
  return createBundledDatasetSelection(
    runtimeConfig.dataSource.datasetVersion,
    runtimeConfig.dataSource.mode === 'backend-api' ? 'backend_api_mode' : 'profile_default',
  );
}

export function isBundledDatasetSelection(selection: DatasetSelection): selection is BundledDatasetSelection {
  return selection.kind === 'bundled-static';
}
