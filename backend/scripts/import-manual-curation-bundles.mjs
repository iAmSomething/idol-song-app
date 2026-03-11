#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyManualCurationImports, readJson, writeJson } from './lib/manualCurationBundles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

const DEFAULT_SERVICE_LINK_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_service_links.json');
const DEFAULT_TITLE_TRACK_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_title_tracks.json');
const DEFAULT_ENTITY_IDENTITY_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_entity_identity.json');
const DEFAULT_RELEASE_DETAIL_OVERRIDES_PATH = path.join(ROOT_DIR, 'release_detail_overrides.json');
const DEFAULT_ARTIST_PROFILES_PATH = path.join(ROOT_DIR, 'web', 'src', 'data', 'artistProfiles.json');
const DEFAULT_SUMMARY_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_import_summary.json');

function parseArgs(argv) {
  const options = {
    serviceLinkBundlePath: DEFAULT_SERVICE_LINK_BUNDLE_PATH,
    titleTrackBundlePath: DEFAULT_TITLE_TRACK_BUNDLE_PATH,
    entityIdentityBundlePath: DEFAULT_ENTITY_IDENTITY_BUNDLE_PATH,
    releaseDetailOverridesPath: DEFAULT_RELEASE_DETAIL_OVERRIDES_PATH,
    artistProfilesPath: DEFAULT_ARTIST_PROFILES_PATH,
    summaryPath: DEFAULT_SUMMARY_PATH,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--service-link-bundle-path') {
      options.serviceLinkBundlePath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--title-track-bundle-path') {
      options.titleTrackBundlePath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--entity-identity-bundle-path') {
      options.entityIdentityBundlePath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--release-detail-overrides-path') {
      options.releaseDetailOverridesPath = path.resolve(ROOT_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--artist-profiles-path') {
      options.artistProfilesPath = path.resolve(ROOT_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--summary-path') {
      options.summaryPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [serviceLinkBundle, titleTrackBundle, entityIdentityBundle, releaseDetailOverrides, artistProfiles] = await Promise.all([
    readOptionalJson(options.serviceLinkBundlePath),
    readOptionalJson(options.titleTrackBundlePath),
    readOptionalJson(options.entityIdentityBundlePath),
    readJson(options.releaseDetailOverridesPath),
    readJson(options.artistProfilesPath),
  ]);

  const result = applyManualCurationImports({
    serviceLinkBundle,
    titleTrackBundle,
    entityIdentityBundle,
    releaseDetailOverrides,
    artistProfiles,
  });

  if (!options.dryRun) {
    await Promise.all([
      writeJson(options.releaseDetailOverridesPath, result.releaseDetailOverrides),
      writeJson(options.artistProfilesPath, result.artistProfiles),
    ]);
  }

  await writeJson(options.summaryPath, {
    ...result.summary,
    dry_run: options.dryRun,
    service_link_bundle_path: serviceLinkBundle ? path.relative(BACKEND_DIR, options.serviceLinkBundlePath) : null,
    title_track_bundle_path: titleTrackBundle ? path.relative(BACKEND_DIR, options.titleTrackBundlePath) : null,
    entity_identity_bundle_path: entityIdentityBundle ? path.relative(BACKEND_DIR, options.entityIdentityBundlePath) : null,
    release_detail_overrides_path: path.relative(ROOT_DIR, options.releaseDetailOverridesPath),
    artist_profiles_path: path.relative(ROOT_DIR, options.artistProfilesPath),
  });

  console.log(
    JSON.stringify(
      {
        ...result.summary,
        dry_run: options.dryRun,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
