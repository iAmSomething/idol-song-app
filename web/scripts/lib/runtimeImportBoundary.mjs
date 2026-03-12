import fs from 'node:fs';
import path from 'node:path';

const WEB_SRC_ROOT = 'web/src';

export const ALLOWED_RUNTIME_SNAPSHOT_IMPORTS = new Map([
  [
    'web/src/App.tsx',
    new Set([
      './data/artistProfiles.json',
      './data/releaseArtwork.json',
      './data/releaseDetails.json',
      './data/releaseHistory.json',
      './data/releases.json',
      './data/teamBadgeAssets.json',
      './data/unresolved.json',
      './data/upcomingCandidates.json',
      './data/releaseChangeLog.json',
      './data/relatedActsOverrides.json',
      './data/watchlist.json',
      './data/youtubeChannelAllowlists.json',
    ]),
  ],
]);

const STATIC_IMPORT_PATTERN =
  /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+\/data\/[^"']+\.json)["'];?/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*["']([^"']+\/data\/[^"']+\.json)["']\s*\)/g;

function normalizeRelativePath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join('/');
}

function shouldInspectFile(relativePath) {
  return (
    relativePath.startsWith(`${WEB_SRC_ROOT}/`) &&
    (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx'))
  );
}

function collectMatches(sourceText, pattern) {
  const matches = [];
  for (const match of sourceText.matchAll(pattern)) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return matches;
}

function findImportsInFile(sourceText) {
  return [
    ...collectMatches(sourceText, STATIC_IMPORT_PATTERN),
    ...collectMatches(sourceText, DYNAMIC_IMPORT_PATTERN),
  ];
}

function walkFiles(rootDir, directory, results) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(rootDir, absolutePath, results);
      continue;
    }

    const relativePath = normalizeRelativePath(rootDir, absolutePath);
    if (shouldInspectFile(relativePath)) {
      results.push(relativePath);
    }
  }
}

export function findRuntimeSnapshotImportViolations(rootDir) {
  const files = [];
  walkFiles(rootDir, path.join(rootDir, WEB_SRC_ROOT), files);

  const violations = [];

  for (const relativePath of files) {
    const sourceText = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
    const imports = findImportsInFile(sourceText);
    if (imports.length === 0) {
      continue;
    }

    const allowedImports = ALLOWED_RUNTIME_SNAPSHOT_IMPORTS.get(relativePath);
    if (!allowedImports) {
      violations.push({
        file: relativePath,
        imports,
        reason:
          'Shipped web runtime files must not import committed runtime snapshots outside the documented App.tsx transition boundary.',
      });
      continue;
    }

    const disallowedImports = imports.filter((specifier) => !allowedImports.has(specifier));
    if (disallowedImports.length > 0) {
      violations.push({
        file: relativePath,
        imports: disallowedImports,
        reason:
          'App.tsx may only import the currently documented transitional snapshot set until the final API-only cutover removes this boundary.',
      });
    }
  }

  return violations;
}
