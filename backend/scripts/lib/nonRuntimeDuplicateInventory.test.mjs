import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';

import {
  buildNonRuntimeDuplicateInventoryReport,
  collectNonRuntimeDuplicateArtifacts,
  renderNonRuntimeDuplicateInventoryMarkdown,
} from './nonRuntimeDuplicateInventory.mjs';

test('collectNonRuntimeDuplicateArtifacts excludes runtime-facing duplicates and groups remaining scratch files', async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'idol-non-runtime-duplicates-'));
  try {
    await mkdir(path.join(repoDir, 'web', 'src', 'data'), { recursive: true });
    await mkdir(path.join(repoDir, 'mobile', 'assets', 'app-icon'), { recursive: true });
    await mkdir(path.join(repoDir, 'docs', 'specs', 'mobile'), { recursive: true });
    await mkdir(path.join(repoDir, '.github', 'workflows'), { recursive: true });
    await mkdir(path.join(repoDir, 'node_modules', 'example'), { recursive: true });

    const files = [
      'web/src/data/watchlist.json',
      'web/src/data/watchlist 2.json',
      'mobile/assets/app-icon/icon-primary-source.svg',
      'mobile/assets/app-icon/icon-primary-source 2.svg',
      'docs/specs/mobile/app-icon-system.md',
      'docs/specs/mobile/app-icon-system 2.md',
      '.github/workflows/mobile-quality.yml',
      '.github/workflows/mobile-quality 2.yml',
      'artist_socials_structured_2026-03-04.json',
      'artist_socials_structured_2026-03-04 2.json',
      'node_modules/example/ignored 2.js',
      'node_modules/example/ignored.js',
    ];

    await Promise.all(files.map((relativePath) => writeFile(path.join(repoDir, relativePath), 'fixture\n', 'utf8')));

    const duplicates = await collectNonRuntimeDuplicateArtifacts(repoDir);
    assert.deepEqual(
      duplicates.map((entry) => entry.duplicate_path),
      [
        '.github/workflows/mobile-quality 2.yml',
        'artist_socials_structured_2026-03-04 2.json',
        'docs/specs/mobile/app-icon-system 2.md',
        'mobile/assets/app-icon/icon-primary-source 2.svg',
      ],
    );
    assert.equal(duplicates.some((entry) => entry.duplicate_path === 'web/src/data/watchlist 2.json'), false);
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('buildNonRuntimeDuplicateInventoryReport renders group summary and markdown', () => {
  const report = buildNonRuntimeDuplicateInventoryReport({
    duplicates: [
      {
        duplicate_path: '.github/workflows/mobile-quality 2.yml',
        canonical_path: '.github/workflows/mobile-quality.yml',
        copy_index: 2,
        group_key: 'workflow_drafts',
        group_label: 'Workflow drafts',
        quarantine_decision: 'quarantine_outside_runtime_scope',
        quarantine_rule: 'Move draft workflow copies to /tmp or a gitignored scratch path before the next PR.',
      },
      {
        duplicate_path: 'mobile/assets/app-icon/icon-primary-source 2.svg',
        canonical_path: 'mobile/assets/app-icon/icon-primary-source.svg',
        copy_index: 2,
        group_key: 'mobile_asset_drafts',
        group_label: 'Mobile asset drafts',
        quarantine_decision: 'quarantine_outside_runtime_scope',
        quarantine_rule: 'Keep active asset exploration outside the tracked asset tree or replace the canonical asset in a single step.',
      },
    ],
  });

  assert.equal(report.duplicate_inventory.length, 2);
  assert.match(report.summary_lines[0], /non-runtime duplicate files detected: 2/);

  const markdown = renderNonRuntimeDuplicateInventoryMarkdown(report);
  assert.match(markdown, /# Non-runtime Duplicate Inventory Report/);
  assert.match(markdown, /\| \.github\/workflows\/mobile-quality 2\.yml \| \.github\/workflows\/mobile-quality\.yml \| Workflow drafts \| quarantine_outside_runtime_scope \|/);
  assert.match(markdown, /### Mobile asset drafts/);
});
