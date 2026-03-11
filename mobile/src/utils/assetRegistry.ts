import type { ImageSourcePropType } from 'react-native';

import type { TeamActType } from '../types';

export const placeholderAssets = {
  cover: require('../../assets/placeholders/cover-fallback.png'),
  team: require('../../assets/placeholders/team-fallback.png'),
  emptyState: require('../../assets/placeholders/empty-state-fallback.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export const serviceIconAssets = {
  spotify: require('../../assets/services/spotify.png'),
  youtubeMusic: require('../../assets/services/youtube-music.png'),
  youtubeMv: require('../../assets/services/youtube-mv.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export const badgeFallbackAssets = {
  group: require('../../assets/badges/group-fallback.png'),
  solo: require('../../assets/badges/solo-fallback.png'),
  label: require('../../assets/badges/label-fallback.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type PlaceholderAssetKey = keyof typeof placeholderAssets;
export type ServiceIconAssetKey = keyof typeof serviceIconAssets;
export type BadgeFallbackAssetKey = keyof typeof badgeFallbackAssets;
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

export function resolveFallbackArtSource(variant: FallbackArtVariant): ImageSourcePropType {
  if (variant in placeholderAssets) {
    return placeholderAssets[variant as PlaceholderAssetKey];
  }

  return badgeFallbackAssets[variant as BadgeFallbackAssetKey];
}
