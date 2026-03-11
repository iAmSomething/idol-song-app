import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import { buildReadDataEnvelope, routeError } from '../lib/api.js';
import type { DbPool } from '../lib/db.js';

type NotificationRouteContext = {
  config: AppConfig;
  db: DbPool;
};

type PushPermissionStatus = 'not_determined' | 'denied' | 'granted' | 'provisional';
type PushPlatform = 'ios' | 'android';
type PushBuildProfile = 'development' | 'preview' | 'production';
type PushDisabledReason =
  | 'alerts_disabled'
  | 'permission_denied'
  | 'permission_not_determined'
  | 'token_missing'
  | 'provider_invalid'
  | 'superseded'
  | 'manual_reset'
  | 'project_unconfigured'
  | 'device_unavailable';

type RegistrationRecord = {
  id: string;
  installation_id: string;
  platform: PushPlatform;
  build_profile: PushBuildProfile;
  expo_push_token: string | null;
  alerts_enabled: boolean;
  permission_status: PushPermissionStatus;
  device_locale: string | null;
  app_version: string | null;
  backend_request_id: string | null;
  is_active: boolean;
  disabled_reason: PushDisabledReason | null;
  last_seen_at: Date | string;
  last_registered_at: Date | string | null;
  last_token_refreshed_at: Date | string | null;
  disabled_at: Date | string | null;
  metadata: Record<string, unknown> | null;
};

type RegistrationRequestBody = {
  installation_id?: unknown;
  platform?: unknown;
  build_profile?: unknown;
  expo_push_token?: unknown;
  alerts_enabled?: unknown;
  permission_status?: unknown;
  device_locale?: unknown;
  app_version?: unknown;
  disabled_reason_hint?: unknown;
  metadata?: unknown;
};

type PreferenceRequestBody = {
  installation_id?: unknown;
  alerts_enabled?: unknown;
};

const PUSH_PERMISSION_STATUSES = new Set<PushPermissionStatus>([
  'not_determined',
  'denied',
  'granted',
  'provisional',
]);
const PUSH_PLATFORMS = new Set<PushPlatform>(['ios', 'android']);
const PUSH_BUILD_PROFILES = new Set<PushBuildProfile>(['development', 'preview', 'production']);
const DISABLED_REASON_HINTS = new Set<PushDisabledReason>([
  'alerts_disabled',
  'permission_denied',
  'permission_not_determined',
  'token_missing',
  'provider_invalid',
  'superseded',
  'manual_reset',
  'project_unconfigured',
  'device_unavailable',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw routeError(400, 'invalid_request', `${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw routeError(400, 'invalid_request', `${fieldName} must be a boolean.`);
  }

  return value;
}

function asPushPlatform(value: unknown): PushPlatform {
  const platform = asRequiredString(value, 'platform');
  if (!PUSH_PLATFORMS.has(platform as PushPlatform)) {
    throw routeError(400, 'invalid_request', 'platform must be ios or android.');
  }

  return platform as PushPlatform;
}

function asPushBuildProfile(value: unknown): PushBuildProfile {
  const profile = asRequiredString(value, 'build_profile');
  if (!PUSH_BUILD_PROFILES.has(profile as PushBuildProfile)) {
    throw routeError(400, 'invalid_request', 'build_profile must be development, preview, or production.');
  }

  return profile as PushBuildProfile;
}

function asPushPermissionStatus(value: unknown): PushPermissionStatus {
  const permissionStatus = asRequiredString(value, 'permission_status');
  if (!PUSH_PERMISSION_STATUSES.has(permissionStatus as PushPermissionStatus)) {
    throw routeError(
      400,
      'invalid_request',
      'permission_status must be not_determined, denied, granted, or provisional.',
    );
  }

  return permissionStatus as PushPermissionStatus;
}

function asDisabledReasonHint(value: unknown): PushDisabledReason | null {
  const reason = asOptionalString(value);
  if (reason === null) {
    return null;
  }

  if (!DISABLED_REASON_HINTS.has(reason as PushDisabledReason)) {
    throw routeError(400, 'invalid_request', 'disabled_reason_hint has an unsupported value.');
  }

  return reason as PushDisabledReason;
}

function asMetadata(value: unknown): Record<string, unknown> {
  if (value == null) {
    return {};
  }

  if (!isRecord(value)) {
    throw routeError(400, 'invalid_request', 'metadata must be a JSON object when provided.');
  }

  return value;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function resolveRegistrationState(args: {
  alertsEnabled: boolean;
  permissionStatus: PushPermissionStatus;
  expoPushToken: string | null;
  disabledReasonHint: PushDisabledReason | null;
}) {
  const { alertsEnabled, permissionStatus, expoPushToken, disabledReasonHint } = args;

  if (!alertsEnabled) {
    return {
      isActive: false,
      disabledReason: 'alerts_disabled' as PushDisabledReason,
    };
  }

  if (permissionStatus === 'denied') {
    return {
      isActive: false,
      disabledReason: 'permission_denied' as PushDisabledReason,
    };
  }

  if (permissionStatus === 'not_determined') {
    return {
      isActive: false,
      disabledReason: 'permission_not_determined' as PushDisabledReason,
    };
  }

  if (!expoPushToken) {
    return {
      isActive: false,
      disabledReason: disabledReasonHint ?? ('token_missing' as PushDisabledReason),
    };
  }

  return {
    isActive: true,
    disabledReason: null,
  };
}

function buildRegistrationResponse(record: RegistrationRecord, extras: Record<string, unknown> = {}) {
  return {
    registration: {
      registration_id: record.id,
      installation_id: record.installation_id,
      platform: record.platform,
      build_profile: record.build_profile,
      alerts_enabled: record.alerts_enabled,
      permission_status: record.permission_status,
      expo_push_token_present: record.expo_push_token !== null,
      is_active: record.is_active,
      disabled_reason: record.disabled_reason,
      device_locale: record.device_locale,
      app_version: record.app_version,
      last_seen_at: toIsoString(record.last_seen_at),
      last_registered_at: toIsoString(record.last_registered_at),
      last_token_refreshed_at: toIsoString(record.last_token_refreshed_at),
      disabled_at: toIsoString(record.disabled_at),
      metadata: record.metadata ?? {},
    },
    ...extras,
  };
}

async function queryRegistrationByInstallationId(db: DbPool | { query: DbPool['query'] }, installationId: string) {
  const result = await db.query<RegistrationRecord>(
    `
      select
        id::text,
        installation_id,
        platform,
        build_profile,
        expo_push_token,
        alerts_enabled,
        permission_status,
        device_locale,
        app_version,
        backend_request_id,
        is_active,
        disabled_reason,
        last_seen_at,
        last_registered_at,
        last_token_refreshed_at,
        disabled_at,
        metadata
      from mobile_push_registrations
      where installation_id = $1
      limit 1
    `,
    [installationId],
  );

  return result.rows[0] ?? null;
}

export function registerNotificationRoutes(app: FastifyInstance, context: NotificationRouteContext): void {
  const { config, db } = context;

  app.post('/v1/mobile/push/registration', async (request, reply) => {
    if (!isRecord(request.body)) {
      throw routeError(400, 'invalid_request', 'Request body must be a JSON object.');
    }

    const body = request.body as RegistrationRequestBody;
    const installationId = asRequiredString(body.installation_id, 'installation_id');
    const platform = asPushPlatform(body.platform);
    const buildProfile = asPushBuildProfile(body.build_profile);
    const expoPushToken = asOptionalString(body.expo_push_token);
    const alertsEnabled = asBoolean(body.alerts_enabled, 'alerts_enabled');
    const permissionStatus = asPushPermissionStatus(body.permission_status);
    const deviceLocale = asOptionalString(body.device_locale);
    const appVersion = asOptionalString(body.app_version);
    const disabledReasonHint = asDisabledReasonHint(body.disabled_reason_hint);
    const metadata = asMetadata(body.metadata);
    const state = resolveRegistrationState({
      alertsEnabled,
      permissionStatus,
      expoPushToken,
      disabledReasonHint,
    });

    const client = await db.connect();
    try {
      await client.query('begin');

      const existingRegistration = await queryRegistrationByInstallationId(client, installationId);

      let supersededCount = 0;
      if (expoPushToken) {
        const supersededResult = await client.query(
          `
            update mobile_push_registrations
            set
              is_active = false,
              disabled_reason = 'superseded',
              disabled_at = now(),
              updated_at = now()
            where expo_push_token = $1
              and installation_id <> $2
              and is_active = true
          `,
          [expoPushToken, installationId],
        );
        supersededCount = supersededResult.rowCount ?? 0;
      }

      const shouldMarkTokenRefreshed =
        expoPushToken !== null &&
        (existingRegistration === null || existingRegistration.expo_push_token !== expoPushToken);

      const upsertResult = await client.query<RegistrationRecord>(
        `
          insert into mobile_push_registrations (
            installation_id,
            platform,
            build_profile,
            expo_push_token,
            alerts_enabled,
            permission_status,
            device_locale,
            app_version,
            backend_request_id,
            is_active,
            disabled_reason,
            last_seen_at,
            last_registered_at,
            last_token_refreshed_at,
            disabled_at,
            metadata
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now(),
            case when $12 then now() else null end,
            case when $10 then null else now() end,
            $13::jsonb
          )
          on conflict (installation_id)
          do update set
            platform = excluded.platform,
            build_profile = excluded.build_profile,
            expo_push_token = excluded.expo_push_token,
            alerts_enabled = excluded.alerts_enabled,
            permission_status = excluded.permission_status,
            device_locale = excluded.device_locale,
            app_version = excluded.app_version,
            backend_request_id = excluded.backend_request_id,
            is_active = excluded.is_active,
            disabled_reason = excluded.disabled_reason,
            last_seen_at = now(),
            last_registered_at = now(),
            last_token_refreshed_at = case when $12 then now() else mobile_push_registrations.last_token_refreshed_at end,
            disabled_at = case when excluded.is_active then null else now() end,
            metadata = excluded.metadata,
            updated_at = now()
          returning
            id::text,
            installation_id,
            platform,
            build_profile,
            expo_push_token,
            alerts_enabled,
            permission_status,
            device_locale,
            app_version,
            backend_request_id,
            is_active,
            disabled_reason,
            last_seen_at,
            last_registered_at,
            last_token_refreshed_at,
            disabled_at,
            metadata
        `,
        [
          installationId,
          platform,
          buildProfile,
          expoPushToken,
          alertsEnabled,
          permissionStatus,
          deviceLocale,
          appVersion,
          request.id,
          state.isActive,
          state.disabledReason,
          shouldMarkTokenRefreshed,
          JSON.stringify(metadata),
        ],
      );

      await client.query('commit');

      const registration = upsertResult.rows[0];
      if (!registration) {
        throw routeError(500, 'internal_error', 'Failed to persist mobile push registration.');
      }

      return reply.code(200).send(
        buildReadDataEnvelope(
          request,
          config.appTimezone,
          buildRegistrationResponse(registration, {
            duplicate_token_registrations_disabled: supersededCount,
          }),
        ),
      );
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/v1/mobile/push/preferences', async (request, reply) => {
    if (!isRecord(request.body)) {
      throw routeError(400, 'invalid_request', 'Request body must be a JSON object.');
    }

    const body = request.body as PreferenceRequestBody;
    const installationId = asRequiredString(body.installation_id, 'installation_id');
    const alertsEnabled = asBoolean(body.alerts_enabled, 'alerts_enabled');

    const existingRegistration = await queryRegistrationByInstallationId(db, installationId);
    if (!existingRegistration) {
      throw routeError(404, 'not_found', 'Mobile push registration not found.', {
        installation_id: installationId,
      });
    }

    const state = resolveRegistrationState({
      alertsEnabled,
      permissionStatus: existingRegistration.permission_status,
      expoPushToken: existingRegistration.expo_push_token,
      disabledReasonHint: existingRegistration.disabled_reason,
    });

    const updateResult = await db.query<RegistrationRecord>(
      `
        update mobile_push_registrations
        set
          alerts_enabled = $2,
          backend_request_id = $3,
          is_active = $4,
          disabled_reason = $5,
          disabled_at = case when $4 then null else now() end,
          last_seen_at = now(),
          updated_at = now()
        where installation_id = $1
        returning
          id::text,
          installation_id,
          platform,
          build_profile,
          expo_push_token,
          alerts_enabled,
          permission_status,
          device_locale,
          app_version,
          backend_request_id,
          is_active,
          disabled_reason,
          last_seen_at,
          last_registered_at,
          last_token_refreshed_at,
          disabled_at,
          metadata
      `,
      [installationId, alertsEnabled, request.id, state.isActive, state.disabledReason],
    );

    const updatedRegistration = updateResult.rows[0];
    if (!updatedRegistration) {
      throw routeError(500, 'internal_error', 'Failed to update mobile push preferences.');
    }

    return reply.code(200).send(
      buildReadDataEnvelope(
        request,
        config.appTimezone,
        buildRegistrationResponse(updatedRegistration, {
          preference_updated: true,
        }),
      ),
    );
  });
}
