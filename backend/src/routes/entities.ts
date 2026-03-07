import type { FastifyInstance } from 'fastify';

import type { AppConfig } from '../config.js';
import type { DbQueryable } from '../lib/db.js';
import { buildNotImplementedEnvelope } from '../lib/not-implemented.js';

type EntityRouteContext = {
  config: AppConfig;
  db: DbQueryable;
};

type EntityChannelRow = {
  entity_id: string;
  slug: string;
  display_name: string;
  entity_type: string;
  canonical_channel_url: string | null;
  channel_label: string | null;
  owner_type: string | null;
  display_in_team_links: boolean | null;
  allow_mv_uploads: boolean | null;
  provenance: string | null;
  channel_role: string | null;
};

type EntitySlugParams = {
  slug: string;
};

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function registerEntityRoutes(app: FastifyInstance, context: EntityRouteContext): void {
  app.get('/v1/entities/:slug/channels', async (request, reply) => {
    const { slug } = request.params as EntitySlugParams;

    const result = await context.db.query<EntityChannelRow>(
      `
        select
          e.id::text as entity_id,
          e.slug,
          e.display_name,
          e.entity_type,
          yc.canonical_channel_url,
          yc.channel_label,
          yc.owner_type,
          yc.display_in_team_links,
          yc.allow_mv_uploads,
          yc.provenance,
          eyc.channel_role
        from entities e
        left join entity_youtube_channels eyc on eyc.entity_id = e.id
        left join youtube_channels yc on yc.id = eyc.youtube_channel_id
        where e.slug = $1
        order by
          case eyc.channel_role
            when 'both' then 0
            when 'primary_team_channel' then 1
            when 'mv_allowlist' then 2
            else 3
          end,
          yc.channel_label nulls last
      `,
      [slug]
    );

    const entity = result.rows[0];
    if (!entity) {
      return reply.code(404).send({
        meta: {
          route: '/v1/entities/:slug/channels',
          generated_at: new Date().toISOString(),
          timezone: context.config.appTimezone,
          slug,
        },
        error: {
          code: 'entity_not_found',
          message: 'No entity matched the supplied slug.',
        },
      });
    }

    return {
      meta: {
        generated_at: new Date().toISOString(),
        timezone: context.config.appTimezone,
        slug,
      },
      data: {
        entity: {
          entity_id: entity.entity_id,
          slug: entity.slug,
          display_name: entity.display_name,
          entity_type: entity.entity_type,
        },
        channels: result.rows
          .filter((row) => row.canonical_channel_url !== null)
          .map((row) => ({
            canonical_channel_url: row.canonical_channel_url,
            channel_label: row.channel_label,
            owner_type: row.owner_type,
            display_in_team_links: row.display_in_team_links === true,
            allow_mv_uploads: row.allow_mv_uploads === true,
            provenance: row.provenance,
            channel_role: row.channel_role,
          })),
        summary: {
          official_youtube_url:
            result.rows.find((row) => row.display_in_team_links === true)?.canonical_channel_url ?? null,
          mv_allowlist_urls: result.rows
            .filter((row) => row.allow_mv_uploads === true)
            .map((row) => asNullableString(row.canonical_channel_url))
            .filter((url): url is string => url !== null),
        },
      },
    };
  });

  app.get('/v1/entities/:slug', async (_request, reply) => {
    return reply.code(501).send(buildNotImplementedEnvelope('/v1/entities/:slug', context.config.appTimezone));
  });
}
