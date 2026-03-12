import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { findRuntimeSnapshotImportViolations } from './runtimeImportBoundary.mjs';

function withFixture(files, callback) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idol-song-app-web-runtime-guard-'));

  try {
    for (const [relativePath, sourceText] of Object.entries(files)) {
      const absolutePath = path.join(rootDir, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, sourceText);
    }

    callback(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('allows the documented App.tsx transitional snapshot imports', () => {
  withFixture(
    {
      'web/src/App.tsx': `
        import releaseRows from './data/releases.json';
        import watchlistRows from './data/watchlist.json';
      `,
    },
    (rootDir) => {
      assert.deepEqual(findRuntimeSnapshotImportViolations(rootDir), []);
    },
  );
});

test('fails when another shipped runtime file imports committed snapshots', () => {
  withFixture(
    {
      'web/src/App.tsx': `import releaseRows from './data/releases.json';`,
      'web/src/lib/rogue.ts': `import watchlistRows from '../data/watchlist.json';`,
    },
    (rootDir) => {
      assert.deepEqual(findRuntimeSnapshotImportViolations(rootDir), [
        {
          file: 'web/src/lib/rogue.ts',
          imports: ['../data/watchlist.json'],
          reason:
            'Shipped web runtime files must not import committed runtime snapshots outside the documented App.tsx transition boundary.',
        },
      ]);
    },
  );
});

test('fails when App.tsx adds an undocumented snapshot import', () => {
  withFixture(
    {
      'web/src/App.tsx': `
        import releaseRows from './data/releases.json';
        import rogueRows from './data/newSnapshot.json';
      `,
    },
    (rootDir) => {
      assert.deepEqual(findRuntimeSnapshotImportViolations(rootDir), [
        {
          file: 'web/src/App.tsx',
          imports: ['./data/newSnapshot.json'],
          reason:
            'App.tsx may only import the currently documented transitional snapshot set until the final API-only cutover removes this boundary.',
        },
      ]);
    },
  );
});
