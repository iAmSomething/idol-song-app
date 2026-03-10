import * as Linking from 'expo-linking';

export type ExternalLinkKind = 'official' | 'source' | 'artist_source';
export type ExternalLinkFailureCode =
  | 'external_link_unavailable'
  | 'external_link_blocked'
  | 'external_link_open_failed';

export type ExternalLinkResolution = {
  kind: ExternalLinkKind;
  url: string;
  host: string;
};

export type ExternalLinkFailure = {
  ok: false;
  kind: ExternalLinkKind;
  code: ExternalLinkFailureCode;
  attemptedUrl: string | null;
  host: string | null;
  feedback: {
    level: 'warning';
    retryable: boolean;
    message: '링크를 열 수 없습니다.' | '허용되지 않은 외부 링크입니다.' | '링크를 열 수 없습니다. 다시 시도해 주세요.';
  };
};

export type ExternalLinkSuccess = {
  ok: true;
  kind: ExternalLinkKind;
  openedUrl: string;
  host: string;
};

export type ExternalLinkResult = ExternalLinkSuccess | ExternalLinkFailure;

export type ExternalLinkingAdapter = {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
};

const DEFAULT_LINKING_ADAPTER: ExternalLinkingAdapter = {
  canOpenURL: Linking.canOpenURL,
  openURL: Linking.openURL,
};

const OFFICIAL_HOST_ROOTS = ['instagram.com', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be'] as const;
const SOURCE_HOST_ROOTS = [
  ...OFFICIAL_HOST_ROOTS,
  'musicbrainz.org',
  'naver.com',
  'news.google.com',
  'starnewskorea.com',
  'topstarnews.net',
  'weverse.io',
  'ygfamily.com',
] as const;

function matchesAllowedHost(host: string, allowedHosts: readonly string[]): boolean {
  return allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

function getAllowedHosts(kind: ExternalLinkKind): readonly string[] {
  if (kind === 'official') {
    return OFFICIAL_HOST_ROOTS;
  }

  return SOURCE_HOST_ROOTS;
}

function tryParseUrl(value: string | null | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isFailure(result: ExternalLinkResolution | ExternalLinkFailure): result is ExternalLinkFailure {
  return 'ok' in result;
}

export function normalizeExternalLinkUrl(
  kind: ExternalLinkKind,
  value: string | null | undefined,
): ExternalLinkResolution | ExternalLinkFailure {
  const parsed = tryParseUrl(value);

  if (!parsed) {
    return {
      ok: false,
      kind,
      code: 'external_link_unavailable',
      attemptedUrl: null,
      host: null,
      feedback: {
        level: 'warning',
        retryable: false,
        message: '링크를 열 수 없습니다.',
      },
    };
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    return {
      ok: false,
      kind,
      code: 'external_link_blocked',
      attemptedUrl: value ?? null,
      host: parsed.hostname || null,
      feedback: {
        level: 'warning',
        retryable: false,
        message: '허용되지 않은 외부 링크입니다.',
      },
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (!matchesAllowedHost(host, getAllowedHosts(kind))) {
    return {
      ok: false,
      kind,
      code: 'external_link_blocked',
      attemptedUrl: parsed.toString(),
      host,
      feedback: {
        level: 'warning',
        retryable: false,
        message: '허용되지 않은 외부 링크입니다.',
      },
    };
  }

  return {
    kind,
    url: parsed.toString(),
    host,
  };
}

export async function openExternalLink(
  link: ExternalLinkResolution | ExternalLinkFailure,
  adapter: ExternalLinkingAdapter = DEFAULT_LINKING_ADAPTER,
): Promise<ExternalLinkResult> {
  if (isFailure(link)) {
    return link;
  }

  try {
    const canOpen = await adapter.canOpenURL(link.url);
    if (!canOpen) {
      return {
        ok: false,
        kind: link.kind,
        code: 'external_link_open_failed',
        attemptedUrl: link.url,
        host: link.host,
        feedback: {
          level: 'warning',
          retryable: true,
          message: '링크를 열 수 없습니다. 다시 시도해 주세요.',
        },
      };
    }

    await adapter.openURL(link.url);
    return {
      ok: true,
      kind: link.kind,
      openedUrl: link.url,
      host: link.host,
    };
  } catch {
    return {
      ok: false,
      kind: link.kind,
      code: 'external_link_open_failed',
      attemptedUrl: link.url,
      host: link.host,
      feedback: {
        level: 'warning',
        retryable: true,
        message: '링크를 열 수 없습니다. 다시 시도해 주세요.',
      },
    };
  }
}
