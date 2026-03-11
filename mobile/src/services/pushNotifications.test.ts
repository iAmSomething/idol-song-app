import type { MobileRuntimeConfig } from '../config/runtime';

import {
  MOBILE_STORAGE_KEYS,
  resetStorageAdapter,
  setStorageAdapter,
  writeStoredJson,
  type KeyValueStorageAdapter,
} from './storage';
import {
  getPushSettingsSummary,
  readStoredPushRegistrationState,
  resolveExpoProjectId,
  syncPushRegistration,
  type StoredPushRegistrationState,
} from './pushNotifications';

function createRuntimeConfig(): MobileRuntimeConfig {
  return {
    profile: 'preview',
    dataSource: {
      mode: 'backend-api',
      datasetVersion: 'preview-v1',
    },
    services: {
      apiBaseUrl: 'https://example.com/api',
      analyticsWriteKey: null,
      expoProjectId: 'project-id-123',
    },
    logging: {
      level: 'debug',
    },
    featureGates: {
      radar: true,
      analytics: false,
      remoteRefresh: false,
      mvEmbed: true,
      shareActions: true,
    },
    build: {
      version: '0.1.0',
      commitSha: 'abc123',
    },
  };
}

describe('push notifications service', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const adapter: KeyValueStorageAdapter = {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    };

    setStorageAdapter(adapter);
  });

  afterEach(() => {
    resetStorageAdapter();
  });

  test('prefers the runtime expo project id', () => {
    expect(resolveExpoProjectId(createRuntimeConfig())).toBe('project-id-123');
  });

  test('returns safe defaults when no push registration is stored', () => {
    expect(getPushSettingsSummary(null)).toEqual({
      alertsEnabled: true,
      permissionStatus: 'not_determined',
      isActive: false,
      disabledReason: 'permission_not_determined',
    });
  });

  test('syncs granted permissions and persists backend registration state', async () => {
    const runtimeConfig = createRuntimeConfig();
    const backendClient = {
      registerPushDevice: jest.fn(async () => ({
        meta: {
          request_id: 'req-123',
        },
        data: {
          registration: {
            registration_id: 'registration-123',
            installation_id: 'installation-123',
            platform: 'ios' as const,
            build_profile: 'preview' as const,
            alerts_enabled: true,
            permission_status: 'granted' as const,
            expo_push_token_present: true,
            is_active: true,
            disabled_reason: null,
            last_registered_at: '2026-03-11T00:00:00.000Z',
          },
        },
      })),
      updatePushPreferences: jest.fn(),
    };
    const notificationsModule = {
      getPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        ios: {
          status: 0,
        },
      })),
      getExpoPushTokenAsync: jest.fn(async () => ({
        data: 'ExponentPushToken[test-token]',
      })),
      requestPermissionsAsync: jest.fn(),
      setNotificationChannelAsync: jest.fn(),
    };

    await writeStoredJson(MOBILE_STORAGE_KEYS.pushInstallationId, 'installation-123');

    const nextState = await syncPushRegistration({
      runtimeConfig,
      backendClient,
      notificationsModule: notificationsModule as never,
      reason: 'launch',
    });

    expect(backendClient.registerPushDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        installation_id: 'installation-123',
        expo_push_token: 'ExponentPushToken[test-token]',
        permission_status: 'granted',
      }),
    );
    expect(nextState.registrationId).toBe('registration-123');
    expect(nextState.isActive).toBe(true);
    expect(nextState.projectId).toBe('project-id-123');

    const storedState = (await readStoredPushRegistrationState()) as StoredPushRegistrationState;
    expect(storedState.expoPushToken).toBe('ExponentPushToken[test-token]');
    expect(storedState.lastRequestId).toBe('req-123');
  });
});
