import {
  getRuntimeConfig,
  getRuntimeConfigState,
  type MobileRuntimeConfig,
  type RuntimeConfigState,
} from './runtime';

export type MobileDebugMetadata = {
  profile: MobileRuntimeConfig['profile'];
  runtimeMode: RuntimeConfigState['mode'];
  runtimeIssues: string[];
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

export function getDebugMetadata(
  runtimeState: RuntimeConfigState = getRuntimeConfigState(),
): MobileDebugMetadata {
  const runtimeConfig = runtimeState.config;

  return {
    profile: runtimeConfig.profile,
    runtimeMode: runtimeState.mode,
    runtimeIssues: runtimeState.issues.map((issue) => issue.message),
    buildVersion: runtimeConfig.build.version,
    datasetVersion: runtimeConfig.dataSource.datasetVersion,
    commitSha: runtimeConfig.build.commitSha,
    dataSourceMode: runtimeConfig.dataSource.mode,
    remoteDatasetUrl: runtimeConfig.dataSource.remoteDatasetUrl,
    analyticsEnabled: runtimeConfig.featureGates.analytics,
    radarEnabled: runtimeConfig.featureGates.radar,
  };
}
