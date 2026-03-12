import {
  buildEntitySourceDisclosure,
  buildReleaseDependencyDisclosure,
} from '../features/surfaceDisclosures';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';

import {
  selectCalendarMonthSnapshot,
  selectEntityDetailSnapshot,
  selectReleaseDetailById,
  selectSearchResults,
  selectTeamSummaryBySlug,
} from './index';
import { buildReleaseId } from './normalize';

describe('RN selector spec parity', () => {
  test('keeps exact upcoming, month-only upcoming, and nearest exact upcoming separate for calendar binding', () => {
    const dataset = cloneBundledDatasetFixture();

    const snapshot = selectCalendarMonthSnapshot(dataset, '2026-03', '2026-03-07');

    expect(snapshot.month).toBe('2026-03');
    expect(snapshot.exactUpcoming).toHaveLength(2);
    expect(snapshot.monthOnlyUpcoming).toHaveLength(1);
    expect(snapshot.exactUpcoming.every((item) => item.datePrecision === 'exact')).toBe(true);
    expect(snapshot.monthOnlyUpcoming.every((item) => item.datePrecision === 'month_only')).toBe(true);
    expect(snapshot.nearestUpcoming?.displayGroup).toBe('YENA');
    expect(snapshot.nearestUpcoming?.datePrecision).toBe('exact');
  });

  test('matches Korean alias and release title queries into display-model search segments', () => {
    const dataset = cloneBundledDatasetFixture();
    const yenaUpcoming = dataset.upcomingCandidates.find((item) => item.group === 'YENA');

    if (!yenaUpcoming) {
      throw new Error('Expected YENA upcoming fixture row to exist.');
    }

    const aliasResults = selectSearchResults(dataset, '최예나');
    expect(aliasResults.query).toBe('최예나');
    expect(aliasResults.entities[0]?.team.displayName).toBe('YENA');
    expect(aliasResults.entities[0]?.matchKind).toBe('alias_exact');

    const releaseResults = selectSearchResults(dataset, 'LOVE CATCHER');
    expect(releaseResults.releases[0]?.release.releaseTitle).toBe('LOVE CATCHER');
    expect(releaseResults.releases[0]?.matchKind).toBe('release_title_exact');

    const upcomingResults = selectSearchResults(dataset, yenaUpcoming.headline);
    expect(upcomingResults.upcoming).toHaveLength(0);
  });

  test('uses monogram and hidden links when team metadata is missing instead of inventing placeholders', () => {
    const dataset = cloneBundledDatasetFixture();
    const yenaProfile = dataset.artistProfiles.find((profile) => profile.slug === 'yena');
    const yenaUpcoming = dataset.upcomingCandidates.find((item) => item.group === 'YENA');
    const yenaRelease = dataset.releases.find((item) => item.group === 'YENA');
    const yenaAllowlist = dataset.youtubeChannelAllowlists.find((item) => item.group === 'YENA');
    const yenaHistory = dataset.releaseHistory.find((item) => item.group === 'YENA');

    if (!yenaProfile || !yenaUpcoming || !yenaRelease || !yenaAllowlist || !yenaHistory) {
      throw new Error('Expected YENA fixture rows to exist.');
    }

    yenaProfile.official_youtube_url = null;
    yenaProfile.official_x_url = null;
    yenaProfile.official_instagram_url = null;
    yenaProfile.artist_source_url = null;
    yenaAllowlist.primary_team_channel_url = null;
    yenaAllowlist.channels = [];
    yenaUpcoming.source_url = null;
    if (yenaRelease.latest_song) {
      yenaRelease.latest_song.source = undefined;
    }
    if (yenaRelease.latest_album) {
      yenaRelease.latest_album.source = undefined;
    }
    for (const release of yenaHistory.releases) {
      release.source = undefined;
    }

    const team = selectTeamSummaryBySlug(dataset, 'yena');
    const detail = selectEntityDetailSnapshot(dataset, 'yena');

    expect(team?.officialYoutubeUrl).toBeUndefined();
    expect(team?.officialXUrl).toBeUndefined();
    expect(team?.officialInstagramUrl).toBeUndefined();
    expect(team?.badge?.imageUrl).toBeUndefined();
    expect(team?.badge?.monogram).toBe('YE');
    expect(detail).not.toBeNull();
    expect(detail?.nextUpcoming).toBeNull();
    expect(detail?.sourceTimeline).toHaveLength(0);

    const disclosure = buildEntitySourceDisclosure(detail!);
    expect(disclosure?.body).toContain('아티스트 출처 · 미기재');
    expect(disclosure?.body).toContain('최신 발매 출처 · 미기재');
    expect(disclosure?.body).toContain('소스 타임라인 · 미해결');
  });

  test('keeps title-track and MV/service-link states explicit for release detail binding', () => {
    const dataset = cloneBundledDatasetFixture();
    const releaseId = buildReleaseId('YENA', 'LOVE CATCHER', '2026-03-11', 'album');
    const sparseReleaseId = buildReleaseId('AtHeart', 'Glow Up', '2025-11-18', 'song');
    const atHeartDetail = dataset.releaseDetails.find(
      (detail) => detail.group === 'AtHeart' && detail.release_title === 'Glow Up',
    );

    if (!atHeartDetail) {
      throw new Error('Expected AtHeart release detail fixture to exist.');
    }

    atHeartDetail.spotify_url = undefined;
    atHeartDetail.youtube_music_url = undefined;

    const resolved = selectReleaseDetailById(dataset, releaseId);
    const sparse = selectReleaseDetailById(dataset, sparseReleaseId);

    expect(resolved?.tracks.some((track) => track.isTitleTrack)).toBe(true);
    expect(resolved?.youtubeMusicUrl).toContain('music.youtube.com');
    expect(resolved?.youtubeVideoStatus).toBe('manual_override');

    expect(sparse?.spotifyUrl).toBeUndefined();
    expect(sparse?.youtubeMusicUrl).toBeUndefined();
    expect(sparse?.youtubeVideoStatus).toBe('no_mv');

    const disclosure = buildReleaseDependencyDisclosure(sparse!);
    expect(disclosure?.body).toContain('트랙 메타데이터 · 미기재');
    expect(disclosure?.body).toContain('음원 서비스 링크 · 미기재');
    expect(disclosure?.body).toContain('공식 MV · 조건부 없음');
  });
});
