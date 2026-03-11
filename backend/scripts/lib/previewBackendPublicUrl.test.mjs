import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractBackendPublicUrlCandidates,
  selectBackendPublicUrl,
  urlsAreSameOrigin,
} from './previewBackendPublicUrl.mjs';

test('extractBackendPublicUrlCandidates reads provided railway domain JSON', () => {
  const candidates = extractBackendPublicUrlCandidates(
    JSON.stringify({
      domain: 'idol-song-app-preview.up.railway.app',
    }),
  );

  assert.deepEqual(candidates, ['https://idol-song-app-preview.up.railway.app']);
});

test('extractBackendPublicUrlCandidates finds nested URLs from status JSON', () => {
  const candidates = extractBackendPublicUrlCandidates(
    JSON.stringify({
      project: {
        services: [
          {
            domains: [
              {
                url: 'https://preview-api.idol-song-app.example.com',
              },
              {
                hostname: 'idol-song-app-preview.up.railway.app',
              },
            ],
          },
        ],
      },
    }),
  );

  assert.deepEqual(candidates, [
    'https://preview-api.idol-song-app.example.com',
    'https://idol-song-app-preview.up.railway.app',
  ]);
});

test('extractBackendPublicUrlCandidates falls back to plain-text parsing', () => {
  const candidates = extractBackendPublicUrlCandidates(
    'Generated domain: idol-song-app-preview.up.railway.app\n',
  );

  assert.deepEqual(candidates, ['https://idol-song-app-preview.up.railway.app']);
});

test('selectBackendPublicUrl prefers railway-provided domain and filters production URL', () => {
  const selected = selectBackendPublicUrl(
    [
      'https://idol-song-app-production.up.railway.app',
      'https://preview-api.idol-song-app.example.com',
      'https://idol-song-app-preview.up.railway.app',
    ],
    {
      productionUrl: 'https://idol-song-app-production.up.railway.app',
    },
  );

  assert.equal(selected, 'https://idol-song-app-preview.up.railway.app');
});

test('urlsAreSameOrigin normalizes scheme and trailing slash', () => {
  assert.equal(
    urlsAreSameOrigin('https://idol-song-app-preview.up.railway.app/', 'idol-song-app-preview.up.railway.app'),
    true,
  );
  assert.equal(
    urlsAreSameOrigin('https://idol-song-app-preview.up.railway.app', 'https://idol-song-app-production.up.railway.app'),
    false,
  );
});
