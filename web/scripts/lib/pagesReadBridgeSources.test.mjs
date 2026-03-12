import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { readPreferredBridgeJson, resolvePreferredBridgeSourcePath } from './pagesReadBridgeSources.mjs'

test('resolvePreferredBridgeSourcePath prefers non-runtime export snapshots', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-source-test-'))
  await fs.mkdir(path.join(rootDir, 'backend', 'exports', 'non_runtime_web_snapshots'), { recursive: true })
  await fs.mkdir(path.join(rootDir, 'web', 'src', 'data'), { recursive: true })

  const exportPath = path.join(rootDir, 'backend', 'exports', 'non_runtime_web_snapshots', 'releases.json')
  const dataPath = path.join(rootDir, 'web', 'src', 'data', 'releases.json')
  await fs.writeFile(exportPath, JSON.stringify([{ source: 'export' }]))
  await fs.writeFile(dataPath, JSON.stringify([{ source: 'data' }]))

  const selectedPath = await resolvePreferredBridgeSourcePath(rootDir, 'releases.json')
  assert.equal(selectedPath, exportPath)

  const payload = await readPreferredBridgeJson(rootDir, 'releases.json')
  assert.deepEqual(payload, [{ source: 'export' }])
})

test('resolvePreferredBridgeSourcePath falls back to web/src/data when export is absent', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-source-fallback-test-'))
  await fs.mkdir(path.join(rootDir, 'web', 'src', 'data'), { recursive: true })

  const dataPath = path.join(rootDir, 'web', 'src', 'data', 'upcomingCandidates.json')
  await fs.writeFile(dataPath, JSON.stringify([{ source: 'data' }]))

  const selectedPath = await resolvePreferredBridgeSourcePath(rootDir, 'upcomingCandidates.json')
  assert.equal(selectedPath, dataPath)

  const payload = await readPreferredBridgeJson(rootDir, 'upcomingCandidates.json')
  assert.deepEqual(payload, [{ source: 'data' }])
})
