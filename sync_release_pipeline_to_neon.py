import argparse
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Sequence

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError as error:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "psycopg is required. Run `python3 -m pip install -r backend/requirements-import.txt` first."
    ) from error

import import_json_to_neon as canonical_import


DEFAULT_SUMMARY_PATH = canonical_import.BACKEND_REPORTS_DIR / "release_pipeline_db_sync_summary.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync release hydration / service-link / MV review pipeline outputs into Neon canonical tables."
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable release pipeline sync summary JSON.",
    )
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable name that contains the direct Neon connection string.",
    )
    return parser.parse_args()


def prune_stale_mv_review_tasks(connection: "psycopg.Connection[Any]", review_task_rows: Sequence[Dict[str, Any]]) -> int:
    desired_ids = [row["id"] for row in review_task_rows]
    with connection.cursor() as cursor:
        if desired_ids:
            placeholders = ", ".join(["%s"] * len(desired_ids))
            cursor.execute(
                f"""
                delete from review_tasks
                where payload->>'source_dataset' = 'mv_manual_review_queue'
                  and id not in ({placeholders})
                """,
                desired_ids,
            )
        else:
            cursor.execute(
                """
                delete from review_tasks
                where payload->>'source_dataset' = 'mv_manual_review_queue'
                """
            )
        deleted = cursor.rowcount
    connection.commit()
    return deleted


def deactivate_released_upcoming_signals(
    connection: "psycopg.Connection[Any]",
    release_rows: Sequence[Dict[str, Any]],
) -> int:
    suppression_scopes = []
    seen_scopes = set()
    for row in release_rows:
        entity_id = row.get("entity_id")
        release_date = row.get("release_date")
        if entity_id is None or release_date is None:
            continue
        normalized_release_title = canonical_import.optional_text(row.get("normalized_release_title")) or ""
        release_month = release_date.replace(day=1)
        scope_key = (entity_id, release_date, release_month, normalized_release_title)
        if scope_key in seen_scopes:
            continue
        seen_scopes.add(scope_key)
        suppression_scopes.append(
            {
                "entity_id": str(entity_id),
                "release_date": release_date.isoformat(),
                "release_month": release_month.isoformat(),
                "normalized_release_title": normalized_release_title,
            }
        )

    if not suppression_scopes:
        return 0

    with connection.cursor() as cursor:
        cursor.execute(
            """
            with suppression_scope as (
              select
                (item->>'entity_id')::uuid as entity_id,
                (item->>'release_date')::date as release_date,
                (item->>'release_month')::date as release_month,
                coalesce(item->>'normalized_release_title', '') as normalized_release_title
              from jsonb_array_elements(%s::jsonb) as item
            ),
            matched_signals as (
              select distinct u.id
              from upcoming_signals u
              join suppression_scope scope
                on scope.entity_id = u.entity_id
              where u.is_active = true
                and (
                  (u.date_precision = 'exact' and u.scheduled_date = scope.release_date)
                  or (u.date_precision = 'month_only' and u.scheduled_month = scope.release_month)
                  or (
                    scope.normalized_release_title <> ''
                    and u.date_precision = 'unknown'
                    and coalesce(u.normalized_headline, '') like ('%%' || scope.normalized_release_title || '%%')
                  )
                )
            )
            update upcoming_signals u
            set is_active = false,
                updated_at = now()
            where u.id in (select id from matched_signals)
            """,
            (Jsonb(suppression_scopes),),
        )
        updated = max(cursor.rowcount, 0)
    connection.commit()
    return updated


def upsert_release_pipeline_rows(
    connection: "psycopg.Connection[Any]",
    payload: Dict[str, Any],
    summary: Dict[str, Any],
) -> None:
    existing = canonical_import.fetch_existing_state(connection)
    operations = {table: Counter() for table in canonical_import.RELEASE_PIPELINE_TABLES}
    summary["stale_pruned"] = {
        "review_tasks": prune_stale_mv_review_tasks(connection, payload["tables"]["review_tasks"])
    }

    def count_operations(table: str, rows: Sequence[Dict[str, Any]], key_builder) -> None:
        current_keys = existing[table]
        for row in rows:
            key = key_builder(row)
            operations[table]["updated" if key in current_keys else "inserted"] += 1

    with connection.pipeline(), connection.cursor() as cursor:
        entity_rows = payload["tables"]["entities"]
        if entity_rows:
            count_operations("entities", entity_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into entities (
                  id, slug, canonical_name, display_name, entity_type, agency_name, debut_year,
                  badge_image_url, badge_source_url, badge_source_label, badge_kind,
                  representative_image_url, representative_image_source
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  slug = excluded.slug,
                  canonical_name = excluded.canonical_name,
                  display_name = excluded.display_name,
                  entity_type = excluded.entity_type,
                  agency_name = excluded.agency_name,
                  debut_year = excluded.debut_year,
                  badge_image_url = excluded.badge_image_url,
                  badge_source_url = excluded.badge_source_url,
                  badge_source_label = excluded.badge_source_label,
                  badge_kind = excluded.badge_kind,
                  representative_image_url = excluded.representative_image_url,
                  representative_image_source = excluded.representative_image_source,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["slug"],
                        row["canonical_name"],
                        row["display_name"],
                        row["entity_type"],
                        row["agency_name"],
                        row["debut_year"],
                        row["badge_image_url"],
                        row["badge_source_url"],
                        row["badge_source_label"],
                        row["badge_kind"],
                        row["representative_image_url"],
                        row["representative_image_source"],
                    )
                    for row in entity_rows
                ],
            )

        official_link_rows = payload["tables"]["entity_official_links"]
        if official_link_rows:
            count_operations("entity_official_links", official_link_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into entity_official_links (
                  id, entity_id, link_type, url, is_primary, provenance
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  entity_id = excluded.entity_id,
                  link_type = excluded.link_type,
                  url = excluded.url,
                  is_primary = excluded.is_primary,
                  provenance = excluded.provenance
                """,
                [
                    (
                        row["id"],
                        row["entity_id"],
                        row["link_type"],
                        row["url"],
                        row["is_primary"],
                        row["provenance"],
                    )
                    for row in official_link_rows
                ],
            )

        entity_metadata_field_rows = payload["tables"]["entity_metadata_fields"]
        if entity_metadata_field_rows:
            count_operations("entity_metadata_fields", entity_metadata_field_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into entity_metadata_fields (
                  id, entity_id, field_key, value_json, status, provenance, source_url, review_notes
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  entity_id = excluded.entity_id,
                  field_key = excluded.field_key,
                  value_json = excluded.value_json,
                  status = excluded.status,
                  provenance = excluded.provenance,
                  source_url = excluded.source_url,
                  review_notes = excluded.review_notes,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["entity_id"],
                        row["field_key"],
                        Jsonb(row["value_json"]),
                        row["status"],
                        row["provenance"],
                        row["source_url"],
                        row["review_notes"],
                    )
                    for row in entity_metadata_field_rows
                ],
            )

        youtube_channel_rows = payload["tables"]["youtube_channels"]
        if youtube_channel_rows:
            count_operations("youtube_channels", youtube_channel_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into youtube_channels (
                  id, canonical_channel_url, channel_label, owner_type,
                  display_in_team_links, allow_mv_uploads, provenance
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  canonical_channel_url = excluded.canonical_channel_url,
                  channel_label = excluded.channel_label,
                  owner_type = excluded.owner_type,
                  display_in_team_links = excluded.display_in_team_links,
                  allow_mv_uploads = excluded.allow_mv_uploads,
                  provenance = excluded.provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["canonical_channel_url"],
                        row["channel_label"],
                        row["owner_type"],
                        row["display_in_team_links"],
                        row["allow_mv_uploads"],
                        row["provenance"],
                    )
                    for row in youtube_channel_rows
                ],
            )

        entity_channel_rows = payload["tables"]["entity_youtube_channels"]
        if entity_channel_rows:
            count_operations(
                "entity_youtube_channels",
                entity_channel_rows,
                lambda row: (str(row["entity_id"]), str(row["youtube_channel_id"])),
            )
            cursor.executemany(
                """
                insert into entity_youtube_channels (
                  entity_id, youtube_channel_id, channel_role
                )
                values (%s, %s, %s)
                on conflict (entity_id, youtube_channel_id) do update set
                  channel_role = excluded.channel_role
                """,
                [(row["entity_id"], row["youtube_channel_id"], row["channel_role"]) for row in entity_channel_rows],
            )

        release_rows = payload["tables"]["releases"]
        if release_rows:
            count_operations("releases", release_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into releases (
                  id, entity_id, release_title, normalized_release_title, release_date, stream, release_kind,
                  release_format, source_url, artist_source_url, musicbrainz_artist_id,
                  musicbrainz_release_group_id, notes
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  entity_id = excluded.entity_id,
                  release_title = excluded.release_title,
                  normalized_release_title = excluded.normalized_release_title,
                  release_date = excluded.release_date,
                  stream = excluded.stream,
                  release_kind = excluded.release_kind,
                  release_format = excluded.release_format,
                  source_url = excluded.source_url,
                  artist_source_url = excluded.artist_source_url,
                  musicbrainz_artist_id = excluded.musicbrainz_artist_id,
                  musicbrainz_release_group_id = excluded.musicbrainz_release_group_id,
                  notes = excluded.notes,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["entity_id"],
                        row["release_title"],
                        row["normalized_release_title"],
                        row["release_date"],
                        row["stream"],
                        row["release_kind"],
                        row["release_format"],
                        row["source_url"],
                        row["artist_source_url"],
                        row["musicbrainz_artist_id"],
                        row["musicbrainz_release_group_id"],
                        row["notes"],
                    )
                    for row in release_rows
                ],
            )

        release_artwork_rows = payload["tables"]["release_artwork"]
        if release_artwork_rows:
            count_operations("release_artwork", release_artwork_rows, lambda row: str(row["release_id"]))
            cursor.executemany(
                """
                insert into release_artwork (
                  release_id, cover_image_url, thumbnail_image_url, artwork_source_type, artwork_source_url,
                  artwork_status, artwork_provenance
                )
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (release_id) do update set
                  cover_image_url = excluded.cover_image_url,
                  thumbnail_image_url = excluded.thumbnail_image_url,
                  artwork_source_type = excluded.artwork_source_type,
                  artwork_source_url = excluded.artwork_source_url,
                  artwork_status = excluded.artwork_status,
                  artwork_provenance = excluded.artwork_provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["release_id"],
                        row["cover_image_url"],
                        row["thumbnail_image_url"],
                        row["artwork_source_type"],
                        row["artwork_source_url"],
                        row["artwork_status"],
                        row["artwork_provenance"],
                    )
                    for row in release_artwork_rows
                ],
            )

        track_rows = payload["tables"]["tracks"]
        if track_rows:
            count_operations("tracks", track_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into tracks (
                  id, release_id, track_order, track_title, normalized_track_title, is_title_track
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  release_id = excluded.release_id,
                  track_order = excluded.track_order,
                  track_title = excluded.track_title,
                  normalized_track_title = excluded.normalized_track_title,
                  is_title_track = excluded.is_title_track,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["release_id"],
                        row["track_order"],
                        row["track_title"],
                        row["normalized_track_title"],
                        row["is_title_track"],
                    )
                    for row in track_rows
                ],
            )

        release_service_rows = payload["tables"]["release_service_links"]
        if release_service_rows:
            count_operations("release_service_links", release_service_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into release_service_links (
                  id, release_id, service_type, url, status, provenance
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  release_id = excluded.release_id,
                  service_type = excluded.service_type,
                  url = excluded.url,
                  status = excluded.status,
                  provenance = excluded.provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["release_id"],
                        row["service_type"],
                        row["url"],
                        row["status"],
                        row["provenance"],
                    )
                    for row in release_service_rows
                ],
            )

        track_service_rows = payload["tables"]["track_service_links"]
        if track_service_rows:
            count_operations(
                "track_service_links",
                track_service_rows,
                lambda row: (str(row["track_id"]), row["service_type"]),
            )
            cursor.executemany(
                """
                insert into track_service_links (
                  id, track_id, service_type, url, status, provenance
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  track_id = excluded.track_id,
                  service_type = excluded.service_type,
                  url = excluded.url,
                  status = excluded.status,
                  provenance = excluded.provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["track_id"],
                        row["service_type"],
                        row["url"],
                        row["status"],
                        row["provenance"],
                    )
                    for row in track_service_rows
                ],
            )

        tracking_state_rows = payload["tables"]["entity_tracking_state"]
        if tracking_state_rows:
            count_operations("entity_tracking_state", tracking_state_rows, lambda row: str(row["entity_id"]))
            cursor.executemany(
                """
                insert into entity_tracking_state (
                  entity_id, tier, watch_reason, tracking_status, latest_verified_release_id
                )
                values (%s, %s, %s, %s, %s)
                on conflict (entity_id) do update set
                  tier = excluded.tier,
                  watch_reason = excluded.watch_reason,
                  tracking_status = excluded.tracking_status,
                  latest_verified_release_id = excluded.latest_verified_release_id,
                  updated_at = now()
                """,
                [
                    (
                        row["entity_id"],
                        row["tier"],
                        row["watch_reason"],
                        row["tracking_status"],
                        row["latest_verified_release_id"],
                    )
                    for row in tracking_state_rows
                ],
            )

        review_task_rows = payload["tables"]["review_tasks"]
        if review_task_rows:
            count_operations("review_tasks", review_task_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into review_tasks (
                  id, review_type, status, entity_id, release_id, upcoming_signal_id,
                  review_reason, recommended_action, payload
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  review_type = excluded.review_type,
                  status = excluded.status,
                  entity_id = excluded.entity_id,
                  release_id = excluded.release_id,
                  upcoming_signal_id = excluded.upcoming_signal_id,
                  review_reason = excluded.review_reason,
                  recommended_action = excluded.recommended_action,
                  payload = excluded.payload
                """,
                [
                    (
                        row["id"],
                        row["review_type"],
                        row["status"],
                        row["entity_id"],
                        row["release_id"],
                        row["upcoming_signal_id"],
                        row["review_reason"],
                        row["recommended_action"],
                        Jsonb(row["payload"]),
                    )
                    for row in review_task_rows
                ],
            )

        release_override_rows = payload["tables"]["release_link_overrides"]
        if release_override_rows:
            count_operations("release_link_overrides", release_override_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into release_link_overrides (
                  id, release_id, service_type, override_url, override_video_id, provenance
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  release_id = excluded.release_id,
                  service_type = excluded.service_type,
                  override_url = excluded.override_url,
                  override_video_id = excluded.override_video_id,
                  provenance = excluded.provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["release_id"],
                        row["service_type"],
                        row["override_url"],
                        row["override_video_id"],
                        row["provenance"],
                    )
                    for row in release_override_rows
                ],
            )

    connection.commit()
    summary["stale_pruned"]["upcoming_signals_deactivated_for_releases"] = deactivate_released_upcoming_signals(
        connection,
        release_rows,
    )
    summary["operation_counts"] = {table: dict(counter) for table, counter in operations.items()}


def fetch_release_pipeline_counts(connection: "psycopg.Connection[Any]") -> Dict[str, int]:
    counts: Dict[str, int] = {}
    with connection.cursor() as cursor:
        for table in canonical_import.RELEASE_PIPELINE_TABLES:
            cursor.execute(f"select count(*) from {table}")
            counts[table] = cursor.fetchone()[0]
    return counts


def fetch_release_pipeline_checks(connection: "psycopg.Connection[Any]") -> Dict[str, Any]:
    checks: Dict[str, Any] = {}
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select service_type, status, count(*)
            from release_service_links
            where service_type in ('spotify', 'youtube_music', 'youtube_mv')
            group by service_type, status
            order by service_type, status
            """
        )
        service_status_counts: Dict[str, Dict[str, int]] = {}
        for service_type, status, count in cursor.fetchall():
            service_status_counts.setdefault(service_type, {})[status] = count
        checks["release_service_status_counts"] = service_status_counts

        cursor.execute("select count(*) from tracks where is_title_track is true")
        checks["title_track_rows"] = cursor.fetchone()[0]

        cursor.execute(
            """
            select channel_role, count(*)
            from entity_youtube_channels
            group by channel_role
            order by channel_role
            """
        )
        checks["entity_channel_role_counts"] = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute(
            """
            select count(*)
            from review_tasks
            where review_type = 'mv_candidate'
              and payload->>'source_dataset' = 'mv_manual_review_queue'
            """
        )
        checks["mv_review_task_rows"] = cursor.fetchone()[0]

        cursor.execute("select count(*) from entity_tracking_state where latest_verified_release_id is not null")
        checks["tracking_state_rows_with_latest_release"] = cursor.fetchone()[0]

    return checks


def main() -> None:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(f"{args.database_url_env} is required. Source ~/.config/idol-song-app/neon.env first.")

    payload = canonical_import.build_release_pipeline_payload()
    summary = payload["summary"]

    with psycopg.connect(database_url) as connection:
        upsert_release_pipeline_rows(connection, payload, summary)
        summary["db_row_counts"] = fetch_release_pipeline_counts(connection)
        summary["critical_checks"] = fetch_release_pipeline_checks(connection)

    summary["summary_path"] = canonical_import.display_path(Path(args.summary_path))
    summary["table_source_counts"] = {table: len(rows) for table, rows in payload["tables"].items()}
    canonical_import.write_summary(Path(args.summary_path), canonical_import.sanitize_summary(summary))

    print(
        json.dumps(
            {
                "summary_path": summary["summary_path"],
                "release_rows": summary["db_row_counts"]["releases"],
                "track_rows": summary["db_row_counts"]["tracks"],
                "mv_review_task_rows": summary["critical_checks"]["mv_review_task_rows"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
