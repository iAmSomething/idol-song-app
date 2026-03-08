import type { FastifyInstance } from 'fastify';

import { buildReadDataEnvelope } from '../lib/api.js';
import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';

type ReviewRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type UpcomingReviewRow = {
  review_task_id: string;
  review_type: string;
  status: string;
  review_reason: string[] | null;
  recommended_action: string | null;
  payload: unknown;
  created_at: Date | string;
  entity_id: string | null;
  entity_slug: string | null;
  display_name: string | null;
  entity_type: string | null;
  upcoming_signal_id: string | null;
  headline: string | null;
  scheduled_date: string | null;
  scheduled_month: string | null;
  date_precision: string | null;
  date_status: string | null;
  release_format: string | null;
  confidence_score: number | string | null;
  tracking_status: string | null;
  is_active: boolean | null;
  source_items: unknown;
};

type MvReviewRow = {
  review_task_id: string;
  review_type: string;
  status: string;
  review_reason: string[] | null;
  recommended_action: string | null;
  payload: unknown;
  created_at: Date | string;
  entity_id: string | null;
  entity_slug: string | null;
  display_name: string | null;
  entity_type: string | null;
  release_id: string | null;
  release_title: string | null;
  release_date: string | null;
  stream: string | null;
  release_kind: string | null;
  release_format: string | null;
  youtube_mv_url: string | null;
  youtube_mv_status: string | null;
  youtube_mv_provenance: string | null;
  channel_items: unknown;
};

type UpcomingSourceItem = {
  source_type: string | null;
  source_url: string | null;
  source_domain: string | null;
  published_at: string | null;
  search_term: string | null;
  evidence_summary: string | null;
};

type ChannelItem = {
  canonical_channel_url: string | null;
  channel_label: string | null;
  owner_type: string | null;
  display_in_team_links: boolean;
  allow_mv_uploads: boolean;
  provenance: string | null;
  channel_role: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: number | string | null): number | null {
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

function normalizeReasonList(value: string[] | null, payload: Record<string, unknown> | null): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  const payloadReasons = payload?.review_reason;
  if (Array.isArray(payloadReasons)) {
    return payloadReasons.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  if (typeof payloadReasons === 'string' && payloadReasons.length > 0) {
    return [payloadReasons];
  }

  return [];
}

function normalizeUpcomingSourceItems(value: unknown): UpcomingSourceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      source_type: asNullableString(item.source_type),
      source_url: asNullableString(item.source_url),
      source_domain: asNullableString(item.source_domain),
      published_at: asNullableString(item.published_at),
      search_term: asNullableString(item.search_term),
      evidence_summary: asNullableString(item.evidence_summary),
    }));
}

function normalizeChannelItems(value: unknown): ChannelItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      canonical_channel_url: asNullableString(item.canonical_channel_url),
      channel_label: asNullableString(item.channel_label),
      owner_type: asNullableString(item.owner_type),
      display_in_team_links: item.display_in_team_links === true,
      allow_mv_uploads: item.allow_mv_uploads === true,
      provenance: asNullableString(item.provenance),
      channel_role: asNullableString(item.channel_role),
    }));
}

function getPayloadRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function buildUpcomingItem(row: UpcomingReviewRow) {
  const payload = getPayloadRecord(row.payload);
  const reviewReason = normalizeReasonList(row.review_reason, payload);

  return {
    review_task: {
      review_task_id: row.review_task_id,
      review_type: row.review_type,
      status: row.status,
      created_at: toIsoString(row.created_at),
    },
    entity: row.entity_id && row.entity_slug && row.display_name && row.entity_type
      ? {
          entity_id: row.entity_id,
          slug: row.entity_slug,
          display_name: row.display_name,
          entity_type: row.entity_type,
        }
      : null,
    upcoming_signal: row.upcoming_signal_id
      ? {
          upcoming_signal_id: row.upcoming_signal_id,
          headline: row.headline,
          scheduled_date: row.scheduled_date,
          scheduled_month: row.scheduled_month,
          date_precision: row.date_precision,
          date_status: row.date_status,
          release_format: row.release_format,
          confidence_score: asNumber(row.confidence_score),
          tracking_status: row.tracking_status,
          is_active: row.is_active === true,
          sources: normalizeUpcomingSourceItems(row.source_items),
        }
      : null,
    review_reason: reviewReason,
    recommended_action: row.recommended_action ?? asNullableString(payload?.recommended_action),
    evidence_payload: payload,
  };
}

function buildMvAllowlist(channels: ChannelItem[]) {
  const mvAllowlistUrls = channels
    .filter((channel) => channel.allow_mv_uploads && channel.canonical_channel_url !== null)
    .map((channel) => channel.canonical_channel_url as string);

  const officialYoutubeUrl =
    channels.find((channel) => channel.display_in_team_links && channel.canonical_channel_url !== null)
      ?.canonical_channel_url ?? null;

  return {
    official_youtube_url: officialYoutubeUrl,
    mv_allowlist_urls: mvAllowlistUrls,
    channels,
  };
}

function buildMvItem(row: MvReviewRow) {
  const payload = getPayloadRecord(row.payload);
  const reviewReason = normalizeReasonList(row.review_reason, payload);
  const channels = normalizeChannelItems(row.channel_items);

  return {
    review_task: {
      review_task_id: row.review_task_id,
      review_type: row.review_type,
      status: row.status,
      created_at: toIsoString(row.created_at),
    },
    entity: row.entity_id && row.entity_slug && row.display_name && row.entity_type
      ? {
          entity_id: row.entity_id,
          slug: row.entity_slug,
          display_name: row.display_name,
          entity_type: row.entity_type,
        }
      : null,
    release: row.release_id
      ? {
          release_id: row.release_id,
          release_title: row.release_title,
          release_date: row.release_date,
          stream: row.stream,
          release_kind: row.release_kind,
          release_format: row.release_format,
          youtube_mv: {
            url: row.youtube_mv_url,
            status: row.youtube_mv_status,
            provenance: row.youtube_mv_provenance,
          },
        }
      : null,
    review_reason: reviewReason,
    recommended_action: row.recommended_action ?? asNullableString(payload?.recommended_action),
    allowlist: buildMvAllowlist(channels),
    candidate_payload: payload,
  };
}

export function registerReviewRoutes(app: FastifyInstance, context: ReviewRouteContext): void {
  app.get('/v1/review/upcoming', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');

    const result = await context.db.query<UpcomingReviewRow>(
      `
        select
          rt.id::text as review_task_id,
          rt.review_type,
          rt.status,
          rt.review_reason,
          rt.recommended_action,
          rt.payload,
          rt.created_at,
          e.id::text as entity_id,
          e.slug as entity_slug,
          e.display_name,
          e.entity_type,
          us.id::text as upcoming_signal_id,
          us.headline,
          us.scheduled_date::text as scheduled_date,
          us.scheduled_month::text as scheduled_month,
          us.date_precision,
          us.date_status,
          us.release_format,
          us.confidence_score::double precision as confidence_score,
          us.tracking_status,
          us.is_active,
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'source_type', uss.source_type,
                  'source_url', uss.source_url,
                  'source_domain', uss.source_domain,
                  'published_at', uss.published_at,
                  'search_term', uss.search_term,
                  'evidence_summary', uss.evidence_summary
                )
                order by uss.created_at asc
              )
              from upcoming_signal_sources uss
              where uss.upcoming_signal_id = us.id
            ),
            '[]'::jsonb
          ) as source_items
        from review_tasks rt
        left join entities e on e.id = rt.entity_id
        left join upcoming_signals us on us.id = rt.upcoming_signal_id
        where rt.status = 'open'
          and rt.review_type = 'upcoming_signal'
        order by rt.created_at desc, rt.id desc
      `
    );

    return buildReadDataEnvelope(request, context.config.appTimezone, {
        items: result.rows.map(buildUpcomingItem),
      },
      { total_items: result.rows.length },
    );
  });

  app.get('/v1/review/mv', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');

    const result = await context.db.query<MvReviewRow>(
      `
        select
          rt.id::text as review_task_id,
          rt.review_type,
          rt.status,
          rt.review_reason,
          rt.recommended_action,
          rt.payload,
          rt.created_at,
          e.id::text as entity_id,
          e.slug as entity_slug,
          e.display_name,
          e.entity_type,
          r.id::text as release_id,
          r.release_title,
          r.release_date::text as release_date,
          r.stream,
          r.release_kind,
          r.release_format,
          rsl.url as youtube_mv_url,
          rsl.status as youtube_mv_status,
          rsl.provenance as youtube_mv_provenance,
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'canonical_channel_url', yc.canonical_channel_url,
                  'channel_label', yc.channel_label,
                  'owner_type', yc.owner_type,
                  'display_in_team_links', yc.display_in_team_links,
                  'allow_mv_uploads', yc.allow_mv_uploads,
                  'provenance', yc.provenance,
                  'channel_role', eyc.channel_role
                )
                order by
                  case eyc.channel_role
                    when 'both' then 0
                    when 'primary_team_channel' then 1
                    else 2
                  end,
                  yc.channel_label
              )
              from entity_youtube_channels eyc
              join youtube_channels yc on yc.id = eyc.youtube_channel_id
              where eyc.entity_id = e.id
            ),
            '[]'::jsonb
          ) as channel_items
        from review_tasks rt
        left join entities e on e.id = rt.entity_id
        left join releases r on r.id = rt.release_id
        left join release_service_links rsl on rsl.release_id = r.id and rsl.service_type = 'youtube_mv'
        where rt.status = 'open'
          and rt.review_type = 'mv_candidate'
        order by rt.created_at desc, rt.id desc
      `
    );

    return buildReadDataEnvelope(request, context.config.appTimezone, {
        items: result.rows.map(buildMvItem),
      },
      { total_items: result.rows.length },
    );
  });
}
