#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_TARGET = 'preview';
const DEFAULT_READY_STATUSES = ['ready', 'degraded'];
const DEFAULT_FIXTURES_PATH = resolve(process.cwd(), './fixtures/live_backend_smoke_fixtures.json');
const VALID_STREAMS = new Set(['album', 'song']);
const VALID_FIXTURE_SURFACES = new Set(['search', 'calendar_month', 'radar', 'entity_detail', 'release_detail']);

function getDefaultReportPath(target) {
  const normalizedTarget = typeof target === 'string' && target.trim().length > 0 ? target.trim() : DEFAULT_TARGET;
  return resolve(process.cwd(), `./reports/live_backend_smoke_${normalizedTarget}.json`);
}

function parseArgs(argv) {
  const options = {
    baseUrl: null,
    target: DEFAULT_TARGET,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    reportPath: null,
    fixturesPath: DEFAULT_FIXTURES_PATH,
    allowReadyStatuses: [...DEFAULT_READY_STATUSES],
    skipReady: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--base-url') {
      options.baseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (value === '--target') {
      options.target = argv[index + 1] ?? DEFAULT_TARGET;
      index += 1;
      continue;
    }

    if (value === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1] ?? getDefaultReportPath(options.target));
      index += 1;
      continue;
    }

    if (value === '--fixtures-path') {
      options.fixturesPath = resolve(process.cwd(), argv[index + 1] ?? DEFAULT_FIXTURES_PATH);
      index += 1;
      continue;
    }

    if (value === '--allow-ready-statuses') {
      const rawValue = argv[index + 1] ?? '';
      options.allowReadyStatuses = rawValue
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      index += 1;
      continue;
    }

    if (value === '--skip-ready') {
      options.skipReady = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!options.baseUrl || typeof options.baseUrl !== 'string') {
    throw new Error('--base-url is required');
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  if (!options.allowReadyStatuses.length) {
    throw new Error('--allow-ready-statuses must contain at least one status');
  }

  return {
    ...options,
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    reportPath: options.reportPath ?? getDefaultReportPath(options.target),
  };
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }

  for (const entry of value) {
    requireString(entry, `${label}[]`);
  }

  return value;
}

function buildRequestId(label) {
  const normalizedLabel = String(label).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return `live-smoke-${normalizedLabel}-${randomUUID()}`;
}

function buildHeaders(requestId) {
  return {
    accept: 'application/json',
    'x-request-id': requestId,
  };
}

function truncatePreview(value) {
  if (typeof value !== 'string') {
    return null;
  }

  if (value.length <= 1500) {
    return value;
  }

  return `${value.slice(0, 1500)}...`;
}

function readResponseRequestId(body, response) {
  const metaRequestId =
    body && typeof body === 'object' && body !== null && typeof body.meta?.request_id === 'string'
      ? body.meta.request_id
      : null;

  if (metaRequestId) {
    return metaRequestId;
  }

  const headerValue = response.headers.get('x-request-id');
  return typeof headerValue === 'string' && headerValue.trim().length > 0 ? headerValue.trim() : null;
}

function selectHeaders(response) {
  const headerNames = ['content-type', 'cache-control', 'x-request-id'];
  return Object.fromEntries(
    headerNames
      .map((name) => [name, response.headers.get(name)])
      .filter((entry) => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

async function parseResponseBody(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {
      body: null,
      bodyPreview: null,
    };
  }

  try {
    return {
      body: JSON.parse(rawText),
      bodyPreview: truncatePreview(rawText),
    };
  } catch {
    return {
      body: null,
      bodyPreview: truncatePreview(rawText),
    };
  }
}

function buildRequestPath(urlString) {
  const url = new URL(urlString);
  return `${url.pathname}${url.search}`;
}

function describePath(request) {
  return request?.path ?? 'unknown-path';
}

function validateJsonEnvelope(request) {
  if (request.network_error) {
    return `Network error for ${describePath(request)}: ${request.network_error}`;
  }

  if (request.status !== 200) {
    return `Expected 200 from ${describePath(request)}, received ${String(request.status)}`;
  }

  if (!isRecord(request.body) || !('data' in request.body)) {
    return `Expected a JSON read envelope from ${describePath(request)}.`;
  }

  return null;
}

function buildFailure(error, requests, status = null) {
  return {
    ok: false,
    error,
    status,
    requests,
  };
}

function buildSuccess(requests, status = 200) {
  return {
    ok: true,
    error: null,
    status,
    requests,
  };
}

async function requestJson(url, label, options) {
  const requestId = buildRequestId(label);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(requestId),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const { body, bodyPreview } = await parseResponseBody(response);

    return {
      label,
      path: buildRequestPath(url),
      url,
      status: response.status,
      request_id_sent: requestId,
      response_request_id: readResponseRequestId(body, response),
      headers: selectHeaders(response),
      body,
      body_preview: bodyPreview,
      network_error: null,
    };
  } catch (error) {
    return {
      label,
      path: buildRequestPath(url),
      url,
      status: null,
      request_id_sent: requestId,
      response_request_id: null,
      headers: {},
      body: null,
      body_preview: null,
      network_error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateFixtureRegistry(fixtureRegistry) {
  const registry = requireRecord(fixtureRegistry, 'fixture registry');
  const fixtures = registry.fixtures;

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    throw new Error('fixture registry.fixtures must be a non-empty array.');
  }

  const seenKeys = new Set();

  fixtures.forEach((fixture, index) => {
    const entry = requireRecord(fixture, `fixture[${index}]`);
    const key = requireString(entry.key, `fixture[${index}].key`);
    const surface = requireString(entry.surface, `fixture[${index}].surface`);

    if (!VALID_FIXTURE_SURFACES.has(surface)) {
      throw new Error(`fixture[${index}].surface must be one of ${Array.from(VALID_FIXTURE_SURFACES).join(', ')}.`);
    }

    if (seenKeys.has(key)) {
      throw new Error(`fixture keys must be unique. Duplicate key: ${key}`);
    }
    seenKeys.add(key);

    const request = requireRecord(entry.request, `fixture[${index}].request`);
    const expect = requireRecord(entry.expect, `fixture[${index}].expect`);

    switch (surface) {
      case 'search':
        requireString(request.query, `fixture[${index}].request.query`);
        requireString(expect.entity_slug, `fixture[${index}].expect.entity_slug`);
        if (expect.display_name !== undefined) {
          requireString(expect.display_name, `fixture[${index}].expect.display_name`);
        }
        break;
      case 'calendar_month':
        requireString(request.month, `fixture[${index}].request.month`);
        if (!/^\d{4}-\d{2}$/.test(request.month)) {
          throw new Error(`fixture[${index}].request.month must be YYYY-MM.`);
        }
        {
          const verifiedRelease = requireRecord(expect.verified_release, `fixture[${index}].expect.verified_release`);
          requireString(verifiedRelease.entity_slug, `fixture[${index}].expect.verified_release.entity_slug`);
          requireString(verifiedRelease.release_title, `fixture[${index}].expect.verified_release.release_title`);
          requireString(verifiedRelease.date, `fixture[${index}].expect.verified_release.date`);
        }
        if (expect.exact_upcoming !== undefined) {
          const exactUpcoming = requireRecord(expect.exact_upcoming, `fixture[${index}].expect.exact_upcoming`);
          requireString(exactUpcoming.entity_slug, `fixture[${index}].expect.exact_upcoming.entity_slug`);
          requireString(exactUpcoming.scheduled_date, `fixture[${index}].expect.exact_upcoming.scheduled_date`);
        }
        if (expect.require_month_only_bucket !== undefined) {
          requireBoolean(expect.require_month_only_bucket, `fixture[${index}].expect.require_month_only_bucket`);
        }
        break;
      case 'radar':
        requireString(expect.long_gap_entity_slug, `fixture[${index}].expect.long_gap_entity_slug`);
        requireString(expect.rookie_entity_slug, `fixture[${index}].expect.rookie_entity_slug`);
        break;
      case 'entity_detail':
        requireString(request.entity_slug, `fixture[${index}].request.entity_slug`);
        requireString(expect.entity_slug, `fixture[${index}].expect.entity_slug`);
        if (expect.display_name !== undefined) {
          requireString(expect.display_name, `fixture[${index}].expect.display_name`);
        }
        if (expect.next_upcoming_date !== undefined) {
          requireString(expect.next_upcoming_date, `fixture[${index}].expect.next_upcoming_date`);
        }
        if (expect.official_youtube_required !== undefined) {
          requireBoolean(expect.official_youtube_required, `fixture[${index}].expect.official_youtube_required`);
        }
        break;
      case 'release_detail':
        requireString(request.entity_slug, `fixture[${index}].request.entity_slug`);
        requireString(request.title, `fixture[${index}].request.title`);
        requireString(request.date, `fixture[${index}].request.date`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(request.date)) {
          throw new Error(`fixture[${index}].request.date must be YYYY-MM-DD.`);
        }
        requireString(request.stream, `fixture[${index}].request.stream`);
        if (!VALID_STREAMS.has(request.stream)) {
          throw new Error(`fixture[${index}].request.stream must be album or song.`);
        }
        requireString(expect.entity_slug, `fixture[${index}].expect.entity_slug`);
        requireString(expect.release_title, `fixture[${index}].expect.release_title`);
        requireString(expect.release_date, `fixture[${index}].expect.release_date`);
        requireString(expect.stream, `fixture[${index}].expect.stream`);
        requireStringArray(expect.title_tracks, `fixture[${index}].expect.title_tracks`);
        if (expect.youtube_music_status !== undefined) {
          requireString(expect.youtube_music_status, `fixture[${index}].expect.youtube_music_status`);
        }
        break;
      default:
        throw new Error(`Unsupported fixture surface: ${surface}`);
    }
  });

  return registry;
}

async function loadFixtureRegistry(fixturesPath) {
  const raw = await readFile(fixturesPath, 'utf8');
  const parsed = JSON.parse(raw);
  return validateFixtureRegistry(parsed);
}

function buildHealthCheck() {
  return {
    label: 'health',
    surface: 'health',
    fixtureKey: null,
    async execute(options) {
      const request = await requestJson(`${options.baseUrl}/health`, 'health', options);
      if (request.network_error) {
        return buildFailure(`Network error for ${describePath(request)}: ${request.network_error}`, [request], request.status);
      }

      if (request.status !== 200) {
        return buildFailure(`Expected 200 from ${request.path}, received ${String(request.status)}`, [request], request.status);
      }

      if (!isRecord(request.body) || request.body.status !== 'ok') {
        return buildFailure(`Expected ${request.path} to return status=ok.`, [request], request.status);
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildReadyCheck() {
  return {
    label: 'ready',
    surface: 'readiness',
    fixtureKey: null,
    async execute(options) {
      const request = await requestJson(`${options.baseUrl}/ready`, 'ready', options);
      const readyStatus = request.body?.status;
      const databaseStatus =
        request.body &&
        typeof request.body === 'object' &&
        request.body !== null &&
        typeof request.body.database === 'object' &&
        request.body.database !== null
          ? request.body.database.status
          : null;

      if (!options.allowReadyStatuses.includes(String(readyStatus))) {
        return buildFailure(
          `Expected /ready status in [${options.allowReadyStatuses.join(', ')}], received ${String(readyStatus)}`,
          [request],
          request.status,
        );
      }

      if (databaseStatus !== 'ready') {
        return buildFailure(
          `Expected /ready database.status to be ready, received ${String(databaseStatus)}`,
          [request],
          request.status,
        );
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildSearchFixtureCheck(fixture) {
  return {
    label: `fixture:${fixture.key}`,
    surface: fixture.surface,
    fixtureKey: fixture.key,
    async execute(options) {
      const url = `${options.baseUrl}/v1/search?q=${encodeURIComponent(fixture.request.query)}`;
      const request = await requestJson(url, fixture.key, options);
      const envelopeError = validateJsonEnvelope(request);

      if (envelopeError) {
        return buildFailure(envelopeError, [request], request.status);
      }

      const entities = Array.isArray(request.body?.data?.entities) ? request.body.data.entities : null;
      if (entities === null) {
        return buildFailure(`Expected ${request.path} to return an entities array.`, [request], request.status);
      }

      const match = entities.find((entry) => entry?.entity_slug === fixture.expect.entity_slug);
      if (!match) {
        return buildFailure(
          `Expected ${request.path} to contain entity_slug=${fixture.expect.entity_slug}.`,
          [request],
          request.status,
        );
      }

      if (fixture.expect.display_name && match.display_name !== fixture.expect.display_name) {
        return buildFailure(
          `Expected ${request.path} to return display_name=${fixture.expect.display_name} for ${fixture.expect.entity_slug}.`,
          [request],
          request.status,
        );
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildCalendarFixtureCheck(fixture) {
  return {
    label: `fixture:${fixture.key}`,
    surface: fixture.surface,
    fixtureKey: fixture.key,
    async execute(options) {
      const url = `${options.baseUrl}/v1/calendar/month?month=${encodeURIComponent(fixture.request.month)}`;
      const request = await requestJson(url, fixture.key, options);
      const envelopeError = validateJsonEnvelope(request);

      if (envelopeError) {
        return buildFailure(envelopeError, [request], request.status);
      }

      const data = request.body?.data;
      if (!isRecord(data) || !isRecord(data.summary)) {
        return buildFailure(`Expected ${request.path} to return summary data.`, [request], request.status);
      }

      const summaryKeys = ['verified_count', 'exact_upcoming_count', 'month_only_upcoming_count'];
      for (const key of summaryKeys) {
        if (typeof data.summary[key] !== 'number') {
          return buildFailure(`Expected ${request.path} summary.${key} to be numeric.`, [request], request.status);
        }
      }

      const days = Array.isArray(data.days) ? data.days : null;
      const monthOnlyUpcoming = Array.isArray(data.month_only_upcoming) ? data.month_only_upcoming : null;
      const verifiedList = Array.isArray(data.verified_list) ? data.verified_list : [];

      if (days === null || monthOnlyUpcoming === null) {
        return buildFailure(
          `Expected ${request.path} to return days and month_only_upcoming arrays.`,
          [request],
          request.status,
        );
      }

      const hasInvalidExactUpcoming = days.some(
        (day) =>
          !Array.isArray(day?.exact_upcoming) ||
          day.exact_upcoming.some((entry) => entry?.date_precision !== 'exact'),
      );
      if (hasInvalidExactUpcoming) {
        return buildFailure(`Expected ${request.path} exact_upcoming items to stay exact-only.`, [request], request.status);
      }

      const hasInvalidMonthOnly = monthOnlyUpcoming.some((entry) => entry?.date_precision !== 'month_only');
      if (hasInvalidMonthOnly) {
        return buildFailure(
          `Expected ${request.path} month_only_upcoming items to stay month_only.`,
          [request],
          request.status,
        );
      }

      if (fixture.expect.require_month_only_bucket === true && monthOnlyUpcoming.length === 0) {
        return buildFailure(`Expected ${request.path} to contain at least one month_only_upcoming item.`, [request], request.status);
      }

      const expectedVerified = fixture.expect.verified_release;
      const verifiedMatch = verifiedList.find(
        (entry) =>
          entry?.entity_slug === expectedVerified.entity_slug &&
          entry?.release_title === expectedVerified.release_title &&
          entry?.release_date === expectedVerified.date,
      );

      if (!verifiedMatch) {
        return buildFailure(
          `Expected ${request.path} to include verified release ${expectedVerified.entity_slug}/${expectedVerified.release_title}/${expectedVerified.date}.`,
          [request],
          request.status,
        );
      }

      if (fixture.expect.exact_upcoming) {
        const expectedUpcoming = fixture.expect.exact_upcoming;
        const exactUpcomingMatch = days.some(
          (day) =>
            Array.isArray(day?.exact_upcoming) &&
            day.exact_upcoming.some(
              (entry) =>
                entry?.entity_slug === expectedUpcoming.entity_slug &&
                entry?.scheduled_date === expectedUpcoming.scheduled_date &&
                entry?.date_precision === 'exact',
            ),
        );

        if (!exactUpcomingMatch) {
          return buildFailure(
            `Expected ${request.path} to include exact upcoming ${expectedUpcoming.entity_slug}/${expectedUpcoming.scheduled_date}.`,
            [request],
            request.status,
          );
        }
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildRadarFixtureCheck(fixture) {
  return {
    label: `fixture:${fixture.key}`,
    surface: fixture.surface,
    fixtureKey: fixture.key,
    async execute(options) {
      const request = await requestJson(`${options.baseUrl}/v1/radar`, fixture.key, options);
      const envelopeError = validateJsonEnvelope(request);

      if (envelopeError) {
        return buildFailure(envelopeError, [request], request.status);
      }

      const data = request.body?.data;
      const longGap = Array.isArray(data?.long_gap) ? data.long_gap : null;
      const rookie = Array.isArray(data?.rookie) ? data.rookie : null;
      const weeklyUpcoming = Array.isArray(data?.weekly_upcoming) ? data.weekly_upcoming : null;
      const changeFeed = Array.isArray(data?.change_feed) ? data.change_feed : null;

      if (longGap === null || rookie === null || weeklyUpcoming === null || changeFeed === null) {
        return buildFailure(
          `Expected ${request.path} to return weekly_upcoming, change_feed, long_gap, and rookie arrays.`,
          [request],
          request.status,
        );
      }

      if (!longGap.some((entry) => entry?.entity_slug === fixture.expect.long_gap_entity_slug)) {
        return buildFailure(
          `Expected ${request.path} long_gap to include ${fixture.expect.long_gap_entity_slug}.`,
          [request],
          request.status,
        );
      }

      if (!rookie.some((entry) => entry?.entity_slug === fixture.expect.rookie_entity_slug)) {
        return buildFailure(
          `Expected ${request.path} rookie to include ${fixture.expect.rookie_entity_slug}.`,
          [request],
          request.status,
        );
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildEntityDetailFixtureCheck(fixture) {
  return {
    label: `fixture:${fixture.key}`,
    surface: fixture.surface,
    fixtureKey: fixture.key,
    async execute(options) {
      const request = await requestJson(`${options.baseUrl}/v1/entities/${fixture.request.entity_slug}`, fixture.key, options);
      const envelopeError = validateJsonEnvelope(request);

      if (envelopeError) {
        return buildFailure(envelopeError, [request], request.status);
      }

      const data = request.body?.data;
      const identity = isRecord(data?.identity) ? data.identity : null;
      const officialLinks = isRecord(data?.official_links) ? data.official_links : null;
      const nextUpcoming = isRecord(data?.next_upcoming) ? data.next_upcoming : null;
      const recentAlbums = Array.isArray(data?.recent_albums) ? data.recent_albums : null;
      const sourceTimeline = Array.isArray(data?.source_timeline) ? data.source_timeline : null;

      if (identity === null || recentAlbums === null || sourceTimeline === null) {
        return buildFailure(
          `Expected ${request.path} to return identity, recent_albums, and source_timeline blocks.`,
          [request],
          request.status,
        );
      }

      if (identity.entity_slug !== fixture.expect.entity_slug) {
        return buildFailure(
          `Expected ${request.path} identity.entity_slug=${fixture.expect.entity_slug}, received ${String(identity.entity_slug)}.`,
          [request],
          request.status,
        );
      }

      if (fixture.expect.display_name && identity.display_name !== fixture.expect.display_name) {
        return buildFailure(
          `Expected ${request.path} identity.display_name=${fixture.expect.display_name}, received ${String(identity.display_name)}.`,
          [request],
          request.status,
        );
      }

      if (fixture.expect.official_youtube_required === true) {
        const youtubeUrl = officialLinks?.youtube;
        if (typeof youtubeUrl !== 'string' || youtubeUrl.length === 0) {
          return buildFailure(`Expected ${request.path} to return an official YouTube link.`, [request], request.status);
        }
      }

      if (fixture.expect.next_upcoming_date) {
        if (nextUpcoming === null || nextUpcoming.scheduled_date !== fixture.expect.next_upcoming_date) {
          return buildFailure(
            `Expected ${request.path} next_upcoming.scheduled_date=${fixture.expect.next_upcoming_date}.`,
            [request],
            request.status,
          );
        }
      }

      return buildSuccess([request], request.status ?? 200);
    },
  };
}

function buildReleaseDetailFixtureCheck(fixture) {
  return {
    label: `fixture:${fixture.key}`,
    surface: fixture.surface,
    fixtureKey: fixture.key,
    async execute(options) {
      const lookupParams = new URLSearchParams({
        entity_slug: fixture.request.entity_slug,
        title: fixture.request.title,
        date: fixture.request.date,
        stream: fixture.request.stream,
      });
      const lookupRequest = await requestJson(
        `${options.baseUrl}/v1/releases/lookup?${lookupParams.toString()}`,
        `${fixture.key}-lookup`,
        options,
      );
      const lookupError = validateJsonEnvelope(lookupRequest);

      if (lookupError) {
        return buildFailure(lookupError, [lookupRequest], lookupRequest.status);
      }

      const releaseId = lookupRequest.body?.data?.release_id;
      const canonicalPath = lookupRequest.body?.data?.canonical_path;

      if (typeof releaseId !== 'string' || releaseId.length === 0 || typeof canonicalPath !== 'string' || canonicalPath.length === 0) {
        return buildFailure(
          `Expected ${lookupRequest.path} to resolve a release_id and canonical_path.`,
          [lookupRequest],
          lookupRequest.status,
        );
      }

      const detailRequest = await requestJson(`${options.baseUrl}${canonicalPath}`, `${fixture.key}-detail`, options);
      const detailError = validateJsonEnvelope(detailRequest);

      if (detailError) {
        return buildFailure(detailError, [lookupRequest, detailRequest], detailRequest.status ?? lookupRequest.status);
      }

      const data = detailRequest.body?.data;
      const release = isRecord(data?.release) ? data.release : null;
      const tracks = Array.isArray(data?.tracks) ? data.tracks : null;
      const youtubeMusic = isRecord(data?.service_links?.youtube_music) ? data.service_links.youtube_music : null;

      if (release === null || tracks === null) {
        return buildFailure(
          `Expected ${detailRequest.path} to return release and tracks blocks.`,
          [lookupRequest, detailRequest],
          detailRequest.status,
        );
      }

      const releaseMatches =
        release.entity_slug === fixture.expect.entity_slug &&
        release.release_title === fixture.expect.release_title &&
        release.release_date === fixture.expect.release_date &&
        release.stream === fixture.expect.stream;

      if (!releaseMatches) {
        return buildFailure(
          `Expected ${detailRequest.path} to match ${fixture.expect.entity_slug}/${fixture.expect.release_title}/${fixture.expect.release_date}/${fixture.expect.stream}.`,
          [lookupRequest, detailRequest],
          detailRequest.status,
        );
      }

      for (const titleTrack of fixture.expect.title_tracks) {
        const trackMatch = tracks.find((entry) => entry?.title === titleTrack && entry?.is_title_track === true);
        if (!trackMatch) {
          return buildFailure(
            `Expected ${detailRequest.path} to include title track ${titleTrack}.`,
            [lookupRequest, detailRequest],
            detailRequest.status,
          );
        }
      }

      if (fixture.expect.youtube_music_status) {
        if (!youtubeMusic || youtubeMusic.status !== fixture.expect.youtube_music_status) {
          return buildFailure(
            `Expected ${detailRequest.path} youtube_music.status=${fixture.expect.youtube_music_status}.`,
            [lookupRequest, detailRequest],
            detailRequest.status,
          );
        }
      }

      return buildSuccess([lookupRequest, detailRequest], detailRequest.status ?? 200);
    },
  };
}

function buildFixtureCheck(fixture) {
  switch (fixture.surface) {
    case 'search':
      return buildSearchFixtureCheck(fixture);
    case 'calendar_month':
      return buildCalendarFixtureCheck(fixture);
    case 'radar':
      return buildRadarFixtureCheck(fixture);
    case 'entity_detail':
      return buildEntityDetailFixtureCheck(fixture);
    case 'release_detail':
      return buildReleaseDetailFixtureCheck(fixture);
    default:
      throw new Error(`Unsupported fixture surface: ${fixture.surface}`);
  }
}

function buildChecks(options, fixtureRegistry) {
  const checks = [buildHealthCheck()];

  if (!options.skipReady) {
    checks.push(buildReadyCheck());
  }

  return checks.concat(fixtureRegistry.fixtures.map((fixture) => buildFixtureCheck(fixture)));
}

function buildSummary(checks) {
  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;
  const bySurface = {};

  for (const check of checks) {
    const surface = check.surface ?? 'unknown';
    const current = bySurface[surface] ?? { total: 0, passed: 0, failed: 0 };
    current.total += 1;
    if (check.ok) {
      current.passed += 1;
    } else {
      current.failed += 1;
    }
    bySurface[surface] = current;
  }

  return {
    total_checks: checks.length,
    fixture_checks: checks.filter((check) => check.fixture_key !== null).length,
    passed_checks: passed,
    failed_checks: failed,
    ok: failed === 0,
    by_surface: bySurface,
  };
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function runCheck(check, options) {
  const startedAt = performance.now();

  try {
    const result = await check.execute(options);

    return {
      label: check.label,
      surface: check.surface ?? null,
      fixture_key: check.fixtureKey ?? null,
      ok: result.ok,
      status: result.status ?? null,
      duration_ms: Number((performance.now() - startedAt).toFixed(2)),
      error: result.ok ? null : result.error,
      requests: Array.isArray(result.requests)
        ? result.requests.map((request) => ({
            label: request.label,
            path: request.path,
            status: request.status,
            request_id_sent: request.request_id_sent,
            response_request_id: request.response_request_id,
            headers: request.headers,
            body_preview: request.body_preview,
            network_error: request.network_error,
          }))
        : [],
    };
  } catch (error) {
    return {
      label: check.label,
      surface: check.surface ?? null,
      fixture_key: check.fixtureKey ?? null,
      ok: false,
      status: null,
      duration_ms: Number((performance.now() - startedAt).toFixed(2)),
      error: error instanceof Error ? error.message : String(error),
      requests: [],
    };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const fixtureRegistry = await loadFixtureRegistry(options.fixturesPath);
  const checks = buildChecks(options, fixtureRegistry);
  const results = [];

  for (const check of checks) {
    results.push(await runCheck(check, options));
  }

  const report = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    target: options.target,
    base_url: options.baseUrl,
    timeout_ms: options.timeoutMs,
    fixtures_path: options.fixturesPath,
    fixture_keys: fixtureRegistry.fixtures.map((fixture) => fixture.key),
    ready_statuses_allowed: options.allowReadyStatuses,
    ready_check_skipped: options.skipReady,
    summary: buildSummary(results),
    checks: results,
  };

  await writeReport(options.reportPath, report);

  const summaryLine = `[live-smoke] target=${options.target} fixtures=${fixtureRegistry.fixtures.length} passed=${report.summary.passed_checks} failed=${report.summary.failed_checks} report=${options.reportPath}`;
  console.log(summaryLine);

  if (!report.summary.ok) {
    throw new Error(summaryLine);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[live-smoke] failed: ${message}`);
  process.exitCode = 1;
});
