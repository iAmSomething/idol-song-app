import { readdir } from 'node:fs/promises';
import path from 'node:path';

export const RUNTIME_ARTIFACT_RETENTION_GROUPS = [
  {
    key: 'repo_root_pipeline_scripts',
    label: 'Repo root pipeline scripts',
    directory: '.',
    canonical_paths: [
      'build_release_details_musicbrainz.py',
      'build_manual_review_queue.py',
      'build_release_change_log.py',
      'build_release_history_musicbrainz.py',
      'build_release_rollup_from_history.py',
      'build_tracking_watchlist.py',
      'scan_upcoming_candidates.py',
      'hydrate_release_windows.py',
      'build_canonical_entity_metadata.py',
      'build_release_artwork_catalog.py',
    ],
    archival_rule: 'Delete suffix copies from repo root; use docs/assets/distribution or /tmp for comparison outputs.',
  },
  {
    key: 'repo_root_runtime_data',
    label: 'Repo root runtime-facing generated data',
    directory: '.',
    canonical_paths: [
      'artist_profiles_seed.json',
      'team_badge_assets.json',
      'youtube_channel_allowlists.json',
      'release_detail_catalog.json',
      'release_artwork_catalog.json',
      'tracking_watchlist.json',
      'upcoming_release_candidates.json',
      'upcoming_release_candidates.csv',
      'manual_review_queue.json',
      'manual_review_queue.csv',
      'canonical_entity_metadata.json',
      'verified_release_history_mb.json',
      'verified_release_history_mb.csv',
      'group_latest_release_since_2025-06-01_mb.json',
      'group_latest_release_since_2025-06-01_mb.csv',
    ],
    archival_rule: 'Keep one canonical file per artifact; archive dated evidence in docs/assets/distribution.',
  },
  {
    key: 'web_runtime_data_exports',
    label: 'Web runtime data exports',
    directory: path.join('web', 'src', 'data'),
    canonical_paths: [
      'web/src/data/artistProfiles.json',
      'web/src/data/releaseArtwork.json',
      'web/src/data/releaseDetails.json',
      'web/src/data/releaseHistory.json',
      'web/src/data/releases.json',
      'web/src/data/unresolved.json',
      'web/src/data/upcomingCandidates.json',
      'web/src/data/watchlist.json',
      'web/src/data/youtubeChannelAllowlists.json',
    ],
    archival_rule: 'Suffix copies are forbidden in web/src/data because import/build paths must stay canonical.',
  },
];

function buildGroupCanonicalIndex(repoDir, group) {
  const index = new Map();
  for (const relativePath of group.canonical_paths) {
    const absolutePath = path.join(repoDir, relativePath);
    index.set(absolutePath, {
      group_key: group.key,
      group_label: group.label,
      canonical_path: relativePath,
      archival_rule: group.archival_rule,
    });
  }
  return index;
}

export function parseSuffixDuplicateName(entryName) {
  const parsed = path.parse(entryName);
  const match = /^(?<canonicalName>.+) (?<copyIndex>[2-9]\d*)$/.exec(parsed.name);
  if (!match?.groups) {
    return null;
  }
  return {
    canonicalName: match.groups.canonicalName,
    copyIndex: Number(match.groups.copyIndex),
    ext: parsed.ext,
  };
}

export function resolveRuntimeArtifactDuplicate(repoDir, duplicateRelativePath) {
  const duplicateAbsolutePath = path.join(repoDir, duplicateRelativePath);
  const duplicateDirectoryPath = path.dirname(duplicateAbsolutePath);
  const parsed = parseSuffixDuplicateName(path.basename(duplicateRelativePath));
  if (!parsed) {
    return null;
  }

  for (const group of RUNTIME_ARTIFACT_RETENTION_GROUPS) {
    const directoryPath = path.join(repoDir, group.directory);
    if (directoryPath !== duplicateDirectoryPath) {
      continue;
    }
    const canonicalIndex = buildGroupCanonicalIndex(repoDir, group);
    const canonicalAbsolutePath = path.join(directoryPath, `${parsed.canonicalName}${parsed.ext}`);
    const canonicalMeta = canonicalIndex.get(canonicalAbsolutePath);
    if (!canonicalMeta) {
      continue;
    }
    return {
      duplicate_path: duplicateRelativePath,
      canonical_path: canonicalMeta.canonical_path,
      group_key: canonicalMeta.group_key,
      group_label: canonicalMeta.group_label,
      copy_index: parsed.copyIndex,
      retention_decision: 'delete_duplicate',
      archival_rule: canonicalMeta.archival_rule,
    };
  }

  return null;
}

export async function collectRuntimeArtifactDuplicates(repoDir) {
  const duplicates = [];

  for (const group of RUNTIME_ARTIFACT_RETENTION_GROUPS) {
    const directoryPath = path.join(repoDir, group.directory);
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const duplicatePath = path.relative(repoDir, path.join(directoryPath, entry.name));
      const resolved = resolveRuntimeArtifactDuplicate(repoDir, duplicatePath);
      if (!resolved || resolved.group_key !== group.key) {
        continue;
      }
      duplicates.push(resolved);
    }
  }

  return duplicates
    .filter(
      (entry, index, array) =>
        array.findIndex(
          (candidate) =>
            candidate.duplicate_path === entry.duplicate_path && candidate.canonical_path === entry.canonical_path,
        ) === index,
    )
    .sort((left, right) => left.duplicate_path.localeCompare(right.duplicate_path));
}

export function buildRuntimeArtifactRetentionReport({ duplicates }) {
  const summaryByGroup = RUNTIME_ARTIFACT_RETENTION_GROUPS.map((group) => {
    const groupDuplicates = duplicates.filter((entry) => entry.group_key === group.key);
    return {
      key: group.key,
      label: group.label,
      canonical_count: group.canonical_paths.length,
      duplicate_count: groupDuplicates.length,
      canonical_paths: group.canonical_paths,
      duplicates: groupDuplicates,
      archival_rule: group.archival_rule,
    };
  });

  const summaryLines = [
    `runtime-facing canonical groups: ${RUNTIME_ARTIFACT_RETENTION_GROUPS.length}`,
    `runtime-facing canonical files: ${summaryByGroup.reduce((total, group) => total + group.canonical_count, 0)}`,
    `duplicate files detected: ${duplicates.length}`,
    duplicates.length === 0
      ? 'retention status: canonical only'
      : 'retention status: cleanup required before accepting runtime-facing artifact hygiene',
  ];

  return {
    generated_at: new Date().toISOString(),
    retention_policy_version: 'v1',
    scope: {
      directories: ['.', 'web/src/data'],
      duplicate_suffix_pattern: '* 2.* / * 3.* / * 4.*',
      runtime_facing_only: true,
    },
    summary_lines: summaryLines,
    canonical_groups: summaryByGroup,
    duplicate_inventory: duplicates,
    retention_rules: [
      'Canonical runtime-facing files live only at documented repo-root paths and web/src/data exports.',
      'Suffix copies are not allowed in runtime-facing directories, even if they are untracked.',
      'Human review bundles and dated evidence belong in docs/assets/distribution, backend/reports, or /tmp, not beside canonical files.',
      'Import/build/runtime checks must reference canonical paths only.',
    ],
  };
}

export function renderRuntimeArtifactRetentionMarkdown(report) {
  const lines = [
    '# Runtime Artifact Retention Report',
    '',
    `- generated_at: ${report.generated_at}`,
    `- retention_policy_version: ${report.retention_policy_version}`,
    '',
    '## Summary',
    '',
    ...report.summary_lines.map((line) => `- ${line}`),
    '',
    '## Duplicate Inventory',
    '',
  ];

  if (report.duplicate_inventory.length === 0) {
    lines.push('- No runtime-facing suffix duplicates detected.');
    lines.push('');
  } else {
    lines.push('| Duplicate | Canonical | Group | Decision |');
    lines.push('| --- | --- | --- | --- |');
    for (const entry of report.duplicate_inventory) {
      lines.push(
        `| ${entry.duplicate_path} | ${entry.canonical_path} | ${entry.group_label} | ${entry.retention_decision} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Canonical Groups');
  lines.push('');
  for (const group of report.canonical_groups) {
    lines.push(`### ${group.label}`);
    lines.push('');
    lines.push(`- canonical_count: ${group.canonical_count}`);
    lines.push(`- duplicate_count: ${group.duplicate_count}`);
    lines.push(`- archival_rule: ${group.archival_rule}`);
    for (const canonicalPath of group.canonical_paths) {
      lines.push(`- canonical: ${canonicalPath}`);
    }
    lines.push('');
  }

  lines.push('## Retention Rules');
  lines.push('');
  for (const rule of report.retention_rules) {
    lines.push(`- ${rule}`);
  }

  return `${lines.join('\n')}\n`;
}
