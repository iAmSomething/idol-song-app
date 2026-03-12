import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBridgeSearchApiData, normalizeBridgeSearchTerm, type BridgeSearchIndex } from './bridgeSearch'

const FIXTURE: BridgeSearchIndex = {
  entities: [
    {
      entity_slug: 'hearts2hearts',
      canonical_path: '/artists/hearts2hearts',
      display_name: 'Hearts2Hearts',
      canonical_name: 'Hearts2Hearts',
      entity_type: 'group',
      agency_name: 'SM Entertainment',
      search_terms: ['Hearts2Hearts', '하투하'],
    },
    {
      entity_slug: 'yena',
      canonical_path: '/artists/yena',
      display_name: 'YENA',
      canonical_name: 'YENA',
      entity_type: 'solo',
      agency_name: 'Yuehua Entertainment',
      search_terms: ['YENA', '최예나'],
    },
  ],
  releases: [
    {
      release_id: 'ive-revive',
      detail_path: '/artists/ive/releases/ive-revive',
      entity_path: '/artists/ive',
      entity_slug: 'ive',
      display_name: 'IVE',
      release_title: 'REVIVE+',
      release_date: '2026-02-23',
      stream: 'album',
      release_kind: 'ep',
      release_format: 'ep',
      search_terms: ['REVIVE+', '아이브 REVIVE+'],
    },
  ],
  upcoming: [
    {
      upcoming_signal_id: 'bts-upcoming',
      entity_path: '/artists/bts',
      entity_slug: 'bts',
      display_name: 'BTS',
      headline: 'Arirang BTS drops highly anticipated comeback album March 20',
      scheduled_date: '2026-03-20',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
      release_format: 'album',
      confidence_score: 0.84,
      source_type: 'news_rss',
      source_url: 'https://example.com/bts-comeback',
      source_domain: 'example.com',
      evidence_summary: 'BTS comeback coverage',
      search_terms: ['BTS', '방탄소년단'],
    },
  ],
}

test('normalizeBridgeSearchTerm keeps Korean aliases searchable and removes separators', () => {
  assert.equal(normalizeBridgeSearchTerm('Hearts 2 Hearts'), 'hearts2hearts')
  assert.equal(normalizeBridgeSearchTerm('하-투-하'), '하투하')
})

test('buildBridgeSearchApiData returns exact alias entity matches for Korean shorthand', () => {
  const result = buildBridgeSearchApiData(FIXTURE, '하투하')

  assert.equal(result.entities.length, 1)
  assert.equal(result.entities[0]?.entity_slug, 'hearts2hearts')
  assert.equal(result.entities[0]?.match_reason, 'alias_exact')
  assert.equal(result.entities[0]?.matched_alias, '하투하')
  assert.equal(result.releases.length, 0)
  assert.equal(result.upcoming.length, 0)
})

test('buildBridgeSearchApiData returns exact release-title matches without 404 semantics', () => {
  const result = buildBridgeSearchApiData(FIXTURE, 'REVIVE+')

  assert.equal(result.releases.length, 1)
  assert.equal(result.releases[0]?.release_id, 'ive-revive')
  assert.equal(result.releases[0]?.match_reason, 'release_title_exact')
  assert.equal(result.entities.length, 0)
  assert.equal(result.upcoming.length, 0)
})

test('buildBridgeSearchApiData returns empty arrays for unknown queries', () => {
  const result = buildBridgeSearchApiData(FIXTURE, 'definitely-not-found')

  assert.deepEqual(result, {
    entities: [],
    releases: [],
    upcoming: [],
  })
})
