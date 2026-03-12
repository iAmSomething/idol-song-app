import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { auditPagesReadBridge } from './pagesReadBridgeCoverage.mjs'

async function withBridgeFixture(callback) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idol-song-app-bridge-coverage-'))
  const webRoot = path.join(rootDir, 'web')
  const bridgeRoot = path.join(webRoot, 'public', '__bridge', 'v1')

  fs.mkdirSync(path.join(bridgeRoot, 'calendar', 'months'), { recursive: true })
  fs.mkdirSync(path.join(bridgeRoot, 'entities'), { recursive: true })
  fs.mkdirSync(path.join(bridgeRoot, 'releases', 'details'), { recursive: true })
  fs.mkdirSync(path.join(bridgeRoot, 'releases', 'lookups'), { recursive: true })
  fs.mkdirSync(path.join(bridgeRoot, 'search'), { recursive: true })
  fs.mkdirSync(path.join(bridgeRoot, 'meta'), { recursive: true })

  try {
    await callback({ webRoot, bridgeRoot })
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true })
  }
}

function writeJson(targetPath, data) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, JSON.stringify(data, null, 2))
}

function hashBridgeKey(value) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function lookupId(entitySlug, releaseTitle, releaseDate, stream) {
  return `lookup-${hashBridgeKey([entitySlug, releaseTitle, releaseDate, stream].join('::'))}`
}

test('auditPagesReadBridge passes for a complete bridge fixture', async () => {
  await withBridgeFixture(async ({ webRoot, bridgeRoot }) => {
    writeJson(path.join(bridgeRoot, 'meta', 'backend-target.json'), {
      data: { runtime_mode: 'bridge', target_environment: 'bridge' },
    })
    writeJson(path.join(bridgeRoot, 'entities', 'yena.json'), {
      data: {
        identity: { entity_slug: 'yena', display_name: 'YENA', canonical_name: 'YENA' },
        official_links: {
          youtube: 'https://www.youtube.com/@YENA_OFFICIAL',
          x: 'https://x.com/YENA_OFFICIAL',
          instagram: 'https://www.instagram.com/yena.jigumina',
        },
        youtube_channels: {
          primary_team_channel_url: 'https://www.youtube.com/@YENA_OFFICIAL',
        },
        latest_release: { release_id: 'release-1' },
        recent_albums: [{ release_id: 'release-1' }],
        source_timeline: [{ headline: 'timeline', source_url: 'https://example.com/source' }],
      },
    })
    writeJson(path.join(bridgeRoot, 'releases', 'details', 'release-1.json'), {
      data: {
        service_links: {
          spotify: { url: 'https://open.spotify.com/album/test' },
          youtube_music: { url: 'https://music.youtube.com/playlist?list=test' },
        },
        mv: { url: 'https://www.youtube.com/watch?v=test' },
      },
    })
    writeJson(path.join(bridgeRoot, 'releases', 'lookups', `${lookupId('yena', 'LOVE CATCHER', '2026-03-11', 'album')}.json`), {
      data: { release_id: 'release-1' },
    })
    writeJson(path.join(bridgeRoot, 'search', 'index.json'), {
      data: {
        entities: [
          {
            entity_slug: 'yena',
            display_name: 'YENA',
            canonical_name: 'YENA',
            search_terms: ['YENA'],
            latest_release: { release_id: 'release-1' },
          },
        ],
        releases: [
          {
            entity_slug: 'yena',
            release_title: 'LOVE CATCHER',
            release_date: '2026-03-11',
            stream: 'album',
            detail_path: '/artists/yena/releases/love-catcher?date=2026-03-11&stream=album',
            release_id: 'release-1',
          },
        ],
        upcoming: [],
      },
    })
    writeJson(path.join(bridgeRoot, 'calendar', 'months', '2026-03.json'), {
      data: {
        days: [
          {
            date: '2026-03-11',
            verified_releases: [{ entity_slug: 'yena', release_id: 'release-1', release_date: '2026-03-11' }],
            exact_upcoming: [],
          },
        ],
        scheduled_list: [],
        month_only_upcoming: [],
      },
    })
    writeJson(path.join(bridgeRoot, 'radar.json'), {
      data: {
        long_gap: [{ entity_slug: 'yena' }],
        rookie: [{ entity_slug: 'yena' }],
      },
    })

    const result = await auditPagesReadBridge({ webRoot })
    assert.equal(result.errors.length, 0)
    assert.equal(result.summary.searchEntities, 1)
  })
})

test('auditPagesReadBridge reports missing entity assets and stale same-day upcoming rows', async () => {
  await withBridgeFixture(async ({ webRoot, bridgeRoot }) => {
    writeJson(path.join(bridgeRoot, 'meta', 'backend-target.json'), {
      data: { runtime_mode: 'bridge', target_environment: 'bridge' },
    })
    writeJson(path.join(bridgeRoot, 'search', 'index.json'), {
      data: {
        entities: [
          {
            entity_slug: 'hearts2hearts',
            display_name: 'Hearts2Hearts',
            canonical_name: 'Hearts2Hearts',
            search_terms: ['Hearts2Hearts'],
            latest_release: null,
          },
        ],
        releases: [],
        upcoming: [],
      },
    })
    writeJson(path.join(bridgeRoot, 'entities', 'p1harmony.json'), {
      data: {
        identity: { entity_slug: 'p1harmony', display_name: 'P1Harmony', canonical_name: 'P1Harmony' },
        official_links: {},
        youtube_channels: {},
        latest_release: { release_id: 'release-1', release_date: '2026-03-12' },
        recent_albums: [],
        source_timeline: [],
      },
    })
    writeJson(path.join(bridgeRoot, 'search', 'index.json'), {
      data: {
        entities: [
          {
            entity_slug: 'hearts2hearts',
            display_name: 'Hearts2Hearts',
            canonical_name: 'Hearts2Hearts',
            search_terms: ['Hearts2Hearts'],
            latest_release: null,
          },
        ],
        releases: [],
        upcoming: [
          {
            entity_slug: 'p1harmony',
            headline: "P1Harmony's Hero's Return",
            scheduled_date: '2026-03-12',
            source_url: 'https://example.com/p1harmony',
          },
        ],
      },
    })
    writeJson(path.join(bridgeRoot, 'calendar', 'months', '2026-03.json'), {
      data: {
        days: [
          {
            date: '2026-03-12',
            verified_releases: [{ entity_slug: 'p1harmony', release_id: 'release-1', release_date: '2026-03-12' }],
            exact_upcoming: [{ entity_slug: 'p1harmony', scheduled_date: '2026-03-12' }],
          },
        ],
        scheduled_list: [],
        month_only_upcoming: [],
      },
    })
    writeJson(path.join(bridgeRoot, 'radar.json'), {
      data: { long_gap: [], rookie: [] },
    })

    const result = await auditPagesReadBridge({ webRoot })
    assert.equal(
      result.errors.some((error) => error.code === 'search_entity_missing_asset'),
      true,
    )
    assert.equal(
      result.errors.some((error) => error.code === 'calendar_stale_same_day_upcoming'),
      true,
    )
    assert.equal(
      result.errors.some((error) => error.code === 'search_upcoming_stale_same_day'),
      true,
    )
  })
})
