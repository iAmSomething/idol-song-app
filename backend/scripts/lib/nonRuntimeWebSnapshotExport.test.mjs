import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR,
  buildNonRuntimeWebSnapshotEntries,
  exportNonRuntimeWebSnapshots,
} from './nonRuntimeWebSnapshotExport.mjs';

test('buildNonRuntimeWebSnapshotEntries maps primary non-runtime datasets into export paths', () => {
  const entries = buildNonRuntimeWebSnapshotEntries('/tmp/idol-song-app');
  assert.ok(entries.some((entry) => entry.sourcePath.endsWith('release_detail_catalog.json')));
  assert.ok(entries.every((entry) => entry.exportPath.includes(NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR)));
});

test('exportNonRuntimeWebSnapshots copies existing files and writes manifest', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'idol-song-app-web-snapshot-export-'));
  await fs.mkdir(rootDir, { recursive: true });
  await fs.writeFile(
    path.join(rootDir, 'tracking_watchlist.json'),
    '[{"group":"YENA"}]\n',
  );
  await fs.writeFile(
    path.join(rootDir, 'release_detail_catalog.json'),
    '[{"group":"YENA","release_title":"LOVE CATCHER"}]\n',
  );

  const { manifest, manifestPath } = await exportNonRuntimeWebSnapshots({
    rootDir,
    cadenceProfile: 'daily-upcoming',
    sourceWorkflow: 'weekly-kpop-scan.yml',
    generatedAt: '2026-03-12T03:00:00.000Z',
  });

  assert.equal(manifest.classification, 'non-runtime export');
  assert.equal(manifest.file_count, 2);
  assert.equal(manifest.files[0].export_path.startsWith(NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR), true);

  const copiedWatchlist = await fs.readFile(
    path.join(rootDir, NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR, 'watchlist.json'),
    'utf8',
  );
  assert.match(copiedWatchlist, /YENA/);

  const storedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert.equal(storedManifest.source_workflow, 'weekly-kpop-scan.yml');
  assert.equal(storedManifest.cadence_profile, 'daily-upcoming');
});
