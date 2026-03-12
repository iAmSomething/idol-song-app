import path from 'node:path';
import process from 'node:process';

import { findRuntimeSnapshotImportViolations } from './lib/runtimeImportBoundary.mjs';

const rootDir = path.resolve(process.cwd(), '..');
const violations = findRuntimeSnapshotImportViolations(rootDir);

if (violations.length > 0) {
  console.error('Web runtime regression guard failed.');
  for (const violation of violations) {
    console.error(`- ${violation.file}`);
    console.error(`  reason: ${violation.reason}`);
    for (const specifier of violation.imports) {
      console.error(`  import: ${specifier}`);
    }
  }
  process.exit(1);
}

console.log('Web runtime regression guard passed.');
