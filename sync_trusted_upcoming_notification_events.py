import argparse
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError as error:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "psycopg is required. Run `python3 -m pip install -r backend/requirements-import.txt` first."
    ) from error

import import_json_to_neon as canonical_import
import trusted_upcoming_notification_events as notification_events


DEFAULT_SUMMARY_PATH = canonical_import.BACKEND_REPORTS_DIR / "trusted_upcoming_notification_event_summary.json"
DEFAULT_MARKDOWN_PATH = canonical_import.BACKEND_REPORTS_DIR / "trusted_upcoming_operator_alert_report.md"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Emit canonical trusted upcoming notification events and operator alert artifacts."
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable notification event summary JSON.",
    )
    parser.add_argument(
        "--markdown-path",
        default=str(DEFAULT_MARKDOWN_PATH),
        help="Path to write the operator alert markdown summary.",
    )
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable that contains the direct Neon connection string.",
    )
    return parser.parse_args()


def fetch_active_upcoming_signals(connection: "psycopg.Connection[Any]") -> List[Dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              us.id::text as upcoming_signal_id,
              us.entity_id::text as entity_id,
              e.slug as entity_slug,
              e.display_name as entity_name,
              us.headline,
              us.scheduled_date::text as scheduled_date,
              to_char(us.scheduled_month, 'YYYY-MM') as scheduled_month,
              us.date_precision,
              us.date_status,
              us.release_format,
              us.confidence_score::float8 as confidence_score,
              us.tracking_status,
              us.first_seen_at,
              us.latest_seen_at,
              uss.source_type,
              uss.source_url,
              uss.source_domain,
              uss.published_at,
              uss.evidence_summary
            from upcoming_signals us
            join entities e on e.id = us.entity_id
            left join upcoming_signal_sources uss on uss.upcoming_signal_id = us.id
            where us.is_active = true
            order by e.display_name asc, us.headline asc, uss.published_at desc nulls last, uss.source_url asc nulls last
            """
        )
        rows = cursor.fetchall()

    grouped: Dict[str, Dict[str, Any]] = {}
    sources_by_signal: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        signal_id = row[0]
        grouped.setdefault(
            signal_id,
            {
                "upcoming_signal_id": signal_id,
                "entity_id": row[1],
                "entity_slug": row[2],
                "entity_name": row[3],
                "headline": row[4],
                "scheduled_date": row[5],
                "scheduled_month": row[6],
                "date_precision": row[7],
                "date_status": row[8],
                "release_format": row[9],
                "confidence_score": row[10],
                "tracking_status": row[11],
                "first_seen_at": row[12].isoformat().replace("+00:00", "Z") if row[12] is not None else None,
                "latest_seen_at": row[13].isoformat().replace("+00:00", "Z") if row[13] is not None else None,
            },
        )
        if row[14] is not None and row[15] is not None:
            sources_by_signal[signal_id].append(
                {
                    "source_type": row[14],
                    "source_url": row[15],
                    "source_domain": row[16],
                    "published_at": row[17].isoformat().replace("+00:00", "Z") if row[17] is not None else None,
                    "evidence_summary": row[18],
                }
            )

    signal_rows: List[Dict[str, Any]] = []
    for signal_id, signal_row in grouped.items():
        primary_source = notification_events.pick_primary_source(sources_by_signal.get(signal_id, []))
        signal_rows.append(notification_events.build_state_snapshot(signal_row, primary_source))
    return signal_rows


def fetch_existing_states(connection: "psycopg.Connection[Any]") -> Dict[str, Dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              fingerprint_key,
              entity_id::text,
              upcoming_signal_id::text,
              canonical_source_url,
              canonical_source_domain,
              scheduled_bucket,
              latest_date_status,
              latest_date_precision,
              latest_confidence_score::float8,
              latest_confidence_band,
              latest_source_type,
              latest_source_tier,
              is_active,
              is_trusted,
              last_seen_at,
              last_emitted_dedupe_key,
              last_emitted_reason,
              last_emitted_reason_value,
              last_emitted_at,
              cooldown_until,
              payload
            from notification_signal_states
            where event_type = %s
            """,
            (notification_events.EVENT_TYPE,),
        )
        rows = cursor.fetchall()

    states: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        states[row[0]] = {
            "fingerprint_key": row[0],
            "entity_id": row[1],
            "upcoming_signal_id": row[2],
            "canonical_source_url": row[3],
            "canonical_source_domain": row[4],
            "scheduled_bucket": row[5],
            "latest_date_status": row[6],
            "latest_date_precision": row[7],
            "latest_confidence_score": row[8],
            "latest_confidence_band": row[9],
            "latest_source_type": row[10],
            "latest_source_tier": row[11],
            "is_active": row[12],
            "is_trusted": row[13],
            "last_seen_at": row[14],
            "last_emitted_dedupe_key": row[15],
            "last_emitted_reason": row[16],
            "last_emitted_reason_value": row[17],
            "last_emitted_at": row[18],
            "cooldown_until": row[19],
            "payload": row[20],
        }
    return states


def deactivate_stale_states(connection: "psycopg.Connection[Any]", active_fingerprints: List[str]) -> int:
    with connection.cursor() as cursor:
        if active_fingerprints:
            placeholders = ", ".join(["%s"] * len(active_fingerprints))
            cursor.execute(
                f"""
                update notification_signal_states
                set is_active = false,
                    updated_at = now()
                where event_type = %s
                  and is_active = true
                  and fingerprint_key not in ({placeholders})
                """,
                [notification_events.EVENT_TYPE, *active_fingerprints],
            )
        else:
            cursor.execute(
                """
                update notification_signal_states
                set is_active = false,
                    updated_at = now()
                where event_type = %s
                  and is_active = true
                """,
                (notification_events.EVENT_TYPE,),
            )
        updated = cursor.rowcount
    connection.commit()
    return updated


def upsert_events_and_states(
    connection: "psycopg.Connection[Any]",
    snapshots: List[Dict[str, Any]],
    existing_states: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    now = canonical_import.datetime.now(canonical_import.timezone.utc)
    evaluations: List[Dict[str, Any]] = []
    state_rows: List[Dict[str, Any]] = []
    event_rows: List[Dict[str, Any]] = []

    for snapshot in snapshots:
        previous_state = existing_states.get(snapshot["fingerprint_key"])
        candidates = notification_events.build_upgrade_candidates(previous_state, snapshot)
        emitted_event: Optional[Dict[str, Any]] = None
        suppression_reason = "unchanged"

        if not snapshot["is_trusted"]:
            suppression_reason = "untrusted"
        elif candidates:
            emitted_event = notification_events.build_event_payload(snapshot, previous_state, candidates[0], now)
            emitted_event["id"] = canonical_import.stable_uuid(
                "notification-event",
                emitted_event["dedupe_key"],
            )
            event_rows.append(emitted_event)

        state_rows.append(notification_events.build_updated_state(snapshot, previous_state, emitted_event, now))
        evaluations.append(
            {
                "snapshot": snapshot,
                "event": emitted_event,
                "suppression_reason": None if emitted_event is not None else suppression_reason,
            }
        )

    with connection.pipeline(), connection.cursor() as cursor:
        if state_rows:
            cursor.executemany(
                """
                insert into notification_signal_states (
                  fingerprint_key, event_type, entity_id, upcoming_signal_id,
                  canonical_source_url, canonical_source_domain, scheduled_bucket,
                  latest_date_status, latest_date_precision, latest_confidence_score,
                  latest_confidence_band, latest_source_type, latest_source_tier,
                  is_active, is_trusted, last_seen_at, last_emitted_dedupe_key,
                  last_emitted_reason, last_emitted_reason_value, last_emitted_at,
                  cooldown_until, payload
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                on conflict (fingerprint_key) do update set
                  event_type = excluded.event_type,
                  entity_id = excluded.entity_id,
                  upcoming_signal_id = excluded.upcoming_signal_id,
                  canonical_source_url = excluded.canonical_source_url,
                  canonical_source_domain = excluded.canonical_source_domain,
                  scheduled_bucket = excluded.scheduled_bucket,
                  latest_date_status = excluded.latest_date_status,
                  latest_date_precision = excluded.latest_date_precision,
                  latest_confidence_score = excluded.latest_confidence_score,
                  latest_confidence_band = excluded.latest_confidence_band,
                  latest_source_type = excluded.latest_source_type,
                  latest_source_tier = excluded.latest_source_tier,
                  is_active = excluded.is_active,
                  is_trusted = excluded.is_trusted,
                  last_seen_at = excluded.last_seen_at,
                  last_emitted_dedupe_key = excluded.last_emitted_dedupe_key,
                  last_emitted_reason = excluded.last_emitted_reason,
                  last_emitted_reason_value = excluded.last_emitted_reason_value,
                  last_emitted_at = excluded.last_emitted_at,
                  cooldown_until = excluded.cooldown_until,
                  payload = excluded.payload,
                  updated_at = now()
                """,
                [
                    (
                        row["fingerprint_key"],
                        notification_events.EVENT_TYPE,
                        row["entity_id"],
                        row["upcoming_signal_id"],
                        row["canonical_source_url"],
                        row["canonical_source_domain"],
                        row["scheduled_bucket"],
                        row["latest_date_status"],
                        row["latest_date_precision"],
                        row["latest_confidence_score"],
                        row["latest_confidence_band"],
                        row["latest_source_type"],
                        row["latest_source_tier"],
                        row["is_active"],
                        row["is_trusted"],
                        row["last_seen_at"],
                        row["last_emitted_dedupe_key"],
                        row["last_emitted_reason"],
                        row["last_emitted_reason_value"],
                        row["last_emitted_at"],
                        row["cooldown_until"],
                        Jsonb(notification_events.serialize_state_payload(row["payload"] if isinstance(row["payload"], dict) else row)),
                    )
                    for row in state_rows
                ],
            )

        if event_rows:
            cursor.executemany(
                """
                insert into notification_events (
                  id, event_type, event_reason, event_reason_value, status,
                  entity_id, upcoming_signal_id, fingerprint_key, dedupe_key, cooldown_key,
                  cooldown_until, secondary_reasons, canonical_destination, payload, emitted_at
                )
                values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                on conflict (dedupe_key) do nothing
                """,
                [
                    (
                        row["id"],
                        notification_events.EVENT_TYPE,
                        row["event_reason"],
                        row["event_reason_value"],
                        row["status"],
                        row["entity_id"],
                        row["upcoming_signal_id"],
                        row["fingerprint_key"],
                        row["dedupe_key"],
                        row["cooldown_key"],
                        row["cooldown_until"],
                        row["secondary_reasons"],
                        Jsonb(row["canonical_destination"]),
                        Jsonb(notification_events.serialize_event_payload(row["payload"])),
                    )
                    for row in event_rows
                ],
            )

    connection.commit()
    return {
        "evaluations": evaluations,
        "event_rows": event_rows,
        "state_rows": state_rows,
        "generated_at": now,
    }


def fetch_db_counts(connection: "psycopg.Connection[Any]") -> Dict[str, int]:
    with connection.cursor() as cursor:
        cursor.execute("select count(*) from notification_signal_states")
        state_count = cursor.fetchone()[0]
        cursor.execute("select count(*) from notification_events")
        event_count = cursor.fetchone()[0]
    return {
        "notification_signal_states": state_count,
        "notification_events": event_count,
    }


def write_summary_files(summary_path: Path, markdown_path: Path, report: Dict[str, Any]) -> None:
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(notification_events.render_operator_alert_markdown(report), encoding="utf-8")


def append_workflow_summary(report: Dict[str, Any]) -> None:
    summary_target = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_target:
        return
    path = Path(summary_target)
    with path.open("a", encoding="utf-8") as handle:
        handle.write("### Trusted Upcoming Operator Alerts\n")
        for line in report["summary_lines"]:
            handle.write(f"- {line}\n")
        if report["emitted_events"]:
            handle.write("- emitted samples:\n")
            for event in report["emitted_events"][:5]:
                handle.write(
                    f"  - {event['entity']} | {event['reason']}:{event['reason_value']} | {event['headline']}\n"
                )


def main() -> None:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(f"{args.database_url_env} is required. Source ~/.config/idol-song-app/neon.env first.")

    summary_path = Path(args.summary_path)
    markdown_path = Path(args.markdown_path)

    with psycopg.connect(database_url) as connection:
        before_counts = fetch_db_counts(connection)
        snapshots = fetch_active_upcoming_signals(connection)
        existing_states = fetch_existing_states(connection)
        summary = upsert_events_and_states(connection, snapshots, existing_states)
        stale_count = deactivate_stale_states(connection, [snapshot["fingerprint_key"] for snapshot in snapshots])
        db_counts = fetch_db_counts(connection)

    report = notification_events.build_operator_alert_report(
        summary["evaluations"],
        generated_at=summary["generated_at"],
        summary_path=canonical_import.display_path(summary_path),
    )
    report["db_row_counts"] = db_counts
    report["stale_states_deactivated"] = stale_count
    report["inserted_events"] = db_counts["notification_events"] - before_counts["notification_events"]
    report["markdown_path"] = canonical_import.display_path(markdown_path)

    write_summary_files(summary_path, markdown_path, report)
    append_workflow_summary(report)

    print(
        json.dumps(
            {
                "summary_path": canonical_import.display_path(summary_path),
                "markdown_path": canonical_import.display_path(markdown_path),
                "notification_event_rows": db_counts["notification_events"],
                "notification_state_rows": db_counts["notification_signal_states"],
                "inserted_events": report["inserted_events"],
                "emitted_by_reason": report["totals"]["emitted_by_reason"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
