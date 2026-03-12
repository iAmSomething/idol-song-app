#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportNonRuntimeWebSnapshots } from './lib/nonRuntimeWebSnapshotExport.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const args = {
    cadenceProfile: 'manual',
    sourceWorkflow: 'manual',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--cadence-profile') {
      args.cadenceProfile = argv[index + 1] ?? args.cadenceProfile;
      index += 1;
      continue;
    }
    if (token === '--source-workflow') {
      args.sourceWorkflow = argv[index + 1] ?? args.sourceWorkflow;
      index += 1;
    }
  }
  return args;
}

const options = parseArgs(process.argv.slice(2));
const { manifest, manifestPath } = await exportNonRuntimeWebSnapshots({
  rootDir: ROOT_DIR,
  cadenceProfile: options.cadenceProfile,
  sourceWorkflow: options.sourceWorkflow,
});

console.log(
  JSON.stringify(
    {
      generated_at: manifest.generated_at,
      classification: manifest.classification,
      file_count: manifest.file_count,
      manifest_path: path.relative(ROOT_DIR, manifestPath),
      source_workflow: manifest.source_workflow,
      cadence_profile: manifest.cadence_profile,
    },
    null,
    2,
  ),
);
