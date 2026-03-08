import {
  buildServiceSearchFallbackUrl,
  openServiceHandoff,
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
      browserFallbackUrl: 'https://example.com/browser-safe-spotify',
    });

    if ('ok' in handoff) {
      throw new Error('Expected a handoff resolution.');
    }

    const opened: string[] = [];
    const result = await openServiceHandoff(
      handoff,
      createLinkingAdapter({
        canOpen: async (url) => url === 'https://example.com/browser-safe-spotify',
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
      openedUrl: 'https://example.com/browser-safe-spotify',
    });
    expect(opened).toEqual(['https://example.com/browser-safe-spotify']);
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
});
