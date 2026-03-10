import {
  normalizeExternalLinkUrl,
  openExternalLink,
  type ExternalLinkingAdapter,
} from './externalLinks';

function createLinkingAdapter({
  canOpen = async () => true,
  open = async () => undefined,
}: {
  canOpen?: (url: string) => Promise<boolean>;
  open?: (url: string) => Promise<unknown>;
} = {}): ExternalLinkingAdapter {
  return {
    canOpenURL: canOpen,
    openURL: open,
  };
}

describe('mobile external link guard', () => {
  test('accepts official social and source hosts on https only', () => {
    expect(normalizeExternalLinkUrl('official', 'https://www.instagram.com/tunexx_official/')).toEqual({
      kind: 'official',
      url: 'https://www.instagram.com/tunexx_official/',
      host: 'www.instagram.com',
    });
    expect(
      normalizeExternalLinkUrl(
        'source',
        'https://news.google.com/articles/CBMiUWh0dHBzOi8vd3d3LnN0YXJuZXdz',
      ),
    ).toEqual({
      kind: 'source',
      url: 'https://news.google.com/articles/CBMiUWh0dHBzOi8vd3d3LnN0YXJuZXdz',
      host: 'news.google.com',
    });
  });

  test('blocks unsupported protocols and unknown hosts', () => {
    expect(normalizeExternalLinkUrl('official', 'http://x.com/yena')).toMatchObject({
      ok: false,
      code: 'external_link_blocked',
    });
    expect(normalizeExternalLinkUrl('source', 'https://example.com/not-allowed')).toMatchObject({
      ok: false,
      code: 'external_link_blocked',
    });
  });

  test('returns unavailable when the link is missing', () => {
    expect(normalizeExternalLinkUrl('source', null)).toMatchObject({
      ok: false,
      code: 'external_link_unavailable',
      feedback: {
        retryable: false,
      },
    });
  });

  test('opens safe links and reports retryable failures when open fails', async () => {
    const resolved = normalizeExternalLinkUrl('official', 'https://www.youtube.com/@official_TUNEXX');
    const opened: string[] = [];

    const success = await openExternalLink(
      resolved,
      createLinkingAdapter({
        canOpen: async () => true,
        open: async (url) => {
          opened.push(url);
        },
      }),
    );

    expect(success).toEqual({
      ok: true,
      kind: 'official',
      openedUrl: 'https://www.youtube.com/@official_TUNEXX',
      host: 'www.youtube.com',
    });
    expect(opened).toEqual(['https://www.youtube.com/@official_TUNEXX']);

    const failure = await openExternalLink(
      resolved,
      createLinkingAdapter({
        canOpen: async () => false,
      }),
    );

    expect(failure).toMatchObject({
      ok: false,
      code: 'external_link_open_failed',
      feedback: {
        retryable: true,
      },
    });
  });
});
