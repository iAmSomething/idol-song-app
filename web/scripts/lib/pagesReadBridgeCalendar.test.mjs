import test from 'node:test'
import assert from 'node:assert/strict'

import { suppressReleasedExactUpcoming } from './pagesReadBridgeCalendar.mjs'

test('suppressReleasedExactUpcoming removes same-day exact upcoming when verified release exists', () => {
  const payload = {
    summary: {
      verified_count: 1,
      exact_upcoming_count: 1,
      month_only_upcoming_count: 0,
    },
    nearest_upcoming: {
      entity_slug: 'p1harmony',
      display_name: 'P1Harmony',
      headline: 'UNIQUE today',
      scheduled_date: '2026-03-12',
      scheduled_month: '2026-03',
      date_precision: 'exact',
      date_status: 'confirmed',
    },
    days: [
      {
        date: '2026-03-12',
        verified_releases: [
          {
            entity_slug: 'p1harmony',
            release_date: '2026-03-12',
            release_title: 'UNIQUE',
          },
        ],
        exact_upcoming: [
          {
            entity_slug: 'p1harmony',
            display_name: 'P1Harmony',
            headline: 'UNIQUE today',
            scheduled_date: '2026-03-12',
            scheduled_month: '2026-03',
            date_precision: 'exact',
            date_status: 'confirmed',
          },
        ],
      },
    ],
    month_only_upcoming: [],
    verified_list: [
      {
        entity_slug: 'p1harmony',
        release_date: '2026-03-12',
        release_title: 'UNIQUE',
      },
    ],
    scheduled_list: [
      {
        entity_slug: 'p1harmony',
        display_name: 'P1Harmony',
        headline: 'UNIQUE today',
        scheduled_date: '2026-03-12',
        scheduled_month: '2026-03',
        date_precision: 'exact',
        date_status: 'confirmed',
      },
    ],
  }

  const suppressed = suppressReleasedExactUpcoming(payload)
  assert.equal(suppressed.days[0].exact_upcoming.length, 0)
  assert.equal(suppressed.scheduled_list.length, 0)
  assert.equal(suppressed.summary.exact_upcoming_count, 0)
  assert.equal(suppressed.nearest_upcoming, null)
})
