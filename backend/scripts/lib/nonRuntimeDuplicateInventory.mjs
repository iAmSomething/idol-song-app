import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { parseSuffixDuplicateName, resolveRuntimeArtifactDuplicate } from './runtimeArtifactRetention.mjs';

const IGNORED_DIRECTORY_NAMES = new Set([
  '.git',
  '.venv',
  '__pycache__',
  'node_modules',
  'dist',
  '.expo',
  '.next',
  'Pods',
  'build',
]);

const NON_RUNTIME_DUPLICATE_GROUPS = [
  {
    key: 'workflow_drafts',
    label: 'Workflow drafts',
    match: (relativePath) => relativePath.startsWith('.github/workflows/'),
    quarantine_rule: 'Move draft workflow copies to /tmp or a gitignored scratch path before the next PR.',
  },
  {
    key: 'backend_workspace_scratch',
    label: 'Backend workspace scratch',
    match: (relativePath) => relativePath.startsWith('backend/'),
    quarantine_rule: 'Keep only the canonical backend source file in-repo; move experiments to /tmp or gitignored local scratch.',
  },
  {
    key: 'docs_distribution_evidence',
    label: 'Docs distribution evidence',
    match: (relativePath) => relativePath.startsWith('docs/assets/distribution/'),
    quarantine_rule: 'Keep one dated evidence file only; remove suffixed copies after choosing the canonical evidence artifact.',
  },
  {
    key: 'docs_specs_variants',
    label: 'Docs/spec variants',
    match: (relativePath) => relativePath.startsWith('docs/specs/'),
    quarantine_rule: 'Promote one spec file to canonical or move the variant out of docs/specs before review.',
  },
  {
    key: 'mobile_asset_drafts',
    label: 'Mobile asset drafts',
    match: (relativePath) => relativePath.startsWith('mobile/assets/'),
    quarantine_rule: 'Keep active asset exploration outside the tracked asset tree or replace the canonical asset in a single step.',
  },
  {
    key: 'mobile_workspace_scratch',
    label: 'Mobile workspace scratch',
    match: (relativePath) => relativePath.startsWith('mobile/'),
    quarantine_rule: 'Move temporary mobile copies to a gitignored scratch location; leave only the canonical workspace file in-repo.',
  },
  {
    key: 'web_workspace_scratch',
    label: 'Web workspace scratch',
    match: (relativePath) => relativePath.startsWith('web/'),
    quarantine_rule: 'Move temporary web copies to a gitignored scratch location; do not keep suffixed copies under web/.',
  },
  {
    key: 'repo_root_misc',
    label: 'Repo root misc scratch',
    match: () => true,
    quarantine_rule: 'Move root-level scratch copies out of the repo root once the canonical file is identified.',
  },
];

async function* walkDirectory(repoDir, relativeDirectory = '.') {
  const directoryPath = path.join(repoDir, relativeDirectory);
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') {
      continue;
    }
    const relativePath = relativeDirectory === '.' ? entry.name : path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      yield* walkDirectory(repoDir, relativePath);
      continue;
    }
    if (entry.isFile()) {
      yield relativePath;
    }
  }
}

function classifyNonRuntimeDuplicate(relativePath) {
  return NON_RUNTIME_DUPLICATE_GROUPS.find((group) => group.match(relativePath)) ?? NON_RUNTIME_DUPLICATE_GROUPS.at(-1);
}

export async function collectNonRuntimeDuplicateArtifacts(repoDir) {
  const duplicates = [];

  for await (const relativePath of walkDirectory(repoDir)) {
    const parsed = parseSuffixDuplicateName(path.basename(relativePath));
    if (!parsed) {
      continue;
    }

    if (resolveRuntimeArtifactDuplicate(repoDir, relativePath)) {
      continue;
    }

    const canonicalRelativePath = path.join(path.dirname(relativePath), `${parsed.canonicalName}${parsed.ext}`);
    const normalizedCanonicalPath = canonicalRelativePath.startsWith('./')
      ? canonicalRelativePath.slice(2)
      : canonicalRelativePath;

    if (!existsSync(path.join(repoDir, normalizedCanonicalPath))) {
      continue;
    }

    const group = classifyNonRuntimeDuplicate(relativePath);
    duplicates.push({
      duplicate_path: relativePath,
      canonical_path: normalizedCanonicalPath,
      copy_index: parsed.copyIndex,
      group_key: group.key,
      group_label: group.label,
      quarantine_decision: 'quarantine_outside_runtime_scope',
      quarantine_rule: group.quarantine_rule,
    });
  }

  return duplicates.sort((left, right) => left.duplicate_path.localeCompare(right.duplicate_path));
}

export function buildNonRuntimeDuplicateInventoryReport({ duplicates }) {
  const groups = NON_RUNTIME_DUPLICATE_GROUPS.map((group) => {
    const groupDuplicates = duplicates.filter((entry) => entry.group_key === group.key);
    return {
      key: group.key,
      label: group.label,
      duplicate_count: groupDuplicates.length,
      quarantine_rule: group.quarantine_rule,
      duplicates: groupDuplicates,
    };
  });

  const totalCount = duplicates.length;
  return {
    generated_at: new Date().toISOString(),
    quarantine_policy_version: 'v1',
    scope: {
      runtime_facing_duplicates_excluded: true,
      duplicate_suffix_pattern: '* 2.* / * 3.* / * 4.*',
      ignored_directory_names: Array.from(IGNORED_DIRECTORY_NAMES).sort(),
    },
    summary_lines: [
      `non-runtime duplicate files detected: ${totalCount}`,
      totalCount === 0
        ? 'quarantine status: no non-runtime duplicate scratch files detected'
        : 'quarantine status: move scratch duplicates out of tracked workspace before treating the worktree as operator-clean',
      `groups with duplicates: ${groups.filter((group) => group.duplicate_count > 0).length}`,
    ],
    groups,
    duplicate_inventory: duplicates,
  };
}

export function renderNonRuntimeDuplicateInventoryMarkdown(report) {
  const lines = [
    '# Non-runtime Duplicate Inventory Report',
    '',
    `- generated_at: ${report.generated_at}`,
    `- quarantine_policy_version: ${report.quarantine_policy_version}`,
    '',
    '## Summary',
    '',
    ...report.summary_lines.map((line) => `- ${line}`),
    '',
    '## Duplicate Inventory',
    '',
  ];

  if (report.duplicate_inventory.length === 0) {
    lines.push('- No non-runtime duplicate scratch files detected.');
    lines.push('');
  } else {
    lines.push('| Duplicate | Canonical | Group | Decision |');
    lines.push('| --- | --- | --- | --- |');
    for (const entry of report.duplicate_inventory) {
      lines.push(
        `| ${entry.duplicate_path} | ${entry.canonical_path} | ${entry.group_label} | ${entry.quarantine_decision} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Groups');
  lines.push('');
  for (const group of report.groups) {
    lines.push(`### ${group.label}`);
    lines.push('');
    lines.push(`- duplicate_count: ${group.duplicate_count}`);
    lines.push(`- quarantine_rule: ${group.quarantine_rule}`);
    for (const entry of group.duplicates) {
      lines.push(`- duplicate: ${entry.duplicate_path} -> ${entry.canonical_path}`);
    }
    lines.push('');
  }

  if (lines.at(-1) === '') {
    lines.pop();
  }

  return `${lines.join('\n')}\n`;
}
