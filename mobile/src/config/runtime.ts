import Constants from 'expo-constants';

export type MobileProfile = 'development' | 'preview' | 'production';
export type LoggingLevel = 'verbose' | 'debug' | 'error';
export type DataSourceMode = 'bundled-static' | 'preview-static' | 'production-static';

const EXPECTED_MODE_BY_PROFILE: Record<MobileProfile, DataSourceMode> = {
  development: 'bundled-static',
  preview: 'preview-static',
  production: 'production-static',
};

export type MobileRuntimeConfig = {
  profile: MobileProfile;
  dataSource: {
    mode: DataSourceMode;
    remoteDatasetUrl: string | null;
    datasetVersion: string | null;
  };
  services: {
    apiBaseUrl: string | null;
    analyticsWriteKey: string | null;
  };
  logging: {
    level: LoggingLevel;
  };
  featureGates: {
    radar: boolean;
    analytics: boolean;
    remoteRefresh: boolean;
    mvEmbed: boolean;
    shareActions: boolean;
  };
  build: {
    version: string;
    commitSha: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExpoEmptyObject(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function readString(value: unknown, fieldName: string, required = true): string | null {
  if (value == null) {
    if (required) {
      throw new Error(`Missing runtime config field: ${fieldName}`);
    }
    return null;
  }

  if (!required && isExpoEmptyObject(value)) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid runtime config field: ${fieldName} must be a string.`);
  }

  return value;
}

function readBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid runtime config field: ${fieldName} must be a boolean.`);
  }

  return value;
}

function readProfile(value: unknown): MobileProfile {
  const fieldValue = readString(value, 'profile');

  if (fieldValue === 'development' || fieldValue === 'preview' || fieldValue === 'production') {
    return fieldValue;
  }

  throw new Error('Invalid runtime config field: profile must be development, preview, or production.');
}

function readLoggingLevel(value: unknown): LoggingLevel {
  const fieldValue = readString(value, 'logging.level');

  if (fieldValue === 'verbose' || fieldValue === 'debug' || fieldValue === 'error') {
    return fieldValue;
  }

  throw new Error('Invalid runtime config field: logging.level must be verbose, debug, or error.');
}

function readDataSourceMode(value: unknown): DataSourceMode {
  const fieldValue = readString(value, 'dataSource.mode');

  if (fieldValue === 'bundled-static' || fieldValue === 'preview-static' || fieldValue === 'production-static') {
    return fieldValue;
  }

  throw new Error('Invalid runtime config field: dataSource.mode has an unsupported value.');
}

function readOptionalUrl(value: unknown, fieldName: string): string | null {
  const fieldValue = readString(value, fieldName, false);

  if (!fieldValue) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(fieldValue);
  } catch {
    throw new Error(`Invalid runtime config field: ${fieldName} must be an absolute http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid runtime config field: ${fieldName} must use http or https.`);
  }

  return parsed.toString();
}

export function parseRuntimeConfig(input: unknown): MobileRuntimeConfig {
  if (!isRecord(input)) {
    throw new Error('Missing runtime config payload.');
  }

  const dataSource = isRecord(input.dataSource) ? input.dataSource : null;
  const services = isRecord(input.services) ? input.services : null;
  const logging = isRecord(input.logging) ? input.logging : null;
  const featureGates = isRecord(input.featureGates) ? input.featureGates : null;
  const build = isRecord(input.build) ? input.build : null;

  if (!dataSource || !services || !logging || !featureGates || !build) {
    throw new Error('Runtime config is missing one or more required sections.');
  }

  const config: MobileRuntimeConfig = {
    profile: readProfile(input.profile),
    dataSource: {
      mode: readDataSourceMode(dataSource.mode),
      remoteDatasetUrl: readOptionalUrl(dataSource.remoteDatasetUrl, 'dataSource.remoteDatasetUrl'),
      datasetVersion: readString(dataSource.datasetVersion, 'dataSource.datasetVersion', false),
    },
    services: {
      apiBaseUrl: readOptionalUrl(services.apiBaseUrl, 'services.apiBaseUrl'),
      analyticsWriteKey: readString(services.analyticsWriteKey, 'services.analyticsWriteKey', false),
    },
    logging: {
      level: readLoggingLevel(logging.level),
    },
    featureGates: {
      radar: readBoolean(featureGates.radar, 'featureGates.radar'),
      analytics: readBoolean(featureGates.analytics, 'featureGates.analytics'),
      remoteRefresh: readBoolean(featureGates.remoteRefresh, 'featureGates.remoteRefresh'),
      mvEmbed: readBoolean(featureGates.mvEmbed, 'featureGates.mvEmbed'),
      shareActions: readBoolean(featureGates.shareActions, 'featureGates.shareActions'),
    },
    build: {
      version: readString(build.version, 'build.version') ?? '0.1.0',
      commitSha: readString(build.commitSha, 'build.commitSha', false),
    },
  };

  if (config.featureGates.remoteRefresh && !config.dataSource.remoteDatasetUrl) {
    throw new Error('Runtime config requires dataSource.remoteDatasetUrl when remoteRefresh is enabled.');
  }

  if (config.dataSource.mode !== EXPECTED_MODE_BY_PROFILE[config.profile]) {
    throw new Error('Runtime config dataSource.mode does not match the active mobile profile.');
  }

  if (config.profile !== 'preview' && config.featureGates.remoteRefresh) {
    throw new Error('Runtime config only allows remoteRefresh in the preview profile.');
  }

  if (config.profile !== 'preview' && config.dataSource.remoteDatasetUrl) {
    throw new Error('Runtime config only allows dataSource.remoteDatasetUrl in the preview profile.');
  }

  if (config.featureGates.analytics && !config.services.analyticsWriteKey) {
    throw new Error('Runtime config requires services.analyticsWriteKey when analytics is enabled.');
  }

  return config;
}

let cachedConfig: MobileRuntimeConfig | null = null;

export function getRuntimeConfig(): MobileRuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const extra = Constants.expoConfig?.extra;
  const runtimeConfig = isRecord(extra) ? extra.runtimeConfig : null;
  cachedConfig = parseRuntimeConfig(runtimeConfig);
  return cachedConfig;
}
