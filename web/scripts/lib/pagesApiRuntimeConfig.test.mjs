import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyBackendTarget, probePagesApiTarget, resolvePagesApiRuntimeConfig } from './pagesApiRuntimeConfig.mjs'

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
    probeApiTarget: async () => ({
      healthy: true,
      probeUrl: 'https://api.idol-song-app.example.com/health',
      probePath: '/health',
      status: 200,
      error: null,
    }),
  })

  assert.equal(config.apiBaseUrl, 'https://api.idol-song-app.example.com')
  assert.equal(config.targetEnvironment, 'production')
  assert.equal(config.runtimeMode, 'api')
  assert.equal(config.decisionReason, 'api_target_healthy')
  assert.equal(config.source, 'env')
})

test('resolvePagesApiRuntimeConfig falls back to backend freshness handoff target', async () => {
  const config = await resolvePagesApiRuntimeConfig({
    repoRoot,
    configuredApiBaseUrl: '',
    configuredTargetEnvironment: '',
    probeApiTarget: async () => ({
      healthy: true,
      probeUrl: 'https://api.idol-song-app.example.com/health',
      probePath: '/health',
      status: 200,
      error: null,
    }),
  })

  assert.equal(config.apiBaseUrl, 'https://api.idol-song-app.example.com')
  assert.equal(config.targetEnvironment, 'production')
  assert.equal(config.runtimeMode, 'api')
  assert.equal(config.source, 'backend_freshness_handoff')
})

test('resolvePagesApiRuntimeConfig fails when API target is unhealthy', async () => {
  await assert.rejects(
    () =>
      resolvePagesApiRuntimeConfig({
        repoRoot,
        configuredApiBaseUrl: 'https://api.idol-song-app.example.com/',
        configuredTargetEnvironment: 'production',
        probeApiTarget: async () => ({
          healthy: false,
          probeUrl: 'https://api.idol-song-app.example.com/health',
          probePath: '/health',
          status: 502,
          error: 'unexpected_status_502',
        }),
      }),
    /Resolved Pages API target is unhealthy/,
  )
})

test('probePagesApiTarget reports unexpected status as unhealthy', async () => {
  const result = await probePagesApiTarget('https://api.idol-song-app.example.com', {
    fetchImpl: async () => new Response('bad gateway', { status: 502 }),
  })

  assert.equal(result.healthy, false)
  assert.equal(result.status, 502)
  assert.equal(result.error, 'unexpected_status_502')
})
