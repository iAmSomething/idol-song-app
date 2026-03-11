import {
  buildEntityCenteredXSearchQuery,
  buildServiceSearchFallbackUrl,
  buildXSearchWebFallbackUrl,
  describeServiceHandoffBehavior,
  describeXSearchHandoffBehavior,
  openXSearchHandoff,
  openServiceHandoff,
  resolveXSearchHandoff,
  resolveServiceHandoff,
  resolveServiceHandoffGroup,
  type HandoffLinkingAdapter,
} from './handoff';

function createLinkingAdapter({
  canOpen = async () => true,
  open = async () => undefined,
}: {
  canOpen?: (url: string) => Promise<boolean>;
  open?: (url: string) => Promise<unknown>;
} = {}): HandoffLinkingAdapter {
  return {
    canOpenURL: canOpen,
    openURL: open,
  };
}

describe('mobile external handoff service', () => {
  test('builds service search fallback URLs with the expected service endpoints', () => {
    expect(buildServiceSearchFallbackUrl('spotify', 'IVE REVIVE+')).toBe(
      'https://open.spotify.com/search/IVE%20REVIVE%2B',
    );
    expect(buildServiceSearchFallbackUrl('youtubeMusic', 'IVE REVIVE+')).toBe(
      'https://music.youtube.com/search?q=IVE%20REVIVE%2B',
    );
    expect(buildServiceSearchFallbackUrl('youtubeMv', 'IVE REVIVE+')).toBe(
      'https://www.youtube.com/results?search_query=IVE%20REVIVE%2B%20official%20mv',
    );
    expect(buildXSearchWebFallbackUrl('"아이브" OR IVE "REBEL HEART"')).toBe(
      'https://x.com/search?q=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22&src=typed_query',
    );
  });

  test('builds alias-aware X queries from Korean, English, and representative aliases', () => {
    expect(
      buildEntityCenteredXSearchQuery({
        displayName: 'LOONA',
        searchTokens: ['이달의소녀', 'LOONA'],
      }),
    ).toEqual({
      query: '"이달의소녀" OR LOONA',
      mode: 'entity_only',
    });

    expect(
      buildEntityCenteredXSearchQuery({
        displayName: 'IVE',
        searchTokens: ['아이브'],
        releaseLabel: 'REBEL HEART',
      }),
    ).toEqual({
      query: '"아이브" OR IVE "REBEL HEART"',
      mode: 'release_backed',
    });

    expect(
      buildEntityCenteredXSearchQuery({
        displayName: 'Stray Kids',
        searchTokens: ['스트레이 키즈', '스트레이키즈', '스키즈'],
        releaseLabel: 'HOP',
      }),
    ).toEqual({
      query: '"스트레이 키즈" OR "Stray Kids" OR "스키즈" HOP',
      mode: 'release_backed',
    });
  });

  test('prefers canonical service URLs when they are safe and supported', () => {
    const handoff = resolveServiceHandoff({
      service: 'spotify',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://open.spotify.com/album/12345',
    });

    expect('ok' in handoff).toBe(false);
    if ('ok' in handoff) {
      throw new Error('Expected a handoff resolution, not a failure state.');
    }

    expect(handoff.mode).toBe('canonical');
    expect(handoff.primaryUrl).toBe('https://open.spotify.com/album/12345');
    expect(handoff.searchFallbackUrl).toBe('https://open.spotify.com/search/BLACKPINK%20DEADLINE');
    expect(handoff.browserFallbackUrl).toBe('https://open.spotify.com/search/BLACKPINK%20DEADLINE');
  });

  test('normalizes YouTube MV ids and short URLs into canonical watch URLs', () => {
    const fromId = resolveServiceHandoff({
      service: 'youtubeMv',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: '2GJfWMYCWY0',
    });
    const fromShortUrl = resolveServiceHandoff({
      service: 'youtubeMv',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://youtu.be/2GJfWMYCWY0',
    });

    if ('ok' in fromId || 'ok' in fromShortUrl) {
      throw new Error('Expected canonical MV resolutions.');
    }

    expect(fromId.primaryUrl).toBe('https://www.youtube.com/watch?v=2GJfWMYCWY0');
    expect(fromShortUrl.primaryUrl).toBe('https://www.youtube.com/watch?v=2GJfWMYCWY0');
  });

  test('falls back to service search when canonical URL is missing or unsupported', () => {
    const handoff = resolveServiceHandoff({
      service: 'youtubeMusic',
      query: 'YENA LOVE CATCHER',
      canonicalUrl: 'https://example.com/not-youtube-music',
    });

    expect('ok' in handoff).toBe(false);
    if ('ok' in handoff) {
      throw new Error('Expected a handoff resolution.');
    }

    expect(handoff.mode).toBe('searchFallback');
    expect(handoff.primaryUrl).toBe('https://music.youtube.com/search?q=YENA%20LOVE%20CATCHER');
    expect(handoff.browserFallbackUrl).toBeNull();
  });

  test('returns an explicit unavailable result when there is no canonical URL and no query', () => {
    const handoff = resolveServiceHandoff({
      service: 'spotify',
      query: '   ',
      canonicalUrl: null,
    });

    expect(handoff).toMatchObject({
      ok: false,
      code: 'handoff_unavailable',
      feedback: {
        retryable: false,
        message: '지금은 열 수 있는 서비스 경로가 없습니다.',
      },
    });
  });

  test('opens the canonical target when the primary URL can be opened', async () => {
    const handoff = resolveServiceHandoff({
      service: 'spotify',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://open.spotify.com/album/12345',
    });

    const opened: string[] = [];
    const result = await openServiceHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async () => true,
        open: async (url) => {
          opened.push(url);
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      service: 'spotify',
      mode: 'canonical',
      target: 'primary',
      openedUrl: 'https://open.spotify.com/album/12345',
    });
    expect(opened).toEqual(['https://open.spotify.com/album/12345']);
  });

  test('uses browser fallback when the primary target cannot be opened', async () => {
    const handoff = resolveServiceHandoff({
      service: 'spotify',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://open.spotify.com/album/12345',
      browserFallbackUrl: 'https://open.spotify.com/search/BLACKPINK%20DEADLINE',
    });

    if ('ok' in handoff) {
      throw new Error('Expected a handoff resolution.');
    }

    const opened: string[] = [];
    const result = await openServiceHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async (url) => url === 'https://open.spotify.com/search/BLACKPINK%20DEADLINE',
        open: async (url) => {
          opened.push(url);
        },
      }),
    );

    expect(result).toEqual({
      ok: true,
      service: 'spotify',
      mode: 'canonical',
      target: 'browserFallback',
      openedUrl: 'https://open.spotify.com/search/BLACKPINK%20DEADLINE',
    });
    expect(opened).toEqual(['https://open.spotify.com/search/BLACKPINK%20DEADLINE']);
  });

  test('drops unsafe browser fallback URLs and keeps safe search fallback instead', () => {
    const handoff = resolveServiceHandoff({
      service: 'spotify',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://open.spotify.com/album/12345',
      browserFallbackUrl: 'https://example.com/browser-safe-spotify',
    });

    if ('ok' in handoff) {
      throw new Error('Expected a handoff resolution.');
    }

    expect(handoff.browserFallbackUrl).toBe('https://open.spotify.com/search/BLACKPINK%20DEADLINE');
  });

  test('returns retryable failure metadata when no handoff target can be opened', async () => {
    const handoff = resolveServiceHandoff({
      service: 'youtubeMusic',
      query: 'YENA LOVE CATCHER',
      canonicalUrl: null,
    });

    const result = await openServiceHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async () => false,
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'handoff_open_failed',
      feedback: {
        retryable: true,
        message: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
      },
    });
  });

  test('builds a stable service group for later button layers', () => {
    const group = resolveServiceHandoffGroup({
      query: 'IVE REVIVE+',
      spotifyUrl: 'https://open.spotify.com/album/revive',
      youtubeMusicUrl: null,
      youtubeMvUrl: '2GJfWMYCWY0',
    });

    expect('ok' in group.spotify).toBe(false);
    expect('ok' in group.youtubeMusic).toBe(false);
    expect('ok' in group.youtubeMv).toBe(false);

    if ('ok' in group.spotify || 'ok' in group.youtubeMusic || 'ok' in group.youtubeMv) {
      throw new Error('Expected group handoffs to resolve to reusable handoff definitions.');
    }

    expect(group.spotify.mode).toBe('canonical');
    expect(group.youtubeMusic.mode).toBe('searchFallback');
    expect(group.youtubeMv.primaryUrl).toBe('https://www.youtube.com/watch?v=2GJfWMYCWY0');
  });

  test('describes installed-app and fallback behavior in Korean-first hints', () => {
    const canonical = resolveServiceHandoff({
      service: 'spotify',
      query: 'BLACKPINK DEADLINE',
      canonicalUrl: 'https://open.spotify.com/album/12345',
    });
    const searchFallback = resolveServiceHandoff({
      service: 'youtubeMusic',
      query: 'YENA LOVE CATCHER',
      canonicalUrl: null,
    });
    const unavailable = resolveServiceHandoff({
      service: 'youtubeMv',
      query: '   ',
      canonicalUrl: null,
    });

    expect(describeServiceHandoffBehavior(canonical)).toBe(
      'Spotify 앱이 있으면 앱으로, 없으면 안전한 웹 fallback으로 엽니다.',
    );
    expect(describeServiceHandoffBehavior(searchFallback)).toBe(
      'YouTube Music 설치 여부와 관계없이 검색 결과로 엽니다.',
    );
    expect(describeServiceHandoffBehavior(unavailable)).toBe(
      '현재는 연결 가능한 앱 또는 검색 경로가 아직 준비되지 않았습니다.',
    );
  });

  test('resolves X search handoff to app-first targets with web fallback', () => {
    const handoff = resolveXSearchHandoff({
      query: '"아이브" OR IVE "REBEL HEART"',
      mode: 'release_backed',
    });

    if ('ok' in handoff) {
      throw new Error('Expected an X handoff resolution.');
    }

    expect(handoff.mode).toBe('release_backed');
    expect(handoff.appUrls).toEqual([
      'twitter://search?query=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22',
      'x://search?query=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22',
    ]);
    expect(handoff.webUrl).toBe(
      'https://x.com/search?q=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22&src=typed_query',
    );
  });

  test('opens X app first and falls back to x.com when the app target is unavailable', async () => {
    const handoff = resolveXSearchHandoff({
      query: '"아이브" OR IVE "REBEL HEART"',
      mode: 'release_backed',
    });

    const opened: string[] = [];
    const appResult = await openXSearchHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async (url) => url.startsWith('twitter://'),
        open: async (url) => {
          opened.push(url);
        },
      }),
    );

    expect(appResult).toEqual({
      ok: true,
      mode: 'release_backed',
      target: 'app',
      openedUrl: 'twitter://search?query=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22',
    });

    opened.length = 0;
    const webResult = await openXSearchHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async (url) => url.startsWith('https://x.com/'),
        open: async (url) => {
          opened.push(url);
        },
      }),
    );

    expect(webResult).toEqual({
      ok: true,
      mode: 'release_backed',
      target: 'web',
      openedUrl:
        'https://x.com/search?q=%22%EC%95%84%EC%9D%B4%EB%B8%8C%22%20OR%20IVE%20%22REBEL%20HEART%22&src=typed_query',
    });
  });

  test('returns explicit unavailable or retryable failure states for X handoff', async () => {
    const unavailable = resolveXSearchHandoff({
      query: '   ',
    });
    expect(unavailable).toMatchObject({
      ok: false,
      code: 'handoff_unavailable',
      feedback: {
        retryable: false,
        message: '지금은 열 수 있는 X 검색 경로가 없습니다.',
      },
    });

    const retryable = await openXSearchHandoff(
      resolveXSearchHandoff({
        query: '"스트레이 키즈" OR "Stray Kids" OR "스키즈"',
      }),
      createLinkingAdapter({
        canOpen: async () => false,
      }),
    );
    expect(retryable).toMatchObject({
      ok: false,
      code: 'handoff_open_failed',
      feedback: {
        retryable: true,
        message: 'X를 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
      },
    });
    if (retryable.ok) {
      throw new Error('Expected the X search handoff to fail.');
    }
    expect(describeXSearchHandoffBehavior(retryable)).toBe(
      'X 앱 연결에 실패해도 현재 화면을 유지한 채 다시 시도할 수 있습니다.',
    );
  });
});
