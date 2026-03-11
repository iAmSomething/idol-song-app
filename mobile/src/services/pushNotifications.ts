import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getRuntimeConfig, type MobileProfile, type MobileRuntimeConfig } from '../config/runtime';

import { trackAnalyticsEvent } from './analytics';
import {
  createBackendWriteClient,
  type BackendWriteClient,
  type MobilePushRegistrationResponse,
} from './backendWriteClient';
import { MOBILE_STORAGE_KEYS, readStoredJson, writeStoredJson } from './storage';

export type PushPermissionStatus = 'not_determined' | 'denied' | 'granted' | 'provisional';
export type PushDisabledReasonHint = 'project_unconfigured' | 'device_unavailable' | 'manual_reset' | 'token_missing';
export type PushRegistrationSyncReason = 'launch' | 'settings' | 'permission_prompt' | 'token_refresh';

export type PushPermissionSnapshot = {
  permissionStatus: PushPermissionStatus;
  canAskAgain: boolean;
};

export type StoredPushRegistrationState = {
  installationId: string;
  alertsEnabled: boolean;
  permissionStatus: PushPermissionStatus;
  expoPushToken: string | null;
  registrationId: string | null;
  isActive: boolean;
  disabledReason: string | null;
  lastSyncedAt: string | null;
  lastRequestId: string | null;
  projectId: string | null;
  platform: 'ios' | 'android';
  buildProfile: MobileProfile;
};

type NotificationsModule = typeof Notifications;

const DEFAULT_PUSH_STATE: Omit<StoredPushRegistrationState, 'installationId'> = {
  alertsEnabled: true,
  permissionStatus: 'not_determined',
  expoPushToken: null,
  registrationId: null,
  isActive: false,
  disabledReason: 'permission_not_determined',
  lastSyncedAt: null,
  lastRequestId: null,
  projectId: null,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
  buildProfile: getRuntimeConfig().profile,
};

function generateInstallationId(): string {
  const segments = [8, 4, 4, 4, 12].map((length) =>
    Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
  );
  return segments.join('-');
}

function asExpoProjectId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveExpoProjectId(runtimeConfig: MobileRuntimeConfig = getRuntimeConfig()): string | null {
  if (runtimeConfig.services.expoProjectId) {
    return runtimeConfig.services.expoProjectId;
  }

  const constants = Constants as typeof Constants & {
    easConfig?: {
      projectId?: string;
    } | null;
    expoConfig?: {
      extra?: {
        eas?: {
          projectId?: string;
        };
      };
    } | null;
  };

  return (
    asExpoProjectId(constants.easConfig?.projectId) ??
    asExpoProjectId(constants.expoConfig?.extra?.eas?.projectId) ??
    null
  );
}

export function resolvePushPermissionStatus(
  permissions: Notifications.NotificationPermissionsStatus,
): PushPermissionStatus {
  if (permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'provisional';
  }

  if (permissions.granted) {
    return 'granted';
  }

  if (permissions.canAskAgain === false) {
    return 'denied';
  }

  return 'not_determined';
}

export async function getOrCreatePushInstallationId(): Promise<string> {
  const existingValue = await readStoredJson<string>(MOBILE_STORAGE_KEYS.pushInstallationId);
  if (typeof existingValue === 'string' && existingValue.trim().length > 0) {
    return existingValue.trim();
  }

  const nextValue = generateInstallationId();
  await writeStoredJson(MOBILE_STORAGE_KEYS.pushInstallationId, nextValue);
  return nextValue;
}

export async function readStoredPushRegistrationState(): Promise<StoredPushRegistrationState | null> {
  return readStoredJson<StoredPushRegistrationState>(MOBILE_STORAGE_KEYS.pushRegistrationState);
}

export async function writeStoredPushRegistrationState(state: StoredPushRegistrationState): Promise<void> {
  await writeStoredJson(MOBILE_STORAGE_KEYS.pushRegistrationState, state);
}

export async function ensureAndroidNotificationChannel(
  notificationsModule: NotificationsModule = Notifications,
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await notificationsModule.setNotificationChannelAsync('trusted-upcoming', {
    name: 'Trusted upcoming alerts',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#9A3412',
  });
}

export async function getPushPermissionSnapshot(
  notificationsModule: NotificationsModule = Notifications,
): Promise<PushPermissionSnapshot> {
  const permissions = await notificationsModule.getPermissionsAsync();
  return {
    permissionStatus: resolvePushPermissionStatus(permissions),
    canAskAgain: permissions.canAskAgain,
  };
}

export async function requestPushPermissionSnapshot(
  notificationsModule: NotificationsModule = Notifications,
): Promise<PushPermissionSnapshot> {
  const permissions = await notificationsModule.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: true,
    },
  });
  return {
    permissionStatus: resolvePushPermissionStatus(permissions),
    canAskAgain: permissions.canAskAgain,
  };
}

function buildInitialStoredState(
  installationId: string,
  runtimeConfig: MobileRuntimeConfig,
): StoredPushRegistrationState {
  return {
    installationId,
    ...DEFAULT_PUSH_STATE,
    projectId: resolveExpoProjectId(runtimeConfig),
    buildProfile: runtimeConfig.profile,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };
}

function mergeRegistrationEnvelope(args: {
  existingState: StoredPushRegistrationState;
  envelope: MobilePushRegistrationResponse;
  requestId: string | null;
  expoPushToken: string | null;
  projectId: string | null;
}): StoredPushRegistrationState {
  const registration = args.envelope.registration;

  return {
    ...args.existingState,
    alertsEnabled: registration.alerts_enabled,
    permissionStatus: registration.permission_status,
    expoPushToken: args.expoPushToken,
    registrationId: registration.registration_id,
    isActive: registration.is_active,
    disabledReason: registration.disabled_reason,
    lastSyncedAt: registration.last_registered_at ?? new Date().toISOString(),
    lastRequestId: args.requestId,
    projectId: args.projectId,
    platform: registration.platform,
    buildProfile: registration.build_profile,
  };
}

function getDeviceLocale(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? null;
  } catch {
    return null;
  }
}

function classifyTokenAcquisitionFailure(
  error: unknown,
  hasProjectId: boolean,
): PushDisabledReasonHint {
  if (!hasProjectId) {
    return 'project_unconfigured';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('projectid') || message.includes('project id')) {
    return 'project_unconfigured';
  }

  return 'device_unavailable';
}

export async function syncPushRegistration(args: {
  runtimeConfig?: MobileRuntimeConfig;
  backendClient?: BackendWriteClient;
  notificationsModule?: NotificationsModule;
  alertsEnabledOverride?: boolean;
  reason: PushRegistrationSyncReason;
  requestPermission?: boolean;
}): Promise<StoredPushRegistrationState> {
  const runtimeConfig = args.runtimeConfig ?? getRuntimeConfig();
  const backendClient = args.backendClient ?? createBackendWriteClient(runtimeConfig);
  const notificationsModule = args.notificationsModule ?? Notifications;
  const installationId = await getOrCreatePushInstallationId();
  const currentState =
    (await readStoredPushRegistrationState()) ?? buildInitialStoredState(installationId, runtimeConfig);
  const alertsEnabled = args.alertsEnabledOverride ?? currentState.alertsEnabled;
  const permissionSnapshot = args.requestPermission
    ? await requestPushPermissionSnapshot(notificationsModule)
    : await getPushPermissionSnapshot(notificationsModule);
  const projectId = resolveExpoProjectId(runtimeConfig);
  let expoPushToken: string | null = currentState.expoPushToken;
  let disabledReasonHint: PushDisabledReasonHint | null = null;

  if (permissionSnapshot.permissionStatus === 'granted' || permissionSnapshot.permissionStatus === 'provisional') {
    try {
      if (!projectId) {
        throw new Error('Expo projectId is not configured.');
      }

      const token = await notificationsModule.getExpoPushTokenAsync({
        projectId,
      });
      expoPushToken = token.data;
      if (currentState.expoPushToken !== token.data) {
        trackAnalyticsEvent('push_registration_synced', {
          permissionStatus: permissionSnapshot.permissionStatus,
          alertsEnabled,
          active: true,
          hadToken: true,
          reason: args.reason,
        });
      }
    } catch (error) {
      expoPushToken = null;
      disabledReasonHint = classifyTokenAcquisitionFailure(error, Boolean(projectId));
    }
  } else {
    expoPushToken = null;
  }

  const response = await backendClient.registerPushDevice({
    installation_id: installationId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    build_profile: runtimeConfig.profile,
    expo_push_token: expoPushToken,
    alerts_enabled: alertsEnabled,
    permission_status: permissionSnapshot.permissionStatus,
    device_locale: getDeviceLocale(),
    app_version: runtimeConfig.build.version,
    disabled_reason_hint: disabledReasonHint,
    metadata: {
      source: 'expo-notifications',
      sync_reason: args.reason,
      can_ask_again: permissionSnapshot.canAskAgain,
    },
  });

  const nextState = mergeRegistrationEnvelope({
    existingState: currentState,
    envelope: response.data,
    requestId: response.meta?.request_id ?? null,
    expoPushToken,
    projectId,
  });
  await writeStoredPushRegistrationState(nextState);
  return nextState;
}

export async function updatePushAlertsEnabled(args: {
  alertsEnabled: boolean;
  runtimeConfig?: MobileRuntimeConfig;
  backendClient?: BackendWriteClient;
}): Promise<StoredPushRegistrationState> {
  const runtimeConfig = args.runtimeConfig ?? getRuntimeConfig();
  const backendClient = args.backendClient ?? createBackendWriteClient(runtimeConfig);
  const installationId = await getOrCreatePushInstallationId();
  const currentState =
    (await readStoredPushRegistrationState()) ?? buildInitialStoredState(installationId, runtimeConfig);

  if (!currentState.registrationId) {
    return syncPushRegistration({
      runtimeConfig,
      backendClient,
      alertsEnabledOverride: args.alertsEnabled,
      reason: 'settings',
    });
  }

  const response = await backendClient.updatePushPreferences({
    installation_id: installationId,
    alerts_enabled: args.alertsEnabled,
  });

  const nextState = mergeRegistrationEnvelope({
    existingState: {
      ...currentState,
      alertsEnabled: args.alertsEnabled,
    },
    envelope: response.data,
    requestId: response.meta?.request_id ?? null,
    expoPushToken: currentState.expoPushToken,
    projectId: currentState.projectId,
  });
  await writeStoredPushRegistrationState(nextState);
  return nextState;
}

export function getPushSettingsSummary(state: StoredPushRegistrationState | null) {
  if (!state) {
    return {
      alertsEnabled: true,
      permissionStatus: 'not_determined' as PushPermissionStatus,
      isActive: false,
      disabledReason: 'permission_not_determined',
    };
  }

  return {
    alertsEnabled: state.alertsEnabled,
    permissionStatus: state.permissionStatus,
    isActive: state.isActive,
    disabledReason: state.disabledReason,
  };
}
