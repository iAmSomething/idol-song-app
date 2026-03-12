import { getRuntimeConfig, type MobileRuntimeConfig } from '../config/runtime';

export type DatasetContractId = 'idol-song-mobile-static-v1';
export type DatasetSourceKind = 'backend-api';
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

export type BackendDatasetSelection = {
  kind: 'backend-api';
  reason: 'profile_default' | 'runtime_degraded';
  contractId: DatasetContractId;
  datasetVersion: string | null;
  mixingAllowed: false;
  apiBaseUrl: string | null;
  artifacts: DatasetArtifactDescriptor[];
};

export type DatasetSelection = BackendDatasetSelection;

export const DATASET_CONTRACT_ID: DatasetContractId = 'idol-song-mobile-static-v1';

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

export function createBackendDatasetSelection(
  datasetVersion: string | null,
  apiBaseUrl: string | null,
  reason: BackendDatasetSelection['reason'] = 'profile_default',
): BackendDatasetSelection {
  return {
    kind: 'backend-api',
    reason,
    contractId: DATASET_CONTRACT_ID,
    datasetVersion,
    mixingAllowed: false,
    apiBaseUrl,
    artifacts: DATASET_ARTIFACTS,
  };
}

export function selectDatasetSource(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): DatasetSelection {
  return createBackendDatasetSelection(
    runtimeConfig.dataSource.datasetVersion,
    runtimeConfig.services.apiBaseUrl,
    'profile_default',
  );
}

export function isBackendDatasetSelection(selection: DatasetSelection): selection is BackendDatasetSelection {
  return selection.kind === 'backend-api';
}
