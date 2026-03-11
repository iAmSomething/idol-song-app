import {
  buildDatasetRiskDisclosure,
  buildEntitySourceDisclosure,
  buildReleaseDependencyDisclosure,
} from './surfaceDisclosures';

describe('surface disclosure helpers', () => {
  test('builds dataset risk disclosure only for degraded sources', () => {
    expect(
      buildDatasetRiskDisclosure(
        {
          activeSource: 'bundled-static',
          freshness: {
            rollingReferenceAt: null,
            staleFreshnessClasses: [],
          },
          sourceLabel: 'Bundled static dataset',
          runtimeState: { mode: 'normal' },
          issues: [],
        },
        '레이더',
        'radar-risk',
      ),
    ).toBeNull();

    expect(
      buildDatasetRiskDisclosure(
        {
          activeSource: 'backend-cache',
          freshness: {
            rollingReferenceAt: '2026-03-10T00:00:00.000Z',
            staleFreshnessClasses: ['rolling-release', 'rolling-upcoming'],
          },
          sourceLabel: 'Bundled static dataset',
          runtimeState: { mode: 'degraded' },
          issues: ['Preview remote dataset is unavailable.'],
        },
        '레이더',
        'radar-risk',
      ),
    ).toMatchObject({
      title: '데이터 최신화 유의',
      testID: 'radar-risk',
    });
  });

  test('flags entity source-confidence gaps', () => {
    expect(
      buildEntitySourceDisclosure({
        team: {
          slug: 'demo',
          group: 'Demo',
          displayName: 'Demo',
          actType: 'group',
          youtubeChannelUrls: [],
          searchTokens: [],
        },
        nextUpcoming: null,
        latestRelease: null,
        recentAlbums: [],
        sourceTimeline: [],
      }),
    ).toMatchObject({
      title: '소스 신뢰도',
      testID: 'entity-source-confidence-notice',
    });
    expect(
      buildEntitySourceDisclosure({
        team: {
          slug: 'demo',
          group: 'Demo',
          displayName: 'Demo',
          actType: 'group',
          youtubeChannelUrls: [],
          searchTokens: [],
        },
        nextUpcoming: {
          id: 'demo-upcoming',
          group: 'Demo',
          displayGroup: 'Demo',
          headline: 'Demo comeback',
          status: 'confirmed',
          datePrecision: 'exact',
          scheduledDate: '2026-03-20',
          sourceType: 'news_rss',
        },
        latestRelease: {
          id: 'demo-release',
          group: 'Demo',
          displayGroup: 'Demo',
          releaseTitle: 'Demo Release',
          releaseDate: '2026-01-01',
          contextTags: [],
        },
        recentAlbums: [],
        sourceTimeline: [],
      })?.body,
    ).toContain('아티스트 출처 · 미기재');
  });

  test('flags release dependency gaps', () => {
    expect(
      buildReleaseDependencyDisclosure({
        id: 'demo',
        group: 'Demo',
        displayGroup: 'Demo',
        releaseTitle: 'Demo Release',
        releaseDate: '2026-01-01',
        tracks: [],
        youtubeVideoStatus: 'unresolved',
      }),
    ).toMatchObject({
      title: '외부 링크 및 메타 상태',
      testID: 'release-detail-quality-notice',
    });
    expect(
      buildReleaseDependencyDisclosure({
        id: 'demo',
        group: 'Demo',
        displayGroup: 'Demo',
        releaseTitle: 'Demo Release',
        releaseDate: '2026-01-01',
        tracks: [],
        youtubeVideoStatus: 'no_link',
      })?.body,
    ).toContain('공식 MV · 조건부 없음');
  });
});
