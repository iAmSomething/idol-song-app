import type {
  ArtistProfileRaw,
  MobileRawDataset,
  ReleaseArtworkRaw,
  ReleaseDetailRaw,
  ReleaseHistoryGroupRaw,
  ReleaseStreamCollectionRaw,
  YoutubeChannelAllowlistRaw,
} from '../types';

import { buildReleaseId, normalizeReleaseStream } from './normalize';

export type MobileSelectorContext = {
  dataset: MobileRawDataset;
  profilesBySlug: Map<string, ArtistProfileRaw>;
  profilesByGroup: Map<string, ArtistProfileRaw>;
  releaseCollectionsByGroup: Map<string, ReleaseStreamCollectionRaw>;
  releaseHistoryByGroup: Map<string, ReleaseHistoryGroupRaw>;
  upcomingByGroup: Map<string, MobileRawDataset['upcomingCandidates']>;
  allowlistsByGroup: Map<string, YoutubeChannelAllowlistRaw>;
  artworkByReleaseId: Map<string, ReleaseArtworkRaw>;
  detailByReleaseId: Map<string, ReleaseDetailRaw>;
};

export function createSelectorContext(dataset: MobileRawDataset): MobileSelectorContext {
  const profilesBySlug = new Map(dataset.artistProfiles.map((profile) => [profile.slug, profile]));
  const profilesByGroup = new Map(dataset.artistProfiles.map((profile) => [profile.group, profile]));
  const releaseCollectionsByGroup = new Map(dataset.releases.map((entry) => [entry.group, entry]));
  const releaseHistoryByGroup = new Map(dataset.releaseHistory.map((entry) => [entry.group, entry]));
  const upcomingByGroup = new Map<string, MobileRawDataset['upcomingCandidates']>();
  const allowlistsByGroup = new Map(dataset.youtubeChannelAllowlists.map((entry) => [entry.group, entry]));

  for (const upcoming of dataset.upcomingCandidates) {
    const existing = upcomingByGroup.get(upcoming.group) ?? [];
    existing.push(upcoming);
    upcomingByGroup.set(upcoming.group, existing);
  }

  const artworkByReleaseId = new Map<string, ReleaseArtworkRaw>();
  for (const artwork of dataset.releaseArtwork) {
    artworkByReleaseId.set(
      buildReleaseId(artwork.group, artwork.release_title, artwork.release_date, normalizeReleaseStream(artwork.stream)),
      artwork,
    );
  }

  const detailByReleaseId = new Map<string, ReleaseDetailRaw>();
  for (const detail of dataset.releaseDetails) {
    detailByReleaseId.set(
      buildReleaseId(detail.group, detail.release_title, detail.release_date, normalizeReleaseStream(detail.stream)),
      detail,
    );
  }

  return {
    dataset,
    profilesBySlug,
    profilesByGroup,
    releaseCollectionsByGroup,
    releaseHistoryByGroup,
    upcomingByGroup,
    allowlistsByGroup,
    artworkByReleaseId,
    detailByReleaseId,
  };
}
