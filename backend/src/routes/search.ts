import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope, routeError } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';
import { buildSearchNeedle, compactNormalizedAlias, normalizeAliasValue, type SearchNeedle } from '../lib/normalization.js';

type SearchRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type SearchQuery = {
  q?: string;
  limit?: string;
  segment?: string;
};

type EntitySearchRow = {
  entity_id: string;
  entity_slug: string;
  aliases: string[] | null;
  payload: unknown;
  generated_at: Date | string;
};

type ReleaseSearchRow = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
  release_format: string | null;
};

type UpcomingSearchRow = {
  upcoming_signal_id: string;
  entity_id: string;
  entity_slug: string;
  display_name: string;
  headline: string;
  scheduled_date: string | null;
  scheduled_month: string | null;
  date_precision: string;
  date_status: string;
  release_format: string | null;
  confidence_score: number | string | null;
  source_type: string | null;
  source_url: string | null;
  evidence_summary: string | null;
};

type EntitySearchPayload = {
  entity_slug: string;
  display_name: string;
  canonical_name: string;
  entity_type: string;
  agency_name: string | null;
  aliases: string[];
  latest_release: {
    release_id: string;
    release_title: string;
    release_date: string;
    stream: string;
    release_kind: string | null;
  } | null;
  next_upcoming: {
    headline: string;
    scheduled_date: string;
    scheduled_month: string | null;
    date_precision: string;
    date_status: string;
    release_format: string | null;
    confidence_score: number | null;
  } | null;
};

type EntityMatch = {
  entity_id: string;
  entity_slug: string;
  display_name: string;
  canonical_name: string;
  entity_type: string;
  agency_name: string | null;
  latest_release: EntitySearchPayload['latest_release'];
  next_upcoming: EntitySearchPayload['next_upcoming'];
  match_reason: 'display_name_exact' | 'alias_exact' | 'alias_partial' | 'partial';
  matched_alias: string | null;
  score: number;
};

type ReleaseMatch = {
  release_id: string;
  entity_slug: string;
  display_name: string;
  release_title: string;
  release_date: string;
  stream: string;
  release_kind: string | null;
  release_format: string | null;
  match_reason: 'release_title_exact' | 'entity_exact_latest_release' | 'release_title_partial';
  matched_alias: string | null;
  score: number;
};

type UpcomingMatch = {
  upcoming_signal_id: string;
  entity_slug: string;
  display_name: string;
  headline: string;
  scheduled_date: string | null;
  scheduled_month: string | null;
  date_precision: string;
  date_status: string;
  release_format: string | null;
  confidence_score: number | null;
  source_type: string | null;
  source_url: string | null;
  evidence_summary: string | null;
  match_reason: 'entity_exact' | 'headline_exact' | 'partial';
  matched_alias: string | null;
  score: number;
};

const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toIsoString(value: Date | string | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function toScheduledMonth(scheduledDate: string | null | undefined, scheduledMonth: string | null | undefined): string | null {
  const normalizedMonth = asNullableString(scheduledMonth);
  if (normalizedMonth) {
    return normalizedMonth;
  }

  const normalizedDate = asNullableString(scheduledDate);
  if (normalizedDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return normalizedDate.slice(0, 7);
  }

  return null;
}

function toReleaseFormat(value: string | null | undefined): string | null {
  return asNullableString(value);
}

function resolveTodayIsoDate(timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isElapsedExactUpcomingRow(
  row:
    | Pick<UpcomingSearchRow, 'date_precision' | 'scheduled_date'>
    | Pick<NonNullable<EntitySearchPayload['next_upcoming']>, 'date_precision' | 'scheduled_date'>
    | null,
  todayIsoDate: string,
): boolean {
  return Boolean(row?.date_precision === 'exact' && row.scheduled_date && row.scheduled_date < todayIsoDate);
}

function parseSearchLimit(value: string | undefined): number | null {
  if (value === undefined) {
    return DEFAULT_SEARCH_LIMIT;
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, MAX_SEARCH_LIMIT);
}

function normalizeEntityPayload(payload: unknown): EntitySearchPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const entitySlug = asNullableString(payload.entity_slug);
  const displayName = asNullableString(payload.display_name);
  const canonicalName = asNullableString(payload.canonical_name);
  const entityType = asNullableString(payload.entity_type);

  if (!entitySlug || !displayName || !canonicalName || !entityType) {
    return null;
  }

  const aliases = Array.isArray(payload.aliases)
    ? payload.aliases.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];

  const latestRelease = isRecord(payload.latest_release)
    ? {
        release_id: asNullableString(payload.latest_release.release_id) ?? '',
        release_title: asNullableString(payload.latest_release.release_title) ?? '',
        release_date: asNullableString(payload.latest_release.release_date) ?? '',
        stream: asNullableString(payload.latest_release.stream) ?? '',
        release_kind: asNullableString(payload.latest_release.release_kind),
      }
    : null;

  const nextUpcoming = isRecord(payload.next_upcoming)
    ? {
        headline: asNullableString(payload.next_upcoming.headline) ?? '',
        scheduled_date: asNullableString(payload.next_upcoming.scheduled_date) ?? '',
        scheduled_month: toScheduledMonth(
          asNullableString(payload.next_upcoming.scheduled_date),
          asNullableString(payload.next_upcoming.scheduled_month),
        ),
        date_precision: asNullableString(payload.next_upcoming.date_precision) ?? '',
        date_status: asNullableString(payload.next_upcoming.date_status) ?? '',
        release_format: toReleaseFormat(asNullableString(payload.next_upcoming.release_format)),
        confidence_score: asNumber(payload.next_upcoming.confidence_score),
      }
    : null;

  return {
    entity_slug: entitySlug,
    display_name: displayName,
    canonical_name: canonicalName,
    entity_type: entityType,
    agency_name: asNullableString(payload.agency_name),
    aliases,
    latest_release:
      latestRelease &&
      latestRelease.release_id &&
      latestRelease.release_title &&
      latestRelease.release_date &&
      latestRelease.stream
        ? latestRelease
        : null,
    next_upcoming:
      nextUpcoming &&
      nextUpcoming.headline &&
      nextUpcoming.date_precision &&
      nextUpcoming.date_status
        ? nextUpcoming
        : null,
  };
}

function buildEntityUpcomingSummary(row: UpcomingSearchRow): EntitySearchPayload['next_upcoming'] {
  return {
    headline: row.headline,
    scheduled_date: row.scheduled_date ?? '',
    scheduled_month: toScheduledMonth(row.scheduled_date, row.scheduled_month),
    date_precision: row.date_precision,
    date_status: row.date_status,
    release_format: toReleaseFormat(row.release_format),
    confidence_score: asNumber(row.confidence_score),
  };
}

function buildEntityMatch(row: EntitySearchRow, payload: EntitySearchPayload, needle: SearchNeedle): EntityMatch {
  const primaryNames = [payload.display_name, payload.canonical_name, payload.entity_slug];
  const exactPrimary = findExactMatch(primaryNames, needle);
  const nonPrimaryAliases = payload.aliases.filter((alias) => !primaryNames.includes(alias));
  const exactAlias = findExactMatch(nonPrimaryAliases, needle);
  const partialAlias = findPartialMatch(nonPrimaryAliases, needle);

  let matchReason: EntityMatch['match_reason'] = 'partial';
  let matchedAlias: string | null = null;
  let score = 100;

  if (exactPrimary) {
    matchReason = 'display_name_exact';
    matchedAlias = exactPrimary;
    score = 400;
  } else if (exactAlias) {
    matchReason = 'alias_exact';
    matchedAlias = exactAlias;
    score = 300;
  } else if (partialAlias) {
    matchReason = 'alias_partial';
    matchedAlias = partialAlias;
    score = 200;
  }

  return {
    entity_id: row.entity_id,
    entity_slug: payload.entity_slug,
    display_name: payload.display_name,
    canonical_name: payload.canonical_name,
    entity_type: payload.entity_type,
    agency_name: payload.agency_name,
    latest_release: payload.latest_release,
    next_upcoming: payload.next_upcoming,
    match_reason: matchReason,
    matched_alias: matchedAlias,
    score,
  };
}

function buildContextEntityMatch(row: EntitySearchRow, payload: EntitySearchPayload): EntityMatch {
  return {
    entity_id: row.entity_id,
    entity_slug: payload.entity_slug,
    display_name: payload.display_name,
    canonical_name: payload.canonical_name,
    entity_type: payload.entity_type,
    agency_name: payload.agency_name,
    latest_release: payload.latest_release,
    next_upcoming: payload.next_upcoming,
    match_reason: 'partial',
    matched_alias: null,
    score: 100,
  };
}

function findExactMatch(values: string[], needle: SearchNeedle): string | null {
  for (const value of values) {
    const normalized = normalizeAliasValue(value);
    if (!normalized) {
      continue;
    }

    if (normalized === needle.normalized || compactNormalizedAlias(normalized) === needle.compact) {
      return value;
    }
  }

  return null;
}

function findPartialMatch(values: string[], needle: SearchNeedle): string | null {
  for (const value of values) {
    const normalized = normalizeAliasValue(value);
    if (!normalized) {
      continue;
    }

    if (normalized.includes(needle.normalized) || compactNormalizedAlias(normalized).includes(needle.compact)) {
      return value;
    }
  }

  return null;
}

function compareEntityMatches(left: EntityMatch, right: EntityMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftUpcoming = left.next_upcoming?.scheduled_date ?? left.next_upcoming?.scheduled_month ?? '';
  const rightUpcoming = right.next_upcoming?.scheduled_date ?? right.next_upcoming?.scheduled_month ?? '';
  if (leftUpcoming !== rightUpcoming) {
    if (!leftUpcoming) {
      return 1;
    }
    if (!rightUpcoming) {
      return -1;
    }
    return leftUpcoming.localeCompare(rightUpcoming);
  }

  const leftRelease = left.latest_release?.release_date ?? '';
  const rightRelease = right.latest_release?.release_date ?? '';
  if (leftRelease !== rightRelease) {
    return rightRelease.localeCompare(leftRelease);
  }

  return left.display_name.localeCompare(right.display_name);
}

function compareReleaseMatches(left: ReleaseMatch, right: ReleaseMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.release_date !== right.release_date) {
    return right.release_date.localeCompare(left.release_date);
  }

  return left.release_title.localeCompare(right.release_title);
}

function compareUpcomingMatches(left: UpcomingMatch, right: UpcomingMatch): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftDate = left.scheduled_date ?? left.scheduled_month ?? '';
  const rightDate = right.scheduled_date ?? right.scheduled_month ?? '';
  if (leftDate !== rightDate) {
    if (!leftDate) {
      return 1;
    }
    if (!rightDate) {
      return -1;
    }
    return leftDate.localeCompare(rightDate);
  }

  return left.display_name.localeCompare(right.display_name);
}

export function registerSearchRoutes(app: FastifyInstance, context: SearchRouteContext): void {
  app.get('/v1/search', async (request, reply) => {
    const { q, limit: limitQuery } = request.query as SearchQuery;

    if (!q) {
      throw routeError(400, 'invalid_request', 'q query parameter is required.');
    }

    const needle = buildSearchNeedle(q);
    const limit = parseSearchLimit(limitQuery);
    const todayIsoDate = resolveTodayIsoDate(context.config.appTimezone);

    if (!needle || limit === null) {
      throw routeError(
        400,
        'invalid_request',
        'q must contain searchable text and limit must be a positive integer when supplied.',
        { query: q },
      );
    }

    reply.header('Cache-Control', 'no-store');

    const entityResult = await context.db.query<EntitySearchRow>(
      `
        select
          entity_id::text as entity_id,
          entity_slug,
          aliases,
          payload,
          generated_at
        from entity_search_documents
        where exists (
          select 1
          from unnest(normalized_terms) as term
          where term like '%' || $1 || '%'
             or replace(term, ' ', '') like '%' || $2 || '%'
        )
        limit $3
      `,
      [needle.normalized, needle.compact, limit * 10]
    );

    const entityMatches = entityResult.rows
      .map((row): EntityMatch | null => {
        const payload = normalizeEntityPayload(row.payload);
        return payload ? buildEntityMatch(row, payload, needle) : null;
      })
      .filter((item): item is EntityMatch => item !== null);
    for (const match of entityMatches) {
      if (isElapsedExactUpcomingRow(match.next_upcoming, todayIsoDate)) {
        match.next_upcoming = null;
      }
    }
    const entityMatchById = new Map(entityMatches.map((item) => [item.entity_id, item]));
    const entityMatchBySlug = new Map(entityMatches.map((item) => [item.entity_slug, item]));

    const releaseTitleResult = await context.db.query<ReleaseSearchRow>(
      `
        select
          r.id::text as release_id,
          e.slug as entity_slug,
          e.display_name,
          r.release_title,
          r.release_date::text as release_date,
          r.stream,
          r.release_kind,
          r.release_format
        from releases r
        join entities e on e.id = r.entity_id
        where
          projection_normalize_text(r.release_title) like '%' || $1 || '%'
          or replace(projection_normalize_text(r.release_title), ' ', '') like '%' || $2 || '%'
        order by r.release_date desc, r.release_title asc
        limit $3
      `,
      [needle.normalized, needle.compact, limit * 10]
    );

    const releaseMatchMap = new Map<string, ReleaseMatch>();
    const contextEntitySlugs = new Set<string>();
    for (const row of releaseTitleResult.rows) {
      const normalizedTitle = normalizeAliasValue(row.release_title);
      const isExact = normalizedTitle === needle.normalized || compactNormalizedAlias(normalizedTitle) === needle.compact;
      if (isExact && !entityMatchBySlug.has(row.entity_slug)) {
        contextEntitySlugs.add(row.entity_slug);
      }

      releaseMatchMap.set(row.release_id, {
        release_id: row.release_id,
        entity_slug: row.entity_slug,
        display_name: row.display_name,
        release_title: row.release_title,
        release_date: row.release_date,
        stream: row.stream,
        release_kind: row.release_kind,
        release_format: row.release_format,
        match_reason: isExact ? 'release_title_exact' : 'release_title_partial',
        matched_alias: row.release_title,
        score: isExact ? 300 : 100,
      });
    }

    const exactEntityLatestReleaseIds = entityMatches
      .filter((item) => item.match_reason === 'display_name_exact' || item.match_reason === 'alias_exact')
      .map((item) => item.latest_release?.release_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .filter((value, index, list) => list.indexOf(value) === index)
      .filter((value) => !releaseMatchMap.has(value));

    if (exactEntityLatestReleaseIds.length > 0) {
      const entityLatestResult = await context.db.query<ReleaseSearchRow>(
        `
          select
            r.id::text as release_id,
            e.slug as entity_slug,
            e.display_name,
            r.release_title,
            r.release_date::text as release_date,
            r.stream,
            r.release_kind,
            r.release_format
          from releases r
          join entities e on e.id = r.entity_id
          where r.id = any($1::uuid[])
        `,
        [exactEntityLatestReleaseIds]
      );

      for (const row of entityLatestResult.rows) {
        const matchedEntity = entityMatches.find((item) => item.latest_release?.release_id === row.release_id);
        releaseMatchMap.set(row.release_id, {
          release_id: row.release_id,
          entity_slug: row.entity_slug,
          display_name: row.display_name,
          release_title: row.release_title,
          release_date: row.release_date,
          stream: row.stream,
          release_kind: row.release_kind,
          release_format: row.release_format,
          match_reason: 'entity_exact_latest_release',
          matched_alias: matchedEntity?.matched_alias ?? matchedEntity?.display_name ?? null,
          score: 200,
        });
      }
    }

    const upcomingTitleResult = await context.db.query<UpcomingSearchRow>(
      `
        select
          us.id::text as upcoming_signal_id,
          e.id::text as entity_id,
          e.slug as entity_slug,
          e.display_name,
          us.headline,
          us.scheduled_date::text as scheduled_date,
          us.scheduled_month::text as scheduled_month,
          us.date_precision,
          us.date_status,
          us.release_format,
          us.confidence_score::double precision as confidence_score,
          source.source_type,
          source.source_url,
          source.evidence_summary
        from upcoming_signals us
        join entities e on e.id = us.entity_id
        left join lateral (
          select
            uss.source_type,
            uss.source_url,
            uss.evidence_summary
          from upcoming_signal_sources uss
          where uss.upcoming_signal_id = us.id
          order by uss.created_at asc
          limit 1
        ) source on true
        where
          us.is_active = true
          and (
            projection_normalize_text(us.headline) like '%' || $1 || '%'
            or replace(projection_normalize_text(us.headline), ' ', '') like '%' || $2 || '%'
          )
        order by
          us.scheduled_date asc nulls last,
          us.scheduled_month asc nulls last,
          us.confidence_score desc nulls last,
          us.headline asc
        limit $3
      `,
      [needle.normalized, needle.compact, limit * 10]
    );

    const upcomingMatchMap = new Map<string, UpcomingMatch>();
    for (const row of upcomingTitleResult.rows) {
      if (isElapsedExactUpcomingRow(row, todayIsoDate)) {
        continue;
      }
      const normalizedHeadline = normalizeAliasValue(row.headline);
      const isExact = normalizedHeadline === needle.normalized || compactNormalizedAlias(normalizedHeadline) === needle.compact;
      if (isExact && !entityMatchBySlug.has(row.entity_slug)) {
        contextEntitySlugs.add(row.entity_slug);
      }

      upcomingMatchMap.set(row.upcoming_signal_id, {
        upcoming_signal_id: row.upcoming_signal_id,
        entity_slug: row.entity_slug,
        display_name: row.display_name,
        headline: row.headline,
        scheduled_date: row.scheduled_date,
        scheduled_month: toScheduledMonth(row.scheduled_date, row.scheduled_month),
        date_precision: row.date_precision,
        date_status: row.date_status,
        release_format: toReleaseFormat(row.release_format),
        confidence_score: asNumber(row.confidence_score),
        source_type: row.source_type,
        source_url: row.source_url,
        evidence_summary: row.evidence_summary,
        match_reason: isExact ? 'headline_exact' : 'partial',
        matched_alias: isExact ? row.headline : null,
        score: isExact ? 200 : 100,
      });
    }

    const contextEntityRows = contextEntitySlugs.size
      ? await context.db.query<EntitySearchRow>(
          `
            select
              entity_id::text as entity_id,
              entity_slug,
              aliases,
              payload,
              generated_at
            from entity_search_documents
            where entity_slug = any($1::text[])
          `,
          [Array.from(contextEntitySlugs)]
        )
      : null;

    if (contextEntityRows) {
      for (const row of contextEntityRows.rows) {
        if (entityMatchById.has(row.entity_id)) {
          continue;
        }

        const payload = normalizeEntityPayload(row.payload);
        if (!payload) {
          continue;
        }

        const match = buildContextEntityMatch(row, payload);
        entityMatches.push(match);
        entityMatchById.set(match.entity_id, match);
        entityMatchBySlug.set(match.entity_slug, match);
      }
    }

    const exactEntityIds = entityMatches
      .filter((item) => item.match_reason === 'display_name_exact' || item.match_reason === 'alias_exact')
      .map((item) => item.entity_id)
      .filter((value, index, list) => list.indexOf(value) === index);

    const entityIdsForUpcomingHydration = entityMatches
      .map((item) => item.entity_id)
      .filter((value, index, list) => list.indexOf(value) === index);

    if (entityIdsForUpcomingHydration.length > 0) {
      const entityUpcomingResult = await context.db.query<UpcomingSearchRow>(
        `
          select
            us.id::text as upcoming_signal_id,
            e.id::text as entity_id,
            e.slug as entity_slug,
            e.display_name,
            us.headline,
            us.scheduled_date::text as scheduled_date,
            us.scheduled_month::text as scheduled_month,
            us.date_precision,
            us.date_status,
            us.release_format,
            us.confidence_score::double precision as confidence_score,
            source.source_type,
            source.source_url,
            source.evidence_summary
          from upcoming_signals us
          join entities e on e.id = us.entity_id
          left join lateral (
            select
              uss.source_type,
              uss.source_url,
              uss.evidence_summary
            from upcoming_signal_sources uss
            where uss.upcoming_signal_id = us.id
            order by uss.created_at asc
            limit 1
          ) source on true
          where
            us.is_active = true
            and us.entity_id = any($1::uuid[])
          order by
            us.entity_id,
            case us.date_precision
              when 'exact' then 0
              when 'month_only' then 1
              else 2
            end,
            us.scheduled_date asc nulls last,
            us.scheduled_month asc nulls last,
            us.confidence_score desc nulls last,
            us.headline asc
        `,
        [entityIdsForUpcomingHydration]
      );

      const seenEntityUpcoming = new Set<string>();
      for (const row of entityUpcomingResult.rows) {
        if (seenEntityUpcoming.has(row.entity_id) || isElapsedExactUpcomingRow(row, todayIsoDate)) {
          continue;
        }
        seenEntityUpcoming.add(row.entity_id);

        const matchedEntity = entityMatchById.get(row.entity_id);
        if (matchedEntity) {
          matchedEntity.next_upcoming = buildEntityUpcomingSummary(row);
        }

        if (exactEntityIds.includes(row.entity_id)) {
          const nextMatch: UpcomingMatch = {
            upcoming_signal_id: row.upcoming_signal_id,
            entity_slug: row.entity_slug,
            display_name: row.display_name,
            headline: row.headline,
            scheduled_date: row.scheduled_date,
            scheduled_month: toScheduledMonth(row.scheduled_date, row.scheduled_month),
            date_precision: row.date_precision,
            date_status: row.date_status,
            release_format: toReleaseFormat(row.release_format),
            confidence_score: asNumber(row.confidence_score),
            source_type: row.source_type,
            source_url: row.source_url,
            evidence_summary: row.evidence_summary,
            match_reason: 'entity_exact',
            matched_alias: matchedEntity?.matched_alias ?? matchedEntity?.display_name ?? null,
            score: 300,
          };

          const currentMatch = upcomingMatchMap.get(row.upcoming_signal_id);
          if (!currentMatch || compareUpcomingMatches(nextMatch, currentMatch) < 0) {
            upcomingMatchMap.set(row.upcoming_signal_id, nextMatch);
          }
        }
      }
    }

    const finalEntityMatches = entityMatches.sort(compareEntityMatches).slice(0, limit);
    const releaseMatches = Array.from(releaseMatchMap.values()).sort(compareReleaseMatches).slice(0, limit);
    const generatedAt = entityResult.rows[0]?.generated_at ?? contextEntityRows?.rows[0]?.generated_at;
    const upcomingMatches = Array.from(upcomingMatchMap.values()).sort(compareUpcomingMatches).slice(0, limit);

    return buildReadDataEnvelope(
      request,
      context.config.appTimezone,
      {
        entities: finalEntityMatches.map((item) => ({
          entity_slug: item.entity_slug,
          display_name: item.display_name,
          canonical_name: item.canonical_name,
          entity_type: item.entity_type,
          agency_name: item.agency_name,
          match_reason: item.match_reason,
          matched_alias: item.matched_alias,
          latest_release: item.latest_release,
          next_upcoming: item.next_upcoming,
        })),
        releases: releaseMatches.map((item) => ({
          release_id: item.release_id,
          canonical_path: `/v1/releases/${item.release_id}`,
          entity_slug: item.entity_slug,
          display_name: item.display_name,
          release_title: item.release_title,
          release_date: item.release_date,
          stream: item.stream,
          release_kind: item.release_kind,
          release_format: item.release_format,
          match_reason: item.match_reason,
          matched_alias: item.matched_alias,
        })),
        upcoming: upcomingMatches.map((item) => ({
          upcoming_signal_id: item.upcoming_signal_id,
          entity_slug: item.entity_slug,
          display_name: item.display_name,
          headline: item.headline,
          scheduled_date: item.scheduled_date,
          scheduled_month: item.scheduled_month,
          date_precision: item.date_precision,
          date_status: item.date_status,
          release_format: item.release_format,
          confidence_score: item.confidence_score,
          source_type: item.source_type,
          source_url: item.source_url,
          evidence_summary: item.evidence_summary,
          match_reason: item.match_reason,
          matched_alias: item.matched_alias,
        })),
      },
      {
        query: q,
        normalized_query: needle.normalized,
        limit,
      },
      toIsoString(generatedAt),
    );
  });
}
