import * as Linking from 'expo-linking';

export type MusicService = 'spotify' | 'youtubeMusic' | 'youtubeMv';
export type ServiceHandoffMode = 'canonical' | 'searchFallback';
export type ServiceHandoffTarget = 'primary' | 'browserFallback';
export type ServiceHandoffFailureCode = 'handoff_unavailable' | 'handoff_open_failed';

export type ServiceHandoffResolution = {
  service: MusicService;
  mode: ServiceHandoffMode;
  query: string;
  primaryUrl: string;
  browserFallbackUrl: string | null;
  searchFallbackUrl: string;
};

export type ServiceHandoffFailure = {
  ok: false;
  code: ServiceHandoffFailureCode;
  service: MusicService;
  mode: ServiceHandoffMode;
  target: ServiceHandoffTarget | null;
  attemptedUrl: string | null;
  feedback: {
    level: 'warning';
    retryable: boolean;
    message:
      | '지금은 열 수 있는 서비스 경로가 없습니다.'
      | '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.';
  };
};

export type ServiceHandoffSuccess = {
  ok: true;
  service: MusicService;
  mode: ServiceHandoffMode;
  target: ServiceHandoffTarget;
  openedUrl: string;
};

export type ServiceHandoffResult = ServiceHandoffSuccess | ServiceHandoffFailure;

export type HandoffLinkingAdapter = {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<unknown>;
};

const DEFAULT_LINKING_ADAPTER: HandoffLinkingAdapter = {
  canOpenURL: Linking.canOpenURL,
  openURL: Linking.openURL,
};

const SERVICE_LABEL: Record<MusicService, string> = {
  spotify: 'Spotify',
  youtubeMusic: 'YouTube Music',
  youtubeMv: 'YouTube',
};

function isServiceHandoffFailure(
  handoff: ServiceHandoffResolution | ServiceHandoffFailure,
): handoff is ServiceHandoffFailure {
  return 'ok' in handoff;
}

const CANONICAL_HOSTS: Record<MusicService, Set<string>> = {
  spotify: new Set(['open.spotify.com']),
  youtubeMusic: new Set(['music.youtube.com']),
  youtubeMv: new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'youtu.be']),
};

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
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

function extractYouTubeVideoId(value: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  const parsed = tryParseUrl(value);
  if (!parsed) {
    return null;
  }

  if (parsed.hostname === 'youtu.be') {
    const candidate = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  if (!CANONICAL_HOSTS.youtubeMv.has(parsed.hostname)) {
    return null;
  }

  const watchId = parsed.searchParams.get('v');
  if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
    return watchId;
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const shortsId = pathParts[0] === 'shorts' ? pathParts[1] : null;
  return shortsId && /^[a-zA-Z0-9_-]{11}$/.test(shortsId) ? shortsId : null;
}

export function buildServiceSearchFallbackUrl(service: MusicService, query: string): string {
  const normalizedQuery = normalizeQuery(query);
  const encodedQuery = encodeURIComponent(normalizedQuery);

  if (service === 'spotify') {
    return `https://open.spotify.com/search/${encodedQuery}`;
  }

  if (service === 'youtubeMusic') {
    return `https://music.youtube.com/search?q=${encodedQuery}`;
  }

  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${normalizedQuery} official mv`)}`;
}

export function normalizeCanonicalServiceUrl(service: MusicService, value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (service === 'youtubeMv') {
    const videoId = extractYouTubeVideoId(value);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }

  const parsed = tryParseUrl(value);
  if (!parsed || parsed.protocol !== 'https:') {
    return null;
  }

  if (!CANONICAL_HOSTS[service].has(parsed.hostname)) {
    return null;
  }

  return parsed.toString();
}

function normalizeBrowserFallbackUrl(service: MusicService, value: string | null | undefined): string | null {
  return normalizeCanonicalServiceUrl(service, value);
}

export function resolveServiceHandoff(input: {
  service: MusicService;
  query: string;
  canonicalUrl?: string | null;
  browserFallbackUrl?: string | null;
}): ServiceHandoffResolution | ServiceHandoffFailure {
  const query = normalizeQuery(input.query);
  const searchFallbackUrl = buildServiceSearchFallbackUrl(input.service, query);
  const canonicalUrl = normalizeCanonicalServiceUrl(input.service, input.canonicalUrl);
  const browserFallbackUrl = normalizeBrowserFallbackUrl(input.service, input.browserFallbackUrl);

  if (canonicalUrl) {
    return {
      service: input.service,
      mode: 'canonical',
      query,
      primaryUrl: canonicalUrl,
      browserFallbackUrl:
        browserFallbackUrl && browserFallbackUrl !== canonicalUrl ? browserFallbackUrl : searchFallbackUrl,
      searchFallbackUrl,
    };
  }

  if (!query) {
    return {
      ok: false,
      code: 'handoff_unavailable',
      service: input.service,
      mode: 'searchFallback',
      target: null,
      attemptedUrl: null,
      feedback: {
        level: 'warning',
        retryable: false,
        message: '지금은 열 수 있는 서비스 경로가 없습니다.',
      },
    };
  }

  return {
    service: input.service,
    mode: 'searchFallback',
    query,
    primaryUrl: searchFallbackUrl,
    browserFallbackUrl: browserFallbackUrl && browserFallbackUrl !== searchFallbackUrl ? browserFallbackUrl : null,
    searchFallbackUrl,
  };
}

export async function openServiceHandoff(
  handoff: ServiceHandoffResolution | ServiceHandoffFailure,
  adapter: HandoffLinkingAdapter = DEFAULT_LINKING_ADAPTER,
): Promise<ServiceHandoffResult> {
  if (isServiceHandoffFailure(handoff)) {
    return handoff;
  }

  const resolvedHandoff: ServiceHandoffResolution = handoff;
  const attempts: { target: ServiceHandoffTarget; url: string }[] = [
    { target: 'primary', url: resolvedHandoff.primaryUrl },
  ];

  if (
    resolvedHandoff.browserFallbackUrl &&
    resolvedHandoff.browserFallbackUrl !== resolvedHandoff.primaryUrl
  ) {
    attempts.push({ target: 'browserFallback', url: resolvedHandoff.browserFallbackUrl });
  }

  for (const attempt of attempts) {
    try {
      const canOpen = await adapter.canOpenURL(attempt.url);
      if (!canOpen) {
        continue;
      }

      await adapter.openURL(attempt.url);
      return {
        ok: true,
        service: resolvedHandoff.service,
        mode: resolvedHandoff.mode,
        target: attempt.target,
        openedUrl: attempt.url,
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    code: 'handoff_open_failed',
    service: resolvedHandoff.service,
    mode: resolvedHandoff.mode,
    target: attempts.length > 1 ? 'browserFallback' : 'primary',
    attemptedUrl: attempts.at(-1)?.url ?? resolvedHandoff.primaryUrl,
    feedback: {
      level: 'warning',
      retryable: true,
      message: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
    },
  };
}

export function describeServiceHandoffBehavior(
  handoff: ServiceHandoffResolution | ServiceHandoffFailure,
): string {
  if (isServiceHandoffFailure(handoff)) {
    if (handoff.code === 'handoff_unavailable') {
      return '현재는 연결 가능한 앱 또는 검색 경로가 아직 준비되지 않았습니다.';
    }

    return '외부 앱 연결에 실패하면 현재 화면을 유지한 채 다시 시도할 수 있습니다.';
  }

  const serviceLabel = SERVICE_LABEL[handoff.service];

  if (handoff.mode === 'canonical') {
    return `${serviceLabel} 앱이 있으면 앱으로, 없으면 안전한 웹 fallback으로 엽니다.`;
  }

  return `${serviceLabel} 설치 여부와 관계없이 검색 결과로 엽니다.`;
}

export function resolveServiceHandoffGroup(input: {
  query: string;
  spotifyUrl?: string | null;
  youtubeMusicUrl?: string | null;
  youtubeMvUrl?: string | null;
}): Record<MusicService, ServiceHandoffResolution | ServiceHandoffFailure> {
  return {
    spotify: resolveServiceHandoff({
      service: 'spotify',
      query: input.query,
      canonicalUrl: input.spotifyUrl,
    }),
    youtubeMusic: resolveServiceHandoff({
      service: 'youtubeMusic',
      query: input.query,
      canonicalUrl: input.youtubeMusicUrl,
    }),
    youtubeMv: resolveServiceHandoff({
      service: 'youtubeMv',
      query: input.query,
      canonicalUrl: input.youtubeMvUrl,
    }),
  };
}
