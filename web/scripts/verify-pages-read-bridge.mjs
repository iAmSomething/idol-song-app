import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const bridgeRoot = path.join(webRoot, 'public', '__bridge', 'v1')

const calendarMonth = await readJson(path.join(bridgeRoot, 'calendar', 'months', '2026-02.json'))
const marchCalendarMonth = await readJson(path.join(bridgeRoot, 'calendar', 'months', '2026-03.json'))
const radar = await readJson(path.join(bridgeRoot, 'radar.json'))
const lookupId = buildReleaseLookupAssetId('blackpink', 'DEADLINE', '2026-02-26', 'album')
const lookup = await readJson(path.join(bridgeRoot, 'releases', 'lookups', `${lookupId}.json`))

if (!calendarMonth?.data?.days?.length) {
  throw new Error('Expected populated 2026-02 calendar bridge payload.')
}

if (!Array.isArray(radar?.data?.long_gap) || radar.data.long_gap.length === 0) {
  throw new Error('Expected populated radar long-gap payload.')
}

if (!Array.isArray(radar?.data?.rookie) || radar.data.rookie.length === 0) {
  throw new Error('Expected populated radar rookie payload.')
}

const march11 = marchCalendarMonth?.data?.days?.find((day) => day.date === '2026-03-11')
if (!march11) {
  throw new Error('Expected populated 2026-03-11 bridge calendar day.')
}

const yenaVerified = march11.verified_releases?.find((row) => row.display_name === 'YENA')
if (!yenaVerified) {
  throw new Error('Expected YENA to appear as a verified release on 2026-03-11.')
}

const yenaUpcoming = march11.exact_upcoming?.find((row) => row.display_name === 'YENA')
if (yenaUpcoming) {
  throw new Error('Did not expect YENA to remain in exact upcoming on 2026-03-11.')
}

if (marchCalendarMonth?.data?.nearest_upcoming?.display_name === 'YENA') {
  throw new Error('Did not expect nearest upcoming to keep YENA after same-day release promotion.')
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
      radarRequestId: radar?.meta?.request_id ?? null,
      lookupRequestId: lookup?.meta?.request_id ?? null,
      detailRequestId: detail?.meta?.request_id ?? null,
      marchNearestUpcoming: marchCalendarMonth?.data?.nearest_upcoming?.display_name ?? null,
      yenaVerifiedOnMarch11: Boolean(yenaVerified),
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
