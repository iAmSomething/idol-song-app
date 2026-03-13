import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldReloadForRuntimeRefresh } from './runtimeRefresh'

test('does not reload before a generation baseline exists', () => {
  assert.equal(
    shouldReloadForRuntimeRefresh({
      previousGeneration: null,
      nextGeneration: '2026-03-13T00:00:00.000Z',
      currentRuntimeMode: 'api',
      currentEffectiveTarget: 'https://api.idol-song-app.example.com',
      diagnosticsRuntimeMode: 'api',
      diagnosticsEffectiveTarget: 'https://api.idol-song-app.example.com',
    }),
    false,
  )
})

test('reloads when the deployed generation changes', () => {
  assert.equal(
    shouldReloadForRuntimeRefresh({
      previousGeneration: '2026-03-12T23:00:00.000Z',
      nextGeneration: '2026-03-13T00:00:00.000Z',
      currentRuntimeMode: 'bridge',
      currentEffectiveTarget: '/__bridge/v1',
      diagnosticsRuntimeMode: 'api',
      diagnosticsEffectiveTarget: 'https://api.idol-song-app.example.com',
    }),
    true,
  )
})

test('reloads when runtime mode drifts even if generation is unchanged', () => {
  assert.equal(
    shouldReloadForRuntimeRefresh({
      previousGeneration: '2026-03-13T00:00:00.000Z',
      nextGeneration: '2026-03-13T00:00:00.000Z',
      currentRuntimeMode: 'bridge',
      currentEffectiveTarget: '/__bridge/v1',
      diagnosticsRuntimeMode: 'api',
      diagnosticsEffectiveTarget: 'https://api.idol-song-app.example.com',
    }),
    true,
  )
})

test('reloads when effective target drifts even if runtime mode matches', () => {
  assert.equal(
    shouldReloadForRuntimeRefresh({
      previousGeneration: '2026-03-13T00:00:00.000Z',
      nextGeneration: '2026-03-13T00:00:00.000Z',
      currentRuntimeMode: 'api',
      currentEffectiveTarget: 'https://old-api.idol-song-app.example.com/',
      diagnosticsRuntimeMode: 'api',
      diagnosticsEffectiveTarget: 'https://api.idol-song-app.example.com',
    }),
    true,
  )
})

test('does not reload when generation and runtime target are stable', () => {
  assert.equal(
    shouldReloadForRuntimeRefresh({
      previousGeneration: '2026-03-13T00:00:00.000Z',
      nextGeneration: '2026-03-13T00:00:00.000Z',
      currentRuntimeMode: 'api',
      currentEffectiveTarget: 'https://api.idol-song-app.example.com/',
      diagnosticsRuntimeMode: 'api',
      diagnosticsEffectiveTarget: 'https://api.idol-song-app.example.com',
    }),
    false,
  )
})
