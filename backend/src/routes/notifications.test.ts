import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../app.js';
import type { AppConfig } from '../config.js';
import type { DbPool } from '../lib/db.js';

const TEST_CONFIG: AppConfig = {
  appEnv: 'development',
  port: 3000,
  appTimezone: 'Asia/Seoul',
  databaseUrl: 'postgresql://test:test@localhost/test',
  databaseMode: 'pooled',
  databaseConnectionTimeoutMs: 3_000,
  databaseReadTimeoutMs: 5_000,
  allowedWebOrigins: ['https://iamsomething.github.io'],
  readRateLimits: {
    search: { max: 600, windowMs: 60_000 },
    calendarMonth: { max: 300, windowMs: 60_000 },
    entityDetail: { max: 300, windowMs: 60_000 },
    releaseDetail: { max: 300, windowMs: 60_000 },
    radar: { max: 120, windowMs: 60_000 },
  },
};

type FakeRegistration = {
  id: string;
  installation_id: string;
  platform: 'ios' | 'android';
  build_profile: 'development' | 'preview' | 'production';
  expo_push_token: string | null;
  alerts_enabled: boolean;
  permission_status: 'not_determined' | 'denied' | 'granted' | 'provisional';
  device_locale: string | null;
  app_version: string | null;
  backend_request_id: string | null;
  is_active: boolean;
  disabled_reason: string | null;
  last_seen_at: string;
  last_registered_at: string | null;
  last_token_refreshed_at: string | null;
  disabled_at: string | null;
  metadata: Record<string, unknown>;
};

function createFakeDb() {
  let registrationCounter = 1;
  const registrations = new Map<string, FakeRegistration>();

  async function query(sql: string, params: unknown[] = []) {
    if (sql === 'begin' || sql === 'commit' || sql === 'rollback') {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('from mobile_push_registrations') && sql.includes('where installation_id = $1')) {
      const installationId = String(params[0]);
      const registration = registrations.get(installationId);
      return {
        rows: registration ? [registration] : [],
        rowCount: registration ? 1 : 0,
      };
    }

    if (sql.includes('set\n              is_active = false') && sql.includes("disabled_reason = 'superseded'")) {
      const token = String(params[0]);
      const installationId = String(params[1]);
      let rowCount = 0;
      for (const registration of registrations.values()) {
        if (registration.installation_id !== installationId && registration.expo_push_token === token && registration.is_active) {
          registration.is_active = false;
          registration.disabled_reason = 'superseded';
          rowCount += 1;
        }
      }
      return { rows: [], rowCount };
    }

    if (sql.includes('insert into mobile_push_registrations')) {
      const installationId = String(params[0]);
      const existing = registrations.get(installationId);
      const record: FakeRegistration = {
        id: existing?.id ?? `registration-${registrationCounter++}`,
        installation_id: installationId,
        platform: params[1] as FakeRegistration['platform'],
        build_profile: params[2] as FakeRegistration['build_profile'],
        expo_push_token: params[3] as string | null,
        alerts_enabled: Boolean(params[4]),
        permission_status: params[5] as FakeRegistration['permission_status'],
        device_locale: (params[6] as string | null) ?? null,
        app_version: (params[7] as string | null) ?? null,
        backend_request_id: (params[8] as string | null) ?? null,
        is_active: Boolean(params[9]),
        disabled_reason: (params[10] as string | null) ?? null,
        last_seen_at: '2026-03-11T00:00:00.000Z',
        last_registered_at: '2026-03-11T00:00:00.000Z',
        last_token_refreshed_at: params[11] ? '2026-03-11T00:00:00.000Z' : existing?.last_token_refreshed_at ?? null,
        disabled_at: Boolean(params[9]) ? null : '2026-03-11T00:00:00.000Z',
        metadata: JSON.parse(String(params[12])),
      };
      registrations.set(installationId, record);
      return {
        rows: [record],
        rowCount: 1,
      };
    }

    if (sql.includes('update mobile_push_registrations') && sql.includes('set\n          alerts_enabled = $2')) {
      const installationId = String(params[0]);
      const registration = registrations.get(installationId);
      if (!registration) {
        return { rows: [], rowCount: 0 };
      }
      registration.alerts_enabled = Boolean(params[1]);
      registration.backend_request_id = String(params[2]);
      registration.is_active = Boolean(params[3]);
      registration.disabled_reason = (params[4] as string | null) ?? null;
      registration.disabled_at = registration.is_active ? null : '2026-03-11T00:00:00.000Z';
      registration.last_seen_at = '2026-03-11T00:00:00.000Z';
      return { rows: [registration], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in notifications route test.\n${sql}`);
  }

  const pool = {
    query,
    connect: async () => ({
      query,
      release() {},
    }),
    end: async () => {},
  } as unknown as DbPool;

  return {
    pool,
    registrations,
  };
}

test('POST /v1/mobile/push/registration upserts an active registration', async () => {
  const fakeDb = createFakeDb();
  const app = buildApp({ config: TEST_CONFIG, db: fakeDb.pool });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/mobile/push/registration',
    payload: {
      installation_id: 'install-1',
      platform: 'ios',
      build_profile: 'preview',
      expo_push_token: 'ExponentPushToken[test-token]',
      alerts_enabled: true,
      permission_status: 'granted',
      device_locale: 'ko-KR',
      app_version: '0.1.0',
      metadata: {
        source: 'expo-notifications',
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.registration.installation_id, 'install-1');
  assert.equal(body.data.registration.is_active, true);
  assert.equal(body.data.registration.permission_status, 'granted');
  assert.equal(body.data.registration.expo_push_token_present, true);
});

test('POST /v1/mobile/push/preferences disables alerts without deleting registration', async () => {
  const fakeDb = createFakeDb();
  fakeDb.registrations.set('install-2', {
    id: 'registration-2',
    installation_id: 'install-2',
    platform: 'android',
    build_profile: 'preview',
    expo_push_token: 'ExponentPushToken[android-token]',
    alerts_enabled: true,
    permission_status: 'granted',
    device_locale: 'ko-KR',
    app_version: '0.1.0',
    backend_request_id: null,
    is_active: true,
    disabled_reason: null,
    last_seen_at: '2026-03-11T00:00:00.000Z',
    last_registered_at: '2026-03-11T00:00:00.000Z',
    last_token_refreshed_at: '2026-03-11T00:00:00.000Z',
    disabled_at: null,
    metadata: {},
  });
  const app = buildApp({ config: TEST_CONFIG, db: fakeDb.pool });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/mobile/push/preferences',
    payload: {
      installation_id: 'install-2',
      alerts_enabled: false,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.data.registration.installation_id, 'install-2');
  assert.equal(body.data.registration.alerts_enabled, false);
  assert.equal(body.data.registration.is_active, false);
  assert.equal(body.data.registration.disabled_reason, 'alerts_disabled');
});
