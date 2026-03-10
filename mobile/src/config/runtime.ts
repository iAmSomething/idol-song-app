import Constants from 'expo-constants';

export type MobileProfile = 'development' | 'preview' | 'production';
export type LoggingLevel = 'verbose' | 'debug' | 'error';
export type DataSourceMode = 'bundled-static' | 'backend-api';

const EXPECTED_MODE_BY_PROFILE: Record<MobileProfile, DataSourceMode> = {
  development: 'bundled-static',
  preview: 'backend-api',
  production: 'backend-api',
};

export type MobileRuntimeConfig = {
  profile: MobileProfile;
  dataSource: {
    mode: DataSourceMode;
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

export type RuntimeConfigIssueKind = 'missing_runtime_config' | 'invalid_runtime_config';

export type RuntimeConfigIssue = {
  kind: RuntimeConfigIssueKind;
  message: string;
};

export type RuntimeConfigState = {
  mode: 'normal' | 'degraded';
  config: MobileRuntimeConfig;
  issues: RuntimeConfigIssue[];
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

  if (fieldValue === 'bundled-static' || fieldValue === 'backend-api') {
    return fieldValue;
  }

  throw new Error('Invalid runtime config field: dataSource.mode has an unsupported value.');
}

function readProfileHint(value: unknown): MobileProfile | null {
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }

  return null;
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

  if (config.dataSource.mode !== EXPECTED_MODE_BY_PROFILE[config.profile]) {
    throw new Error('Runtime config dataSource.mode does not match the active mobile profile.');
  }

  if (config.featureGates.remoteRefresh) {
    throw new Error('Runtime config no longer supports featureGates.remoteRefresh.');
  }

  if (config.profile !== 'development' && config.dataSource.mode === 'backend-api' && !config.services.apiBaseUrl) {
    throw new Error('Runtime config requires services.apiBaseUrl when backend-api mode is enabled.');
  }

  if (config.featureGates.analytics && !config.services.analyticsWriteKey) {
    throw new Error('Runtime config requires services.analyticsWriteKey when analytics is enabled.');
  }

  return config;
}

function getDefaultLoggingLevel(profile: MobileProfile): LoggingLevel {
  if (profile === 'production') {
    return 'error';
  }

  return profile === 'preview' ? 'debug' : 'verbose';
}

function buildDegradedRuntimeConfig(
  profile: MobileProfile,
  buildVersion: string | null,
): MobileRuntimeConfig {
  return {
    profile,
    dataSource: {
      mode: EXPECTED_MODE_BY_PROFILE[profile],
      datasetVersion: null,
    },
    services: {
      apiBaseUrl: null,
      analyticsWriteKey: null,
    },
    logging: {
      level: getDefaultLoggingLevel(profile),
    },
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
    },
    build: {
      version: buildVersion ?? '0.1.0',
      commitSha: null,
    },
  };
}

export function resolveRuntimeConfigState(
  input: unknown,
  profileHint: MobileProfile | null = null,
  buildVersion: string | null = null,
): RuntimeConfigState {
  try {
    return {
      mode: 'normal',
      config: parseRuntimeConfig(input),
      issues: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown runtime config failure.';

    return {
      mode: 'degraded',
      config: buildDegradedRuntimeConfig(profileHint ?? 'production', buildVersion),
      issues: [
        {
          kind: input == null ? 'missing_runtime_config' : 'invalid_runtime_config',
          message,
        },
      ],
    };
  }
}

let cachedState: RuntimeConfigState | null = null;

export function resetRuntimeConfigState(): void {
  cachedState = null;
}

export function getRuntimeConfigState(): RuntimeConfigState {
  if (cachedState) {
    return cachedState;
  }

  const expoConfig = Constants.expoConfig;
  const extra = expoConfig?.extra;
  const profileHint = isRecord(extra) ? readProfileHint(extra.mobileProfile) : null;
  const runtimeConfig = isRecord(extra) ? extra.runtimeConfig : null;

  cachedState = resolveRuntimeConfigState(runtimeConfig, profileHint, expoConfig?.version ?? null);
  return cachedState;
}

export function getRuntimeConfig(): MobileRuntimeConfig {
  return getRuntimeConfigState().config;
}
