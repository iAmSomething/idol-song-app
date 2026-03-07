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


DEFAULT_SUMMARY_PATH = canonical_import.BACKEND_REPORTS_DIR / "upcoming_pipeline_db_sync_summary.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync upcoming scan / manual-review pipeline outputs into Neon canonical tables."
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable upcoming pipeline sync summary JSON.",
    )
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable name that contains the direct Neon connection string.",
    )
    return parser.parse_args()


def prune_stale_manual_review_tasks(connection: "psycopg.Connection[Any]", review_task_rows: Sequence[Dict[str, Any]]) -> int:
    desired_ids = [row["id"] for row in review_task_rows]
    with connection.cursor() as cursor:
        if desired_ids:
            placeholders = ", ".join(["%s"] * len(desired_ids))
            cursor.execute(
                f"""
                delete from review_tasks
                where payload->>'source_dataset' = 'manual_review_queue'
                  and id not in ({placeholders})
                """,
                desired_ids,
            )
        else:
            cursor.execute(
                """
                delete from review_tasks
                where payload->>'source_dataset' = 'manual_review_queue'
                """
            )
        deleted = cursor.rowcount
    connection.commit()
    return deleted


def deactivate_stale_upcoming_signals(connection: "psycopg.Connection[Any]", signal_rows: Sequence[Dict[str, Any]]) -> int:
    desired_ids = [row["id"] for row in signal_rows]
    with connection.cursor() as cursor:
        if desired_ids:
            placeholders = ", ".join(["%s"] * len(desired_ids))
            cursor.execute(
                f"""
                update upcoming_signals
                set is_active = false,
                    updated_at = now()
                where is_active = true
                  and id not in ({placeholders})
                """,
                desired_ids,
            )
        else:
            cursor.execute(
                """
                update upcoming_signals
                set is_active = false,
                    updated_at = now()
                where is_active = true
                """
            )
        updated = cursor.rowcount
    connection.commit()
    return updated


def prune_stale_upcoming_signal_sources(connection: "psycopg.Connection[Any]", source_rows: Sequence[Dict[str, Any]]) -> int:
    desired_ids = [row["id"] for row in source_rows]
    with connection.cursor() as cursor:
        if desired_ids:
            placeholders = ", ".join(["%s"] * len(desired_ids))
            cursor.execute(
                f"""
                delete from upcoming_signal_sources
                where id not in ({placeholders})
                """,
                desired_ids,
            )
        else:
            cursor.execute("delete from upcoming_signal_sources")
        deleted = cursor.rowcount
    connection.commit()
    return deleted


def upsert_upcoming_pipeline_rows(
    connection: "psycopg.Connection[Any]",
    payload: Dict[str, Any],
    summary: Dict[str, Any],
) -> None:
    existing = canonical_import.fetch_existing_state(connection)
    operations = {table: Counter() for table in canonical_import.UPCOMING_PIPELINE_TABLES}
    summary["stale_pruned"] = {
        "review_tasks": prune_stale_manual_review_tasks(connection, payload["tables"]["review_tasks"]),
        "upcoming_signals_deactivated": deactivate_stale_upcoming_signals(connection, payload["tables"]["upcoming_signals"]),
        "upcoming_signal_sources_deleted": prune_stale_upcoming_signal_sources(connection, payload["tables"]["upcoming_signal_sources"]),
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
                  representative_image_url, representative_image_source
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  slug = excluded.slug,
                  canonical_name = excluded.canonical_name,
                  display_name = excluded.display_name,
                  entity_type = excluded.entity_type,
                  agency_name = excluded.agency_name,
                  debut_year = excluded.debut_year,
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
                        row["representative_image_url"],
                        row["representative_image_source"],
                    )
                    for row in entity_rows
                ],
            )

        alias_rows = payload["tables"]["entity_aliases"]
        if alias_rows:
            count_operations("entity_aliases", alias_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into entity_aliases (
                  id, entity_id, alias, alias_type, normalized_alias, is_primary
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  entity_id = excluded.entity_id,
                  alias = excluded.alias,
                  alias_type = excluded.alias_type,
                  normalized_alias = excluded.normalized_alias,
                  is_primary = excluded.is_primary
                """,
                [
                    (
                        row["id"],
                        row["entity_id"],
                        row["alias"],
                        row["alias_type"],
                        row["normalized_alias"],
                        row["is_primary"],
                    )
                    for row in alias_rows
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

        upcoming_signal_rows = payload["tables"]["upcoming_signals"]
        if upcoming_signal_rows:
            count_operations("upcoming_signals", upcoming_signal_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into upcoming_signals (
                  id, entity_id, headline, normalized_headline, scheduled_date, scheduled_month, date_precision,
                  date_status, release_format, confidence_score, tracking_status,
                  first_seen_at, latest_seen_at, is_active, dedupe_key
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  entity_id = excluded.entity_id,
                  headline = excluded.headline,
                  normalized_headline = excluded.normalized_headline,
                  scheduled_date = excluded.scheduled_date,
                  scheduled_month = excluded.scheduled_month,
                  date_precision = excluded.date_precision,
                  date_status = excluded.date_status,
                  release_format = excluded.release_format,
                  confidence_score = excluded.confidence_score,
                  tracking_status = excluded.tracking_status,
                  first_seen_at = excluded.first_seen_at,
                  latest_seen_at = excluded.latest_seen_at,
                  is_active = excluded.is_active,
                  dedupe_key = excluded.dedupe_key,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["entity_id"],
                        row["headline"],
                        row["normalized_headline"],
                        row["scheduled_date"],
                        row["scheduled_month"],
                        row["date_precision"],
                        row["date_status"],
                        row["release_format"],
                        row["confidence_score"],
                        row["tracking_status"],
                        row["first_seen_at"],
                        row["latest_seen_at"],
                        row["is_active"],
                        row["dedupe_key"],
                    )
                    for row in upcoming_signal_rows
                ],
            )

        upcoming_source_rows = payload["tables"]["upcoming_signal_sources"]
        if upcoming_source_rows:
            count_operations("upcoming_signal_sources", upcoming_source_rows, lambda row: str(row["id"]))
            cursor.executemany(
                """
                insert into upcoming_signal_sources (
                  id, upcoming_signal_id, source_type, source_url, source_domain, published_at, search_term, evidence_summary
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  upcoming_signal_id = excluded.upcoming_signal_id,
                  source_type = excluded.source_type,
                  source_url = excluded.source_url,
                  source_domain = excluded.source_domain,
                  published_at = excluded.published_at,
                  search_term = excluded.search_term,
                  evidence_summary = excluded.evidence_summary
                """,
                [
                    (
                        row["id"],
                        row["upcoming_signal_id"],
                        row["source_type"],
                        row["source_url"],
                        row["source_domain"],
                        row["published_at"],
                        row["search_term"],
                        row["evidence_summary"],
                    )
                    for row in upcoming_source_rows
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

    connection.commit()
    summary["operation_counts"] = {table: dict(counter) for table, counter in operations.items()}


def fetch_upcoming_db_counts(connection: "psycopg.Connection[Any]") -> Dict[str, int]:
    counts: Dict[str, int] = {}
    with connection.cursor() as cursor:
        for table in ("upcoming_signals", "upcoming_signal_sources", "entity_tracking_state", "review_tasks"):
            cursor.execute(f"select count(*) from {table}")
            counts[table] = cursor.fetchone()[0]
    return counts


def fetch_upcoming_critical_checks(connection: "psycopg.Connection[Any]") -> Dict[str, Any]:
    critical: Dict[str, Any] = {}
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select date_precision, count(*)
            from upcoming_signals
            where is_active = true
            group by date_precision
            order by date_precision
            """
        )
        critical["active_upcoming_by_precision"] = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute(
            """
            select review_type, count(*)
            from review_tasks
            where payload->>'source_dataset' = 'manual_review_queue'
            group by review_type
            order by review_type
            """
        )
        critical["manual_review_task_types"] = {row[0]: row[1] for row in cursor.fetchall()}
    return critical


def sanitize_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = dict(summary)
    sanitized["source_duplicates"] = dict(summary["source_duplicates"])
    sanitized["dropped_records"] = dict(summary["dropped_records"])
    sanitized["unresolved_release_mappings"] = summary["unresolved_release_mappings"][:25]
    sanitized["unresolved_review_links"] = summary["unresolved_review_links"][:25]
    return sanitized


def main() -> None:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(f"{args.database_url_env} is required. Source ~/.config/idol-song-app/neon.env first.")

    payload = canonical_import.build_upcoming_pipeline_payload()
    summary = payload["summary"]

    with psycopg.connect(database_url) as connection:
        upsert_upcoming_pipeline_rows(connection, payload, summary)
        summary["db_row_counts"] = fetch_upcoming_db_counts(connection)
        summary["critical_checks"] = fetch_upcoming_critical_checks(connection)

    summary["summary_path"] = canonical_import.display_path(Path(args.summary_path))
    summary["table_source_counts"] = {table: len(rows) for table, rows in payload["tables"].items()}
    canonical_import.write_summary(Path(args.summary_path), sanitize_summary(summary))

    print(
        json.dumps(
            {
                "summary_path": summary["summary_path"],
                "upcoming_signal_rows": summary["db_row_counts"]["upcoming_signals"],
                "upcoming_signal_source_rows": summary["db_row_counts"]["upcoming_signal_sources"],
                "manual_review_task_rows": summary["critical_checks"]["manual_review_task_types"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
