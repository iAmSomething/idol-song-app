import { getRuntimeConfig, type MobileRuntimeConfig } from '../config/runtime';

const DEFAULT_WRITE_TIMEOUT_MS = 6_000;

export type BackendWriteEnvelope<T> = {
  meta?: {
    request_id?: string | null;
    generated_at?: string | null;
    [key: string]: unknown;
  };
  data: T;
};

export type MobilePushRegistrationResponse = {
  registration: {
    registration_id: string;
    installation_id: string;
    platform: 'ios' | 'android';
    build_profile: 'development' | 'preview' | 'production';
    alerts_enabled: boolean;
    permission_status: 'not_determined' | 'denied' | 'granted' | 'provisional';
    expo_push_token_present: boolean;
    is_active: boolean;
    disabled_reason: string | null;
    device_locale?: string | null;
    app_version?: string | null;
    last_seen_at?: string | null;
    last_registered_at?: string | null;
    last_token_refreshed_at?: string | null;
    disabled_at?: string | null;
    metadata?: Record<string, unknown>;
  };
  duplicate_token_registrations_disabled?: number;
  preference_updated?: boolean;
};

export class BackendWriteError extends Error {
  status: number | null;
  code: string | null;
  requestId: string | null;

  constructor(
    message: string,
    options: { status?: number | null; code?: string | null; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'BackendWriteError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.requestId = options.requestId ?? null;
  }
}

function buildUrl(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${pathname}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function wrapFetchError(error: unknown): BackendWriteError {
  if (error instanceof BackendWriteError) {
    return error;
  }

  if (isAbortError(error)) {
    return new BackendWriteError('백엔드 응답이 지연되어 요청을 중단했습니다. 다시 시도해 주세요.', {
      code: 'timeout',
    });
  }

  const message =
    error instanceof Error && error.message
      ? error.message
      : '백엔드 쓰기 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';

  return new BackendWriteError(message, {
    code: 'network_unavailable',
  });
}

async function readJsonResponse<T>(response: Response): Promise<BackendWriteEnvelope<T>> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    throw new BackendWriteError('Backend response was not valid JSON.', {
      status: response.status,
    });
  }

  const requestId =
    response.headers?.get?.('x-request-id') ??
    response.headers?.get?.('x-correlation-id') ??
    null;

  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
        : `Backend write request failed with status ${response.status}.`;
    const code =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.code === 'string'
        ? payload.error.code
        : null;
    throw new BackendWriteError(message, {
      status: response.status,
      code,
      requestId,
    });
  }

  if (!isRecord(payload) || !('data' in payload)) {
    throw new BackendWriteError('Backend response envelope was missing data.', {
      requestId,
    });
  }

  return payload as BackendWriteEnvelope<T>;
}

export type BackendWriteClient = {
  registerPushDevice(payload: {
    installation_id: string;
    platform: 'ios' | 'android';
    build_profile: 'development' | 'preview' | 'production';
    expo_push_token: string | null;
    alerts_enabled: boolean;
    permission_status: 'not_determined' | 'denied' | 'granted' | 'provisional';
    device_locale?: string | null;
    app_version?: string | null;
    disabled_reason_hint?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<BackendWriteEnvelope<MobilePushRegistrationResponse>>;
  updatePushPreferences(payload: {
    installation_id: string;
    alerts_enabled: boolean;
  }): Promise<BackendWriteEnvelope<MobilePushRegistrationResponse>>;
};

export function createBackendWriteClient(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_WRITE_TIMEOUT_MS,
): BackendWriteClient {
  const apiBaseUrl = runtimeConfig.services.apiBaseUrl;

  if (!apiBaseUrl) {
    throw new BackendWriteError('Backend API base URL is not configured.');
  }
  const configuredBaseUrl = apiBaseUrl;

  async function post<T>(pathname: string, body: Record<string, unknown>) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId =
      controller && timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
      const response = await fetchImpl(buildUrl(configuredBaseUrl, pathname), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return await readJsonResponse<T>(response);
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      throw wrapFetchError(error);
    }
  }

  return {
    registerPushDevice(payload) {
      return post<MobilePushRegistrationResponse>('/v1/mobile/push/registration', payload);
    },
    updatePushPreferences(payload) {
      return post<MobilePushRegistrationResponse>('/v1/mobile/push/preferences', payload);
    },
  };
}
