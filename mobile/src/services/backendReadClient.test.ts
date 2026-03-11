import {
  createBackendReadClient,
} from './backendReadClient';
import type { MobileRuntimeConfig } from '../config/runtime';

function buildRuntimeConfig(): MobileRuntimeConfig {
  return {
    profile: 'preview',
    dataSource: {
      mode: 'backend-api',
      datasetVersion: 'preview-v1',
    },
    services: {
      apiBaseUrl: 'https://example.com/api',
      analyticsWriteKey: null,
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
      commitSha: 'test-sha',
    },
  };
}

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  } as Response;
}

describe('mobile backend read client', () => {
  test('requests calendar month envelope from the shared backend contract', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse({
        meta: {
          generatedAt: '2026-03-10T00:00:00.000Z',
        },
        data: {
          summary: {
            verified_count: 1,
            exact_upcoming_count: 1,
            month_only_upcoming_count: 0,
          },
          nearest_upcoming: null,
          days: [],
          month_only_upcoming: [],
          verified_list: [],
          scheduled_list: [],
        },
      }),
    );

    const client = createBackendReadClient(buildRuntimeConfig(), fetchMock as unknown as typeof fetch);
    const response = await client.getCalendarMonth('2026-03');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/v1/calendar/month?month=2026-03',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(response.meta?.generatedAt).toBe('2026-03-10T00:00:00.000Z');
    expect(response.data.summary.verified_count).toBe(1);
  });

  test('resolves release detail through legacy lookup and then canonical release id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          meta: {
            generatedAt: '2026-03-10T00:00:00.000Z',
          },
          data: {
            release_id: 'release-uuid-1',
            canonical_path: '/v1/releases/release-uuid-1',
            release: {
              release_id: 'release-uuid-1',
              entity_slug: 'yena',
              display_name: 'YENA',
              release_title: 'LOVE CATCHER',
              release_date: '2026-03-11',
              stream: 'album',
              release_kind: 'ep',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          meta: {
            generatedAt: '2026-03-10T00:00:01.000Z',
          },
          data: {
            release: {
              release_id: 'release-uuid-1',
              entity_slug: 'yena',
              display_name: 'YENA',
              release_title: 'LOVE CATCHER',
              release_date: '2026-03-11',
              stream: 'album',
              release_kind: 'ep',
            },
            tracks: [],
            mv: {
              status: 'unresolved',
            },
          },
        }),
      );

    const client = createBackendReadClient(buildRuntimeConfig(), fetchMock as unknown as typeof fetch);
    const response = await client.getReleaseDetailByLegacyId('yena--love-catcher--2026-03-11--album');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://example.com/api/v1/releases/lookup?entity_slug=yena&title=love-catcher&date=2026-03-11&stream=album',
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://example.com/api/v1/releases/release-uuid-1');
    expect(response.lookup.data.release.release_title).toBe('LOVE CATCHER');
    expect(response.detail.data.release.release_id).toBe('release-uuid-1');
  });

  test('throws a typed error when the backend returns an error envelope', async () => {
    const fetchMock = jest.fn(async () =>
      createJsonResponse(
        {
          error: {
            code: 'not_found',
            message: 'No release matched the supplied legacy lookup key.',
          },
        },
        404,
      ),
    );

    const client = createBackendReadClient(buildRuntimeConfig(), fetchMock as unknown as typeof fetch);

    await expect(client.getReleaseDetailByLegacyId('no-such-release')).rejects.toMatchObject({
      name: 'BackendReadError',
      status: null,
      code: 'invalid_release_lookup',
    });

    await expect(client.getCalendarMonth('2026-03')).rejects.toMatchObject({
      name: 'BackendReadError',
      status: 404,
      code: 'not_found',
    });
  });

  test('retries a retryable backend response once before succeeding', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            error: {
              code: 'service_unavailable',
              message: 'Projection refresh is in progress.',
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          meta: {
            generatedAt: '2026-03-10T00:00:02.000Z',
          },
          data: {
            summary: {
              verified_count: 2,
              exact_upcoming_count: 1,
              month_only_upcoming_count: 1,
            },
            nearest_upcoming: null,
            days: [],
            month_only_upcoming: [],
            verified_list: [],
            scheduled_list: [],
          },
        }),
      );

    const client = createBackendReadClient(
      buildRuntimeConfig(),
      fetchMock as unknown as typeof fetch,
      {
        retryCount: 1,
        retryDelayMs: 0,
      },
    );
    const response = await client.getCalendarMonth('2026-03');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.data.summary.verified_count).toBe(2);
  });
});
