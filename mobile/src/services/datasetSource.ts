import { getRuntimeConfig, type MobileRuntimeConfig } from '../config/runtime';

export type DatasetContractId = 'idol-song-mobile-static-v1';
export type DatasetSourceKind = 'bundled-static' | 'backend-api';
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
  reason: 'profile_default' | 'backend_primary_fallback' | 'runtime_degraded';
  bundledBasePath: string;
};

export type BackendDatasetSelection = DatasetSelectionBase & {
  kind: 'backend-api';
  reason: 'profile_default';
  apiBaseUrl: string;
  bundledFallbackBasePath: string;
};

export type DatasetSelection = BundledDatasetSelection | BackendDatasetSelection;

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

export function createBackendDatasetSelection(
  datasetVersion: string | null,
  apiBaseUrl: string,
): BackendDatasetSelection {
  return {
    kind: 'backend-api',
    reason: 'profile_default',
    contractId: DATASET_CONTRACT_ID,
    datasetVersion,
    mixingAllowed: false,
    apiBaseUrl,
    bundledFallbackBasePath: BUNDLED_DATASET_BASE_PATH,
    artifacts: DATASET_ARTIFACTS,
  };
}

export function selectDatasetSource(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): DatasetSelection {
  if (runtimeConfig.dataSource.mode === 'backend-api' && runtimeConfig.services.apiBaseUrl) {
    return createBackendDatasetSelection(
      runtimeConfig.dataSource.datasetVersion,
      runtimeConfig.services.apiBaseUrl,
    );
  }

  return createBundledDatasetSelection(runtimeConfig.dataSource.datasetVersion, 'profile_default');
}

export function isBundledDatasetSelection(selection: DatasetSelection): selection is BundledDatasetSelection {
  return selection.kind === 'bundled-static';
}

export function isBackendDatasetSelection(selection: DatasetSelection): selection is BackendDatasetSelection {
  return selection.kind === 'backend-api';
}
