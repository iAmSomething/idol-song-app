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
  });
});
