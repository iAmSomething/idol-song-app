import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditPagesReadBridge } from './lib/pagesReadBridgeCoverage.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const bridgeRoot = path.join(webRoot, 'public', '__bridge', 'v1')
const coverage = await auditPagesReadBridge({ webRoot })

if (coverage.errors.length > 0) {
  throw new Error(
    [
      `Bridge coverage audit found ${coverage.errors.length} issue(s).`,
      ...coverage.errors.slice(0, 10).map((error) => `${error.code}: ${error.message} ${JSON.stringify(error.context)}`),
    ].join('\n'),
  )
}

const calendarMonth = await readJson(path.join(bridgeRoot, 'calendar', 'months', '2026-02.json'))
const sameDayCalendarMonth = await readJson(path.join(bridgeRoot, 'calendar', 'months', '2026-03.json'))
const radar = await readJson(path.join(bridgeRoot, 'radar.json'))
const entity = await readJson(path.join(bridgeRoot, 'entities', 'yena.json'))
const searchIndex = await readJson(path.join(bridgeRoot, 'search', 'index.json'))
const lookupId = buildReleaseLookupAssetId('blackpink', 'DEADLINE', '2026-02-26', 'album')
const lookup = await readJson(path.join(bridgeRoot, 'releases', 'lookups', `${lookupId}.json`))

if (!calendarMonth?.data?.days?.length) {
  throw new Error('Expected populated 2026-02 calendar bridge payload.')
}

const p1HarmonyDay = sameDayCalendarMonth?.data?.days?.find?.((day) => day?.date === '2026-03-12')
if (!p1HarmonyDay) {
  throw new Error('Expected populated 2026-03-12 same-day bridge calendar payload.')
}

const p1HarmonyVerified = (p1HarmonyDay.verified_releases ?? []).find(
  (release) => release?.entity_slug === 'p1harmony' && release?.release_title === 'UNIQUE',
)
if (!p1HarmonyVerified) {
  throw new Error('Expected P1Harmony UNIQUE to appear in verified releases for 2026-03-12 bridge payload.')
}

const p1HarmonyUpcoming = (p1HarmonyDay.exact_upcoming ?? []).find((item) => item?.entity_slug === 'p1harmony')
if (p1HarmonyUpcoming) {
  throw new Error('Expected same-day bridge calendar payload to suppress P1Harmony exact upcoming once released.')
}

if (!Array.isArray(radar?.data?.long_gap) || radar.data.long_gap.length === 0) {
  throw new Error('Expected populated radar long-gap payload.')
}

if (!Array.isArray(radar?.data?.rookie) || radar.data.rookie.length === 0) {
  throw new Error('Expected populated radar rookie payload.')
}

if (entity?.data?.identity?.entity_slug !== 'yena') {
  throw new Error('Expected YENA bridge entity payload.')
}

if (!entity?.data?.latest_release?.release_title) {
  throw new Error('Expected YENA bridge entity payload to expose latest release summary.')
}

if (!Array.isArray(entity?.data?.recent_albums) || entity.data.recent_albums.length === 0) {
  throw new Error('Expected YENA bridge entity payload to expose recent albums.')
}

if (!Array.isArray(searchIndex?.data?.entities) || searchIndex.data.entities.length === 0) {
  throw new Error('Expected populated bridge search entity index.')
}

const p1HarmonySearchUpcoming = (searchIndex.data.upcoming ?? []).find((item) => item?.entity_slug === 'p1harmony')
if (p1HarmonySearchUpcoming) {
  throw new Error('Expected bridge search index to suppress P1Harmony same-day upcoming once released.')
}

const yenaSearchEntity = (searchIndex.data.entities ?? []).find((item) => item?.entity_slug === 'yena')
if (!yenaSearchEntity?.latest_release?.release_title) {
  throw new Error('Expected bridge search entity index to expose YENA latest release summary.')
}

if (!lookup?.data?.release_id) {
  throw new Error('Expected BLACKPINK DEADLINE bridge lookup to resolve a release_id.')
}

const detail = await readJson(path.join(bridgeRoot, 'releases', 'details', `${lookup.data.release_id}.json`))
if (!Array.isArray(detail?.data?.tracks) || detail.data.tracks.length === 0) {
  throw new Error('Expected BLACKPINK DEADLINE bridge detail to include tracks.')
}

console.log(
  JSON.stringify(
    {
      calendarRequestId: calendarMonth?.meta?.request_id ?? null,
      sameDayCalendarRequestId: sameDayCalendarMonth?.meta?.request_id ?? null,
      radarRequestId: radar?.meta?.request_id ?? null,
      entityRequestId: entity?.meta?.request_id ?? null,
      searchRequestId: searchIndex?.meta?.request_id ?? null,
      lookupRequestId: lookup?.meta?.request_id ?? null,
      detailRequestId: detail?.meta?.request_id ?? null,
      coverageSummary: coverage.summary,
      releaseId: lookup.data.release_id,
      trackCount: detail.data.tracks.length,
    },
    null,
    2,
  ),
)

function buildReleaseLookupAssetId(entitySlug, releaseTitle, releaseDate, stream) {
  return `lookup-${hashBridgeKey([entitySlug, releaseTitle, releaseDate, stream].join('::'))}`
}

function hashBridgeKey(value) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

async function readJson(targetPath) {
  const contents = await readFile(targetPath, 'utf8')
  return JSON.parse(contents)
}
