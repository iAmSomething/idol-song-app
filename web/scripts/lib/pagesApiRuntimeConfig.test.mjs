import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyBackendTarget, resolvePagesApiRuntimeConfig } from './pagesApiRuntimeConfig.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

test('classifyBackendTarget recognizes production hosts', () => {
  assert.equal(classifyBackendTarget('https://api.idol-song-app.example.com'), 'production')
})

test('classifyBackendTarget recognizes preview hosts', () => {
  assert.equal(classifyBackendTarget('https://preview-api.idol-song-app.example.com'), 'preview')
})

test('resolvePagesApiRuntimeConfig uses explicit env override when present', async () => {
  const config = await resolvePagesApiRuntimeConfig({
    repoRoot,
    configuredApiBaseUrl: 'https://api.idol-song-app.example.com/',
    configuredTargetEnvironment: 'production',
  })

  assert.equal(config.apiBaseUrl, 'https://api.idol-song-app.example.com')
  assert.equal(config.targetEnvironment, 'production')
  assert.equal(config.source, 'env')
})

test('resolvePagesApiRuntimeConfig falls back to backend freshness handoff target', async () => {
  const config = await resolvePagesApiRuntimeConfig({
    repoRoot,
    configuredApiBaseUrl: '',
    configuredTargetEnvironment: '',
  })

  assert.equal(config.apiBaseUrl, 'https://api.idol-song-app.example.com')
  assert.equal(config.targetEnvironment, 'production')
  assert.equal(config.source, 'backend_freshness_handoff')
})
