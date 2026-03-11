#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManualCurationBundles, readJson, writeJson } from './lib/manualCurationBundles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');

const DEFAULT_SERVICE_LINK_GAP_PATH = path.join(BACKEND_DIR, 'reports', 'service_link_gap_queues.json');
const DEFAULT_TITLE_TRACK_GAP_PATH = path.join(BACKEND_DIR, 'reports', 'title_track_gap_queue.json');
const DEFAULT_ENTITY_IDENTITY_GAP_PATH = path.join(BACKEND_DIR, 'reports', 'entity_identity_workbench.json');

const DEFAULT_SERVICE_LINK_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_service_links.json');
const DEFAULT_TITLE_TRACK_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_title_tracks.json');
const DEFAULT_ENTITY_IDENTITY_BUNDLE_PATH = path.join(BACKEND_DIR, 'reports', 'manual_curation_bundle_entity_identity.json');

function parseArgs(argv) {
  const options = {
    serviceLinkGapPath: DEFAULT_SERVICE_LINK_GAP_PATH,
    titleTrackGapPath: DEFAULT_TITLE_TRACK_GAP_PATH,
    entityIdentityGapPath: DEFAULT_ENTITY_IDENTITY_GAP_PATH,
    serviceLinkBundlePath: DEFAULT_SERVICE_LINK_BUNDLE_PATH,
    titleTrackBundlePath: DEFAULT_TITLE_TRACK_BUNDLE_PATH,
    entityIdentityBundlePath: DEFAULT_ENTITY_IDENTITY_BUNDLE_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--service-link-gap-path') {
      options.serviceLinkGapPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--title-track-gap-path') {
      options.titleTrackGapPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--entity-identity-gap-path') {
      options.entityIdentityGapPath = path.resolve(BACKEND_DIR, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
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
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [serviceLinkGapQueues, titleTrackGapQueue, entityIdentityWorkbench] = await Promise.all([
    readJson(options.serviceLinkGapPath),
    readJson(options.titleTrackGapPath),
    readJson(options.entityIdentityGapPath),
  ]);

  const bundles = buildManualCurationBundles({
    serviceLinkGapQueues,
    titleTrackGapQueue,
    entityIdentityWorkbench,
  });

  await Promise.all([
    writeJson(options.serviceLinkBundlePath, bundles.serviceLink),
    writeJson(options.titleTrackBundlePath, bundles.titleTrack),
    writeJson(options.entityIdentityBundlePath, bundles.entityIdentity),
  ]);

  const summary = {
    generated_at: new Date().toISOString(),
    service_link_bundle: {
      path: path.relative(BACKEND_DIR, options.serviceLinkBundlePath),
      rows: bundles.serviceLink.rows.length,
    },
    title_track_bundle: {
      path: path.relative(BACKEND_DIR, options.titleTrackBundlePath),
      rows: bundles.titleTrack.rows.length,
    },
    entity_identity_bundle: {
      path: path.relative(BACKEND_DIR, options.entityIdentityBundlePath),
      rows: bundles.entityIdentity.rows.length,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
