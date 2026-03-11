import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

import {
  buildRuntimeArtifactRetentionReport,
  collectRuntimeArtifactDuplicates,
  renderRuntimeArtifactRetentionMarkdown,
} from './runtimeArtifactRetention.mjs';

test('buildRuntimeArtifactRetentionReport groups duplicate runtime-facing artifacts', () => {
  const report = buildRuntimeArtifactRetentionReport({
    duplicates: [
      {
        duplicate_path: 'build_release_details_musicbrainz 2.py',
        canonical_path: 'build_release_details_musicbrainz.py',
        group_key: 'repo_root_pipeline_scripts',
        group_label: 'Repo root pipeline scripts',
        copy_index: 2,
        retention_decision: 'delete_duplicate',
        archival_rule: 'Delete suffix copies from repo root; use docs/assets/distribution or /tmp for comparison outputs.',
      },
      {
        duplicate_path: 'web/src/data/releaseDetails 2.json',
        canonical_path: 'web/src/data/releaseDetails.json',
        group_key: 'web_runtime_data_exports',
        group_label: 'Web runtime data exports',
        copy_index: 2,
        retention_decision: 'delete_duplicate',
        archival_rule: 'Suffix copies are forbidden in web/src/data because import/build paths must stay canonical.',
      },
    ],
  });

  assert.equal(report.duplicate_inventory.length, 2);
  assert.equal(report.canonical_groups.find((group) => group.key === 'repo_root_pipeline_scripts')?.duplicate_count, 1);
  assert.equal(report.canonical_groups.find((group) => group.key === 'web_runtime_data_exports')?.duplicate_count, 1);
  assert.match(report.summary_lines[2], /duplicate files detected: 2/);
});

test('renderRuntimeArtifactRetentionMarkdown renders duplicate inventory and canonical groups', () => {
  const markdown = renderRuntimeArtifactRetentionMarkdown(
    buildRuntimeArtifactRetentionReport({
      duplicates: [
        {
          duplicate_path: 'web/src/data/releaseArtwork 2.json',
          canonical_path: 'web/src/data/releaseArtwork.json',
          group_key: 'web_runtime_data_exports',
          group_label: 'Web runtime data exports',
          copy_index: 2,
          retention_decision: 'delete_duplicate',
          archival_rule: 'Suffix copies are forbidden in web/src/data because import/build paths must stay canonical.',
        },
      ],
    }),
  );

  assert.match(markdown, /# Runtime Artifact Retention Report/);
  assert.match(markdown, /\| web\/src\/data\/releaseArtwork 2\.json \| web\/src\/data\/releaseArtwork\.json \| Web runtime data exports \| delete_duplicate \|/);
  assert.match(markdown, /## Canonical Groups/);
});

test('collectRuntimeArtifactDuplicates scans each canonical group once and covers expanded runtime paths', async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'idol-runtime-artifacts-'));
  try {
    await mkdir(path.join(repoDir, 'web', 'src', 'data'), { recursive: true });

    const filesToCreate = [
      'build_manual_review_queue.py',
      'build_manual_review_queue 2.py',
      'hydrate_release_windows.py',
      'hydrate_release_windows 2.py',
      'manual_review_queue.json',
      'manual_review_queue 2.json',
      'upcoming_release_candidates.csv',
      'upcoming_release_candidates 2.csv',
      'web/src/data/unresolved.json',
      'web/src/data/unresolved 2.json',
      'web/src/data/watchlist.json',
      'web/src/data/watchlist 2.json',
    ];

    await Promise.all(
      filesToCreate.map((relativePath) =>
        writeFile(path.join(repoDir, relativePath), '{}\n', 'utf8'),
      ),
    );

    const duplicates = await collectRuntimeArtifactDuplicates(repoDir);
    assert.deepEqual(
      duplicates.map((entry) => entry.duplicate_path),
      [
        'build_manual_review_queue 2.py',
        'hydrate_release_windows 2.py',
        'manual_review_queue 2.json',
        'upcoming_release_candidates 2.csv',
        'web/src/data/unresolved 2.json',
        'web/src/data/watchlist 2.json',
      ],
    );
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});
