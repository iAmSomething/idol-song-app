import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildEntityDetailRecoverySearchTerms,
  pickEntityDetailRecoveryCandidate,
} from './entityDetailRecovery'

test('buildEntityDetailRecoverySearchTerms keeps raw slug and humanized form', () => {
  assert.deepEqual(buildEntityDetailRecoverySearchTerms('hearts2hearts'), ['hearts2hearts'])
  assert.deepEqual(buildEntityDetailRecoverySearchTerms('nct-wish'), ['nct-wish', 'nct wish'])
})

test('pickEntityDetailRecoveryCandidate prefers exact slug match', () => {
  const candidate = pickEntityDetailRecoveryCandidate(
    [
      {
        entity_slug: 'aespa',
        display_name: 'aespa',
      },
      {
        entity_slug: 'hearts2hearts',
        display_name: 'Hearts2Hearts',
      },
    ],
    'hearts2hearts',
    'hearts2hearts',
  )

  assert.deepEqual(candidate, {
    entitySlug: 'hearts2hearts',
    displayName: 'Hearts2Hearts',
  })
})

test('pickEntityDetailRecoveryCandidate can recover by exact display match when slug differs', () => {
  const candidate = pickEntityDetailRecoveryCandidate(
    [
      {
        entity_slug: 'hearts2hearts',
        display_name: 'Hearts2Hearts',
        matched_alias: '하투하',
      },
    ],
    'hearts2hearts',
    'Hearts2Hearts',
  )

  assert.deepEqual(candidate, {
    entitySlug: 'hearts2hearts',
    displayName: 'Hearts2Hearts',
  })
})

test('pickEntityDetailRecoveryCandidate returns null for unrelated entities', () => {
  const candidate = pickEntityDetailRecoveryCandidate(
    [
      {
        entity_slug: 'blackpink',
        display_name: 'BLACKPINK',
      },
    ],
    'hearts2hearts',
    'hearts2hearts',
  )

  assert.equal(candidate, null)
})
