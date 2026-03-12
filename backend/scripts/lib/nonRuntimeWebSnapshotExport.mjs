import fs from 'node:fs/promises';
import path from 'node:path';

export const NON_RUNTIME_WEB_SNAPSHOT_EXPORT_DIR = 'backend/exports/non_runtime_web_snapshots';

export const NON_RUNTIME_WEB_SNAPSHOT_SOURCES = {
  'artistProfiles.json': 'artist_profiles_seed.json',
  'releaseArtwork.json': 'release_artwork_catalog.json',
  'releaseChangeLog.json': 'web/src/data/releaseChangeLog.json',
  'releaseDetails.json': 'release_detail_catalog.json',
  'releaseHistory.json': 'verified_release_history_mb.json',
  'releases.json': 'group_latest_release_since_2025-06-01_mb.json',
  'teamBadgeAssets.json': 'team_badge_assets.json',
  'upcomingCandidates.json': 'upcoming_release_candidates.json',
  'watchlist.json': 'tracking_watchlist.json',
  'youtubeChannelAllowlists.json': 'youtube_channel_allowlists.json',
};

export function buildNonRuntimeWebSnapshotEntries(rootDir) {
  return Object.entries(NON_RUNTIME_WEB_SNAPSHOT_SOURCES).map(([fileName, sourceRelativePath]) => ({
    fileName,
    sourcePath: path.join(rootDir, sourceRelativePath),
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
