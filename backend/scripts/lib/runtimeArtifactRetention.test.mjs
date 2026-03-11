import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRuntimeArtifactRetentionReport,
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
