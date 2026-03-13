import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ExpoConfig, ConfigContext } from 'expo/config';

type MobileProfile = 'development' | 'preview' | 'production';
type LoggingLevel = 'verbose' | 'debug' | 'error';
type DataSourceMode = 'backend-api';

type ProfileConfig = {
  name: string;
  slug: string;
  scheme: string;
  iosBundleIdentifier: string;
  androidPackage: string;
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

type NativeIosConfig = {
  bundleIdentifier: string;
  appleTeamId: string | null;
};

type AndroidFirebaseConfig = {
  googleServicesFile: string | null;
};

type RuntimeConfig = {
  profile: MobileProfile;
  dataSource: {
    mode: DataSourceMode;
    datasetVersion: string | null;
  };
  services: {
    apiBaseUrl: string | null;
    analyticsWriteKey: string | null;
    expoProjectId: string | null;
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

type EnvMap = Record<string, string | undefined>;

const PROFILE_CONFIG: Record<MobileProfile, ProfileConfig> = {
  development: {
    name: 'Idol Song App (Dev)',
    slug: 'idol-song-app-mobile-dev',
    scheme: 'idolsongapp-dev',
    iosBundleIdentifier: 'com.anonymous.idolsongappmobile.dev',
    androidPackage: 'com.anonymous.idolsongappmobile.dev',
    dataSourceMode: 'backend-api',
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
    iosBundleIdentifier: 'com.anonymous.idolsongappmobile.preview',
    androidPackage: 'com.anonymous.idolsongappmobile.preview',
    dataSourceMode: 'backend-api',
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
    iosBundleIdentifier: 'com.anonymous.idolsongappmobile',
    androidPackage: 'com.anonymous.idolsongappmobile',
    dataSourceMode: 'backend-api',
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

function assertBundleIdentifier(value: string | null, envName: string): string | null {
  if (!value) {
    return null;
  }

  const pattern = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
  if (!pattern.test(value)) {
    throw new Error(`${envName} must be a reverse-DNS style bundle identifier.`);
  }

  return value;
}

function assertAppleTeamId(value: string | null, envName: string): string | null {
  if (!value) {
    return null;
  }

  if (!/^[A-Z0-9]{10}$/.test(value)) {
    throw new Error(`${envName} must be a 10-character Apple team identifier.`);
  }

  return value;
}

function resolveNativeIosConfig(profileConfig: ProfileConfig, env: EnvMap): NativeIosConfig {
  return {
    bundleIdentifier:
      assertBundleIdentifier(optionalString(env.EXPO_IOS_BUNDLE_IDENTIFIER), 'EXPO_IOS_BUNDLE_IDENTIFIER') ??
      profileConfig.iosBundleIdentifier,
    appleTeamId: assertAppleTeamId(optionalString(env.EXPO_IOS_APPLE_TEAM_ID), 'EXPO_IOS_APPLE_TEAM_ID'),
  };
}

function resolveAndroidFirebaseConfig(profile: MobileProfile, env: EnvMap): AndroidFirebaseConfig {
  const overridePath = optionalString(env.EXPO_ANDROID_GOOGLE_SERVICES_FILE);
  const defaultRelativePath = profile === 'production' ? './firebase/google-services.production.json' : null;
  const configuredPath = overridePath ?? defaultRelativePath;

  if (!configuredPath) {
    return {
      googleServicesFile: null,
    };
  }

  const absolutePath = resolve(__dirname, configuredPath);
  if (!existsSync(absolutePath)) {
    return {
      googleServicesFile: null,
    };
  }

  return {
    googleServicesFile: configuredPath,
  };
}

function buildRuntimeConfig(profile: MobileProfile, profileConfig: ProfileConfig, env: EnvMap): RuntimeConfig {
  const apiBaseUrl = assertHttpUrl(optionalString(env.EXPO_PUBLIC_API_BASE_URL), 'EXPO_PUBLIC_API_BASE_URL');
  const analyticsWriteKey = optionalString(env.EXPO_PUBLIC_ANALYTICS_WRITE_KEY);
  const expoProjectId = optionalString(env.EXPO_PUBLIC_EXPO_PROJECT_ID);
  const datasetVersion = optionalString(env.EXPO_PUBLIC_DATASET_VERSION);
  const buildVersion = optionalString(env.EXPO_PUBLIC_BUILD_VERSION) ?? '0.1.0';
  const commitSha = optionalString(env.EXPO_PUBLIC_COMMIT_SHA);

  const featureGates = {
    radar: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_RADAR, profileConfig.featureGates.radar),
    analytics: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_ANALYTICS, profileConfig.featureGates.analytics),
    remoteRefresh: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_REMOTE_REFRESH, profileConfig.featureGates.remoteRefresh),
    mvEmbed: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_MV_EMBED, profileConfig.featureGates.mvEmbed),
    shareActions: parseBooleanOverride(env.EXPO_PUBLIC_ENABLE_SHARE_ACTIONS, profileConfig.featureGates.shareActions),
  };

  if (featureGates.remoteRefresh) {
    throw new Error('EXPO_PUBLIC_ENABLE_REMOTE_REFRESH is no longer supported.');
  }

  if (profileConfig.dataSourceMode === 'backend-api' && !apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required for backend-api mobile builds.');
  }

  if (featureGates.analytics && !analyticsWriteKey) {
    throw new Error('EXPO_PUBLIC_ANALYTICS_WRITE_KEY is required when EXPO_PUBLIC_ENABLE_ANALYTICS is enabled.');
  }

  return {
    profile,
    dataSource: {
      mode: profileConfig.dataSourceMode,
      datasetVersion,
    },
    services: {
      apiBaseUrl,
      analyticsWriteKey,
      expoProjectId,
    },
    logging: {
      level: profileConfig.loggingLevel,
    },
    featureGates,
    build: {
      version: buildVersion,
      commitSha,
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = resolveProfile(process.env.APP_ENV);
  const profileConfig = PROFILE_CONFIG[profile];
  const runtimeConfig = buildRuntimeConfig(profile, profileConfig, process.env);
  const nativeIosConfig = resolveNativeIosConfig(profileConfig, process.env);
  const androidFirebaseConfig = resolveAndroidFirebaseConfig(profile, process.env);

  return {
    ...config,
    name: profileConfig.name,
    slug: profileConfig.slug,
    version: runtimeConfig.build.version,
    scheme: profileConfig.scheme,
    icon: './assets/app-icon/icon-app-store-1024.png',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    plugins: ['expo-router', 'expo-notifications'],
    experiments: {
      typedRoutes: true,
    },
    splash: {
      image: './assets/splash/splash-foreground.png',
      resizeMode: 'contain',
      backgroundColor: '#F6F3EE',
      dark: {
        image: './assets/splash/splash-foreground-dark.png',
        backgroundColor: '#171411',
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: nativeIosConfig.bundleIdentifier,
      ...(nativeIosConfig.appleTeamId ? { appleTeamId: nativeIosConfig.appleTeamId } : {}),
    },
    android: {
      predictiveBackGestureEnabled: false,
      package: profileConfig.androidPackage,
      ...(androidFirebaseConfig.googleServicesFile
        ? {
            googleServicesFile: androidFirebaseConfig.googleServicesFile,
          }
        : {}),
      adaptiveIcon: {
        foregroundImage: './assets/app-icon/icon-adaptive-foreground.png',
        monochromeImage: './assets/app-icon/icon-adaptive-monochrome.png',
        backgroundColor: '#241F18',
      },
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
