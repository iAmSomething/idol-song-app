import fs from 'node:fs/promises';
import path from 'node:path';

export const NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR = 'backend/exports/non_runtime_web_snapshots';

export const NON_RUNTIME_WEB_SNAPSHOT_FILES = [
  'artistProfiles.json',
  'releaseArtwork.json',
  'releaseChangeLog.json',
  'releaseDetails.json',
  'releaseHistory.json',
  'releases.json',
  'upcomingCandidates.json',
  'watchlist.json',
  'youtubeChannelAllowlists.json',
];

export function buildNonRuntimeWebSnapshotEntries(rootDir) {
  return NON_RUNTIME_WEB_SNAPSHOT_FILES.map((fileName) => ({
    fileName,
    sourcePath: path.join(rootDir, 'web', 'src', 'data', fileName),
    exportPath: path.join(rootDir, NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR, fileName),
  }));
}

export async function exportNonRuntimeWebSnapshots({
  rootDir,
  cadenceProfile,
  sourceWorkflow,
  generatedAt = new Date().toISOString(),
}) {
  const entries = buildNonRuntimeWebSnapshotEntries(rootDir);
  const exportDir = path.join(rootDir, NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR);
  await fs.mkdir(exportDir, { recursive: true });

  const exported = [];
  for (const entry of entries) {
    try {
      await fs.access(entry.sourcePath);
    } catch {
      continue;
    }

    await fs.copyFile(entry.sourcePath, entry.exportPath);
    exported.push({
      file_name: entry.fileName,
      source_path: path.relative(rootDir, entry.sourcePath),
      export_path: path.relative(rootDir, entry.exportPath),
    });
  }

  const manifest = {
    generated_at: generatedAt,
    classification: 'non-runtime export',
    source_workflow: sourceWorkflow,
    cadence_profile: cadenceProfile,
    export_dir: NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR,
    file_count: exported.length,
    files: exported,
  };

  const manifestPath = path.join(exportDir, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}
