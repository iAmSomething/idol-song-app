import { getRuntimeConfig, type MobileRuntimeConfig } from './runtime';

export type MobileDebugMetadata = {
  profile: MobileRuntimeConfig['profile'];
  buildVersion: string;
  datasetVersion: string | null;
  commitSha: string | null;
  dataSourceMode: MobileRuntimeConfig['dataSource']['mode'];
  remoteDatasetUrl: string | null;
  analyticsEnabled: boolean;
  radarEnabled: boolean;
};

export function isDebugMetadataAvailable(runtimeConfig: MobileRuntimeConfig = getRuntimeConfig()): boolean {
  return runtimeConfig.profile !== 'production';
}

export function getDebugMetadata(runtimeConfig: MobileRuntimeConfig = getRuntimeConfig()): MobileDebugMetadata {
  return {
    profile: runtimeConfig.profile,
    buildVersion: runtimeConfig.build.version,
    datasetVersion: runtimeConfig.dataSource.datasetVersion,
    commitSha: runtimeConfig.build.commitSha,
    dataSourceMode: runtimeConfig.dataSource.mode,
    remoteDatasetUrl: runtimeConfig.dataSource.remoteDatasetUrl,
    analyticsEnabled: runtimeConfig.featureGates.analytics,
    radarEnabled: runtimeConfig.featureGates.radar,
  };
}
