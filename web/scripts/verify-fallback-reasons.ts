import assert from 'node:assert/strict'

import { buildSurfaceStatusMeta, getSurfaceFallbackReasonKey } from '../src/lib/surfaceStatus'

const labels = {
  sourceLabel: 'Source',
  reasonLabel: 'Reason',
  sourceStateLabels: {
    api: 'backend API',
    api_error: 'backend API unavailable',
  },
  fallbackReasonLabels: {
    timeout: 'timeout',
    network_error: 'network failure',
    not_found: 'not found',
    stale_projection: 'stale projection',
    disallowed_origin: 'disallowed origin',
    invalid_request: 'invalid request',
    unknown: 'other backend error',
  },
} as const

assert.equal(getSurfaceFallbackReasonKey('timeout'), 'timeout')
assert.equal(getSurfaceFallbackReasonKey('network_error'), 'network_error')
assert.equal(getSurfaceFallbackReasonKey('not_found'), 'not_found')
assert.equal(getSurfaceFallbackReasonKey('entity_404'), 'not_found')
assert.equal(getSurfaceFallbackReasonKey('lookup_404'), 'not_found')
assert.equal(getSurfaceFallbackReasonKey('stale_projection'), 'stale_projection')
assert.equal(getSurfaceFallbackReasonKey('disallowed_origin'), 'disallowed_origin')
assert.equal(getSurfaceFallbackReasonKey('detail_400'), 'invalid_request')
assert.equal(getSurfaceFallbackReasonKey('search_500'), 'unknown')

assert.equal(
  buildSurfaceStatusMeta({
    source: 'api',
    errorCode: null,
    labels,
  }),
  'Source: backend API',
)

assert.equal(
  buildSurfaceStatusMeta({
    source: 'api_error',
    errorCode: 'timeout',
    labels,
  }),
  'Source: backend API unavailable · Reason: timeout',
)

console.log('fallback reason verification passed')
