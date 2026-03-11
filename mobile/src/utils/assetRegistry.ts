import type { ImageSourcePropType } from 'react-native';

import type { ThemeScheme } from '../tokens/theme';
import type { TeamActType } from '../types';

export const placeholderAssets = {
  light: {
    cover: require('../../assets/placeholders/cover-fallback.png'),
    team: require('../../assets/placeholders/team-fallback.png'),
    emptyState: require('../../assets/placeholders/empty-state-fallback.png'),
  },
  dark: {
    cover: require('../../assets/placeholders/cover-fallback-dark.png'),
    team: require('../../assets/placeholders/team-fallback-dark.png'),
    emptyState: require('../../assets/placeholders/empty-state-fallback-dark.png'),
  },
} as const satisfies Record<ThemeScheme, Record<string, ImageSourcePropType>>;

export const serviceIconAssets = {
  spotify: require('../../assets/services/spotify.png'),
  youtubeMusic: require('../../assets/services/youtube-music.png'),
  youtubeMv: require('../../assets/services/youtube-mv.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export const badgeFallbackAssets = {
  light: {
    group: require('../../assets/badges/group-fallback.png'),
    solo: require('../../assets/badges/solo-fallback.png'),
    label: require('../../assets/badges/label-fallback.png'),
  },
  dark: {
    group: require('../../assets/badges/group-fallback-dark.png'),
    solo: require('../../assets/badges/solo-fallback-dark.png'),
    label: require('../../assets/badges/label-fallback-dark.png'),
  },
} as const satisfies Record<ThemeScheme, Record<string, ImageSourcePropType>>;

export const launchMarkAssets = {
  light: require('../../assets/app-icon/icon-adaptive-foreground.png'),
  dark: require('../../assets/app-icon/icon-launch-mark-dark.png'),
} as const satisfies Record<ThemeScheme, ImageSourcePropType>;

export type PlaceholderAssetKey = keyof typeof placeholderAssets.light;
export type ServiceIconAssetKey = keyof typeof serviceIconAssets;
export type BadgeFallbackAssetKey = keyof typeof badgeFallbackAssets.light;
export type FallbackArtVariant = PlaceholderAssetKey | BadgeFallbackAssetKey;

export function resolveBadgeFallbackAssetKey(
  actType?: TeamActType | 'label',
): BadgeFallbackAssetKey {
  switch (actType) {
    case 'solo':
      return 'solo';
    case 'label':
      return 'label';
    default:
      return 'group';
  }
}

export function resolveFallbackArtSource(
  variant: FallbackArtVariant,
  scheme: ThemeScheme = 'light',
): ImageSourcePropType {
  if (variant in placeholderAssets.light) {
    return placeholderAssets[scheme][variant as PlaceholderAssetKey];
  }

  return badgeFallbackAssets[scheme][variant as BadgeFallbackAssetKey];
}

export function resolveLaunchMarkSource(scheme: ThemeScheme = 'light'): ImageSourcePropType {
  return launchMarkAssets[scheme];
}
