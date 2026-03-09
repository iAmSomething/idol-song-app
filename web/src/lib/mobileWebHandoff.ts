export type MusicService = 'spotify' | 'youtube_music'
export type ServiceActionId = MusicService | 'youtube_mv'
export type MusicHandoffMode = 'canonical' | 'search'
export type MusicHandoffUrls = Partial<Record<MusicService, string>>
export type MusicHandoffLink = {
  service: ServiceActionId
  href: string
  mode: MusicHandoffMode
}

export type MobileHandoffPlatform = 'android' | 'ios' | 'other'
export type MobileWebBrowserContextId =
  | 'android_chrome'
  | 'ios_safari'
  | 'instagram_in_app_browser_ios'

export type MobileWebBrowserContext = {
  id: MobileWebBrowserContextId
  label: string
  platform: Exclude<MobileHandoffPlatform, 'other'>
  container: 'system_browser' | 'in_app_browser'
  qaClass: 'expected' | 'best_effort' | 'web_only'
  evidenceLabel: string
}

export type MobileWebHandoffQaRow = {
  browserContextId: MobileWebBrowserContextId
  browserContextLabel: string
  platform: Exclude<MobileHandoffPlatform, 'other'>
  container: MobileWebBrowserContext['container']
  qaClass: MobileWebBrowserContext['qaClass']
  service: ServiceActionId
  mode: MusicHandoffMode
  appInstalled: boolean
  webHref: string
  appHref: string | null
  codePath: 'app_first_then_web_fallback' | 'web_only'
  observedBehavior: string
  qaExpectation: string
  notes: string
}

type NavigatorLike = {
  userAgent: string
  platform?: string
  maxTouchPoints?: number
}

type ClickLikeEvent = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

const QA_SAMPLE_QUERY = 'YENA LOVE CATCHER'

export const MUSIC_HANDOFF_SERVICES: MusicService[] = ['spotify', 'youtube_music']

export const MOBILE_WEB_QA_BROWSER_CONTEXTS: MobileWebBrowserContext[] = [
  {
    id: 'android_chrome',
    label: 'Android Chrome',
    platform: 'android',
    container: 'system_browser',
    qaClass: 'expected',
    evidenceLabel: 'system browser / app-first intent or scheme path',
  },
  {
    id: 'ios_safari',
    label: 'iOS Safari',
    platform: 'ios',
    container: 'system_browser',
    qaClass: 'best_effort',
    evidenceLabel: 'system browser / custom-scheme app-first path',
  },
  {
    id: 'instagram_in_app_browser_ios',
    label: 'Instagram in-app browser (iOS)',
    platform: 'ios',
    container: 'in_app_browser',
    qaClass: 'best_effort',
    evidenceLabel: 'representative in-app browser / external-app jump may be suppressed',
  },
]

function extractYouTubeVideoId(value: string) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value
  }

  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.replace(/^\/+/, '').split('/')[0]
      return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : ''
    }

    const watchId = url.searchParams.get('v')
    if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) {
      return watchId
    }

    const pathSegments = url.pathname.split('/').filter(Boolean)
    const candidate = pathSegments.at(-1) || ''
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : ''
  } catch {
    return ''
  }
}

export function buildMusicSearchUrl(service: MusicService, query: string) {
  const encodedQuery = encodeURIComponent(query)
  if (service === 'spotify') {
    return `https://open.spotify.com/search/${encodedQuery}`
  }

  return `https://music.youtube.com/search?q=${encodedQuery}`
}

export function buildYouTubeMvSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} official mv`)}`
}

export function buildServiceActionLinks({
  group,
  title,
  canonicalUrls,
  mvUrl,
  includeMv = true,
  allowMvSearchFallback = true,
  searchTitles,
}: {
  group: string
  title: string
  canonicalUrls?: MusicHandoffUrls
  mvUrl?: string
  includeMv?: boolean
  allowMvSearchFallback?: boolean
  searchTitles?: Partial<Record<ServiceActionId, string>>
}): MusicHandoffLink[] {
  const defaultQuery = `${group} ${title}`.trim()
  const links: MusicHandoffLink[] = MUSIC_HANDOFF_SERVICES.map((service) => ({
    service,
    href:
      canonicalUrls?.[service] ||
      buildMusicSearchUrl(service, `${group} ${searchTitles?.[service] || title}`.trim()),
    mode: canonicalUrls?.[service] ? 'canonical' : 'search',
  }))

  if (includeMv && (mvUrl || allowMvSearchFallback)) {
    const mvSearchQuery = `${group} ${searchTitles?.youtube_mv || title}`.trim()
    links.push({
      service: 'youtube_mv',
      href: mvUrl || buildYouTubeMvSearchUrl(mvSearchQuery || defaultQuery),
      mode: mvUrl ? 'canonical' : 'search',
    })
  }

  return links
}

export function detectMobileHandoffPlatform(navigatorLike: NavigatorLike): MobileHandoffPlatform {
  const userAgent = navigatorLike.userAgent
  if (/android/i.test(userAgent)) {
    return 'android'
  }

  if (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigatorLike.platform === 'MacIntel' && (navigatorLike.maxTouchPoints || 0) > 1)
  ) {
    return 'ios'
  }

  return 'other'
}

export function getMobileHandoffPlatform(): MobileHandoffPlatform {
  if (typeof navigator === 'undefined') {
    return 'other'
  }

  return detectMobileHandoffPlatform(navigator)
}

export function extractSearchQueryFromPath(pathname: string) {
  if (!pathname.startsWith('/search/')) {
    return ''
  }

  return decodeURIComponent(pathname.slice('/search/'.length))
}

export function buildAndroidIntentUrl(webHref: string, packageName: string) {
  try {
    const url = new URL(webHref)
    const authorityPath = `${url.host}${url.pathname}${url.search}${url.hash}`
    return `intent://${authorityPath}#Intent;scheme=${url.protocol.replace(':', '')};package=${packageName};end`
  } catch {
    return ''
  }
}

export function buildSpotifyAppHref(webHref: string) {
  if (webHref.startsWith('spotify:')) {
    return webHref
  }

  try {
    const url = new URL(webHref)
    if (!url.hostname.includes('spotify.com')) {
      return ''
    }

    const searchQuery = extractSearchQueryFromPath(url.pathname)
    if (searchQuery) {
      return `spotify:search:${searchQuery}`
    }

    const segments = url.pathname.split('/').filter(Boolean)
    const [resourceType, resourceId] = segments
    if (!resourceType || !resourceId) {
      return ''
    }

    if (!['album', 'track', 'artist', 'playlist', 'show', 'episode'].includes(resourceType)) {
      return ''
    }

    return `spotify:${resourceType}:${resourceId}`
  } catch {
    return ''
  }
}

export function buildYouTubeAppHref(webHref: string, platform: MobileHandoffPlatform) {
  if (platform === 'android') {
    return buildAndroidIntentUrl(webHref, 'com.google.android.youtube')
  }

  if (platform !== 'ios') {
    return ''
  }

  try {
    const url = new URL(webHref)
    const videoId = extractYouTubeVideoId(webHref)
    if (videoId) {
      return `vnd.youtube://watch?v=${videoId}`
    }

    const searchQuery = url.searchParams.get('search_query')
    if (searchQuery) {
      return `vnd.youtube://results?search_query=${encodeURIComponent(searchQuery)}`
    }
  } catch {
    return ''
  }

  return ''
}

export function buildYouTubeMusicAppHref(webHref: string, platform: MobileHandoffPlatform) {
  if (platform !== 'android') {
    return ''
  }

  return buildAndroidIntentUrl(webHref, 'com.google.android.apps.youtube.music')
}

export function buildAppAwareHandoffHref(link: MusicHandoffLink, platform: MobileHandoffPlatform) {
  if (platform === 'other') {
    return ''
  }

  if (link.service === 'spotify') {
    return buildSpotifyAppHref(link.href)
  }

  if (link.service === 'youtube_music') {
    return buildYouTubeMusicAppHref(link.href, platform)
  }

  return buildYouTubeAppHref(link.href, platform)
}

export function openWebHandoff(href: string, platform: MobileHandoffPlatform) {
  if (typeof window === 'undefined') {
    return
  }

  if (platform !== 'other') {
    window.location.assign(href)
    return
  }

  const openedWindow = window.open(href, '_blank', 'noopener,noreferrer')
  if (!openedWindow) {
    window.location.assign(href)
  }
}

export function attemptMobileAppFirstHandoff(appHref: string, webHref: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  let handled = false
  let fallbackTimer = 0

  const cleanup = () => {
    if (handled) {
      return
    }

    handled = true
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer)
    }
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      cleanup()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  fallbackTimer = window.setTimeout(() => {
    if (document.visibilityState === 'visible') {
      cleanup()
      window.location.assign(webHref)
    }
  }, 900)

  try {
    window.location.assign(appHref)
  } catch {
    cleanup()
    window.location.assign(webHref)
  }
}

export function openMusicHandoff(link: MusicHandoffLink) {
  const platform = getMobileHandoffPlatform()
  const appHref = buildAppAwareHandoffHref(link, platform)

  if (!appHref) {
    openWebHandoff(link.href, platform)
    return
  }

  attemptMobileAppFirstHandoff(appHref, link.href)
}

export function shouldBypassManagedHandoff(event: ClickLikeEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function describeAppHref(appHref: string) {
  if (appHref.startsWith('intent://')) {
    return 'Android intent'
  }

  if (appHref.startsWith('spotify:')) {
    return 'Spotify app URI'
  }

  if (appHref.startsWith('vnd.youtube://')) {
    return 'YouTube iOS scheme'
  }

  return 'app-aware target'
}

function buildObservedBehavior(
  context: MobileWebBrowserContext,
  link: MusicHandoffLink,
  appInstalled: boolean,
  appHref: string | null,
) {
  if (!appHref) {
    return appInstalled
      ? `Opens the ${link.mode === 'canonical' ? 'canonical' : 'search'} ${link.service} web URL immediately. Installed state does not change behavior for this service/context.`
      : `Opens the ${link.mode === 'canonical' ? 'canonical' : 'search'} ${link.service} web URL immediately because no app-aware path exists here.`
  }

  const appTarget = describeAppHref(appHref)
  if (context.container === 'in_app_browser') {
    return appInstalled
      ? `Attempts ${appTarget} first inside the container. If the container keeps focus or suppresses the external-app jump, the same-service web URL loads after about 900ms.`
      : `No installed app target can be taken, so the in-app browser stays visible and the same-service web URL loads after about 900ms.`
  }

  if (context.platform === 'android') {
    return appInstalled
      ? `Attempts ${appTarget} first. If the external app opens, Chrome backgrounds; if Chrome stays visible, the same-service web URL loads after about 900ms.`
      : `Stays in Chrome and loads the same-service web URL after about 900ms when the external target does not open.`
  }

  return appInstalled
    ? `Attempts ${appTarget} first. Safari may show an intermediate prompt; if the page stays visible, the same-service web URL loads after about 900ms.`
    : `Safari remains visible and the same-service web URL loads after about 900ms if the custom-scheme jump is unavailable.`
}

function buildQaExpectation(context: MobileWebBrowserContext, appHref: string | null) {
  if (!appHref) {
    return 'web-only path should be treated as guaranteed for this browser context'
  }

  if (context.container === 'in_app_browser') {
    return 'best-effort app-open only; web fallback must remain available'
  }

  if (context.platform === 'android') {
    return 'app-first is expected; same-service web fallback must still be reachable'
  }

  return 'app-first is best-effort; same-service web fallback must remain reachable'
}

function buildNotes(context: MobileWebBrowserContext, link: MusicHandoffLink, appHref: string | null) {
  if (link.service === 'youtube_music' && context.platform === 'ios' && !appHref) {
    return 'Current web implementation has no iOS app-aware YouTube Music path, so this remains web-only even when the app is installed.'
  }

  if (context.container === 'in_app_browser') {
    return 'Use this row as the representative in-app browser scenario. External-app jump behavior can vary by container policy, so treat app-open as best-effort.'
  }

  if (context.platform === 'ios') {
    return 'Safari custom-scheme behavior can vary by prompt timing; confirm the same-service web fallback still wins when the browser stays visible.'
  }

  return 'Chrome should preserve the same-service web fallback even when the app target does not open.'
}

export function buildMobileWebHandoffQaRows() {
  const sampleLinks: MusicHandoffLink[] = [
    {
      service: 'spotify',
      mode: 'canonical',
      href: 'https://open.spotify.com/album/1234567890abcdefghijkl',
    },
    {
      service: 'spotify',
      mode: 'search',
      href: buildMusicSearchUrl('spotify', QA_SAMPLE_QUERY),
    },
    {
      service: 'youtube_music',
      mode: 'canonical',
      href: 'https://music.youtube.com/playlist?list=OLAK5uy_sample_release_object',
    },
    {
      service: 'youtube_music',
      mode: 'search',
      href: buildMusicSearchUrl('youtube_music', QA_SAMPLE_QUERY),
    },
    {
      service: 'youtube_mv',
      mode: 'canonical',
      href: 'https://www.youtube.com/watch?v=ABCDEFGHIJK',
    },
    {
      service: 'youtube_mv',
      mode: 'search',
      href: buildYouTubeMvSearchUrl(QA_SAMPLE_QUERY),
    },
  ]

  return MOBILE_WEB_QA_BROWSER_CONTEXTS.flatMap((context) =>
    sampleLinks.flatMap((link) =>
      [true, false].map((appInstalled) => {
        const appHref = buildAppAwareHandoffHref(link, context.platform) || null

        return {
          browserContextId: context.id,
          browserContextLabel: context.label,
          platform: context.platform,
          container: context.container,
          qaClass: !appHref ? 'web_only' : context.qaClass,
          service: link.service,
          mode: link.mode,
          appInstalled,
          webHref: link.href,
          appHref,
          codePath: appHref ? 'app_first_then_web_fallback' : 'web_only',
          observedBehavior: buildObservedBehavior(context, link, appInstalled, appHref),
          qaExpectation: buildQaExpectation(context, appHref),
          notes: buildNotes(context, link, appHref),
        } satisfies MobileWebHandoffQaRow
      }),
    ),
  )
}

export function buildMobileWebHandoffServiceNotes() {
  return [
    {
      service: 'spotify' as const,
      summary:
        'Android Chrome and iOS Safari both attempt app-first for canonical and search links. Search mode uses spotify:search on app-open and open.spotify.com/search as the same-service web fallback.',
    },
    {
      service: 'youtube_music' as const,
      summary:
        'Android Chrome attempts app-first with an Android intent for canonical and search links. iOS contexts have no app-aware YouTube Music path in the current web implementation, so they remain web-only.',
    },
    {
      service: 'youtube_mv' as const,
      summary:
        'Android Chrome uses Android intent app-open for both watch URLs and search URLs. iOS Safari uses the YouTube custom scheme; in-app browsers should be treated as best-effort for external-app jump and must preserve the same-service web fallback.',
    },
  ]
}
