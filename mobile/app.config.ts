import type { ExpoConfig, ConfigContext } from 'expo/config';

type MobileProfile = 'development' | 'preview' | 'production';
type LoggingLevel = 'verbose' | 'debug' | 'error';
type DataSourceMode = 'bundled-static' | 'preview-static' | 'production-static';

type ProfileConfig = {
  name: string;
  slug: string;
  scheme: string;
  dataSourceMode: DataSourceMode;
  loggingLevel: LoggingLevel;
  featureGates: {
    radar: boolean;
    analytics: boolean;
    remoteRefresh: boolean;
    mvEmbed: boolean;
    shareActions: boolean;
  };
};

type RuntimeConfig = {
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
    commitSha: string | null;
  };
};

type EnvMap = Record<string, string | undefined>;

const PROFILE_CONFIG: Record<MobileProfile, ProfileConfig> = {
  development: {
    name: 'Idol Song App (Dev)',
    slug: 'idol-song-app-mobile-dev',
    scheme: 'idolsongapp-dev',
    dataSourceMode: 'bundled-static',
    loggingLevel: 'verbose',
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
    },
  },
  preview: {
    name: 'Idol Song App (Preview)',
    slug: 'idol-song-app-mobile-preview',
    scheme: 'idolsongapp-preview',
    dataSourceMode: 'preview-static',
    loggingLevel: 'debug',
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
    },
  },
  production: {
    name: 'Idol Song App',
    slug: 'idol-song-app-mobile',
    scheme: 'idolsongapp',
    dataSourceMode: 'production-static',
    loggingLevel: 'error',
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
    },
  },
};

function resolveProfile(rawValue: string | undefined): MobileProfile {
  const value = rawValue?.trim();

  if (!value) {
    return 'development';
  }

  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }

  throw new Error(`Unsupported APP_ENV "${value}". Expected development, preview, or production.`);
}

function optionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseBooleanOverride(value: string | undefined, fallback: boolean): boolean {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return fallback;
  }

  if (trimmed === 'true' || trimmed === '1') {
    return true;
  }

  if (trimmed === 'false' || trimmed === '0') {
    return false;
  }

  throw new Error(`Unsupported boolean env value "${value}". Expected true/false or 1/0.`);
}

function assertHttpUrl(value: string | null, envName: string): string | null {
  if (!value) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} must be an absolute http(s) URL when provided.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${envName} must use http or https.`);
  }

  return parsed.toString();
}

function buildRuntimeConfig(profile: MobileProfile, profileConfig: ProfileConfig, env: EnvMap): RuntimeConfig {
  const apiBaseUrl = assertHttpUrl(optionalString(env.EXPO_PUBLIC_API_BASE_URL), 'EXPO_PUBLIC_API_BASE_URL');
  const remoteDatasetUrl = assertHttpUrl(optionalString(env.EXPO_PUBLIC_REMOTE_DATASET_URL), 'EXPO_PUBLIC_REMOTE_DATASET_URL');
  const analyticsWriteKey = optionalString(env.EXPO_PUBLIC_ANALYTICS_WRITE_KEY);
  const datasetVersion = optionalString(env.EXPO_PUBLIC_DATASET_VERSION);
  const commitSha = optionalString(env.EXPO_PUBLIC_COMMIT_SHA);

  const featureGates = {
    radar: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_RADAR, profileConfig.featureGates.radar),
    analytics: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_ANALYTICS, profileConfig.featureGates.analytics),
    remoteRefresh: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_REMOTE_REFRESH, profileConfig.featureGates.remoteRefresh),
    mvEmbed: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_MV_EMBED, profileConfig.featureGates.mvEmbed),
    shareActions: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_SHARE_ACTIONS, profileConfig.featureGates.shareActions),
  };

  if (featureGates.remoteRefresh && !remoteDatasetUrl) {
    throw new Error('EXPO_PUBLIC_REMOTE_DATASET_URL is required when EXPO_PUBLIC_ENABLE_REMOTE_REFRESH is enabled.');
  }

  if (profile !== 'preview' && featureGates.remoteRefresh) {
    throw new Error('EXPO_PUBLIC_ENABLE_REMOTE_REFRESH is only supported for APP_ENV=preview.');
  }

  if (profile !== 'preview' && remoteDatasetUrl) {
    throw new Error('EXPO_PUBLIC_REMOTE_DATASET_URL is only supported for APP_ENV=preview.');
  }

  if (featureGates.analytics && !analyticsWriteKey) {
    throw new Error('EXPO_PUBLIC_ANALYTICS_WRITE_KEY is required when EXPO_PUBLIC_ENABLE_ANALYTICS is enabled.');
  }

  return {
    profile,
    dataSource: {
      mode: profileConfig.dataSourceMode,
      remoteDatasetUrl,
      datasetVersion,
    },
    services: {
      apiBaseUrl,
      analyticsWriteKey,
    },
    logging: {
      level: profileConfig.loggingLevel,
    },
    featureGates,
    build: {
      commitSha,
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = resolveProfile(process.env.APP_ENV);
  const profileConfig = PROFILE_CONFIG[profile];
  const runtimeConfig = buildRuntimeConfig(profile, profileConfig, process.env);

  return {
    ...config,
    name: profileConfig.name,
    slug: profileConfig.slug,
    version: '0.1.0',
    scheme: profileConfig.scheme,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    plugins: ['expo-router'],
    experiments: {
      typedRoutes: true,
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
    },
    extra: {
      ...config.extra,
      mobileProfile: profile,
      dataSource: {
        mode: profileConfig.dataSourceMode,
      },
      logging: {
        level: profileConfig.loggingLevel,
      },
      featureGates: profileConfig.featureGates,
      runtimeConfig,
    },
  };
};
