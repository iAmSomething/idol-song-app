import type { ExpoConfig, ConfigContext } from 'expo/config';

type MobileProfile = 'development' | 'preview' | 'production';

type ProfileConfig = {
  name: string;
  slug: string;
  scheme: string;
  dataSourceMode: 'bundled-static' | 'preview-static' | 'production-static';
  loggingLevel: 'verbose' | 'debug' | 'error';
  featureGates: {
    radar: boolean;
    analytics: boolean;
    remoteRefresh: boolean;
    mvEmbed: boolean;
  };
};

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

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = resolveProfile(process.env.APP_ENV);
  const profileConfig = PROFILE_CONFIG[profile];

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
    },
  };
};
