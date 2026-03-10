import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const FIXTURES_PATH = resolve(process.cwd(), './fixtures/live_backend_smoke_fixtures.json');
const VALID_SURFACES = new Set(['search', 'calendar_month', 'radar', 'entity_detail', 'release_detail']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('canonical live smoke fixture registry covers required backend surfaces', async () => {
  const raw = await readFile(FIXTURES_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  assert.ok(isRecord(parsed));
  assert.ok(Array.isArray(parsed.fixtures));
  assert.ok(parsed.fixtures.length >= 5);

  const fixtures = parsed.fixtures as unknown[];
  const keys = new Set<string>();
  const surfaces = new Set<string>();

  for (const fixture of fixtures) {
    assert.ok(isRecord(fixture));

    const keyValue = fixture.key;
    const surfaceValue = fixture.surface;

    if (typeof keyValue !== 'string') {
      throw new Error('fixture.key must be a string');
    }

    if (typeof surfaceValue !== 'string') {
      throw new Error('fixture.surface must be a string');
    }

    assert.ok(keyValue.length > 0);
    assert.ok(VALID_SURFACES.has(surfaceValue));
    assert.ok(isRecord(fixture.request));
    assert.ok(isRecord(fixture.expect));
    assert.equal(keys.has(keyValue), false);
    keys.add(keyValue);
    surfaces.add(surfaceValue);
  }

  assert.ok(surfaces.has('calendar_month'));
  assert.ok(surfaces.has('radar'));
  assert.ok(surfaces.has('entity_detail'));
  assert.ok(surfaces.has('release_detail'));
});

test('release detail smoke fixture keeps the canonical IVE lookup contract', async () => {
  const raw = await readFile(FIXTURES_PATH, 'utf8');
  const parsed = JSON.parse(raw) as { fixtures: Array<Record<string, unknown>> };

  const fixture = parsed.fixtures.find((entry) => entry.key === 'release-ive-revive-plus');
  assert.ok(fixture);
  assert.ok(isRecord(fixture.request));
  assert.ok(isRecord(fixture.expect));

  const request = fixture.request;
  const expectBlock = fixture.expect;

  assert.equal(request.entity_slug, 'ive');
  assert.equal(request.title, 'REVIVE+');
  assert.equal(request.date, '2026-02-23');
  assert.equal(request.stream, 'album');
  assert.deepEqual(expectBlock.title_tracks, ['BLACKHOLE', 'BANG BANG']);
  assert.equal(expectBlock.youtube_music_status, 'manual_override');
});
