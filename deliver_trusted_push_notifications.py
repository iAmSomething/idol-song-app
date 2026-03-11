import argparse
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError as error:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "psycopg is required. Run `python3 -m pip install -r backend/requirements-import.txt` first."
    ) from error

import import_json_to_neon as canonical_import


DEFAULT_PROVIDER_URL = "https://exp.host/--/api/v2/push/send"
DEFAULT_SUMMARY_PATH = canonical_import.BACKEND_REPORTS_DIR / "mobile_push_delivery_summary.json"
DEFAULT_MARKDOWN_PATH = canonical_import.BACKEND_REPORTS_DIR / "mobile_push_delivery_report.md"
MAX_ATTEMPTS = 2
RETRYABLE_FAILURE_CODES = {"http_429", "http_500", "http_502", "http_503", "http_504", "network_error", "timeout"}
INVALID_TOKEN_CODES = {"DeviceNotRegistered"}
TRUSTED_EVENT_TYPE = "trusted_upcoming_signal"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deliver trusted upcoming notification events to registered mobile devices.")
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable that contains the direct Neon connection string.",
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable mobile push delivery summary JSON.",
    )
    parser.add_argument(
        "--markdown-path",
        default=str(DEFAULT_MARKDOWN_PATH),
        help="Path to write the human-readable mobile push delivery report.",
    )
    parser.add_argument(
        "--provider-url",
        default=DEFAULT_PROVIDER_URL,
        help="Expo push provider endpoint.",
    )
    return parser.parse_args()


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def isoformat(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def build_date_label(payload: Dict[str, Any]) -> str:
    scheduled_date = optional_text(payload.get("scheduled_date"))
    if scheduled_date:
        return scheduled_date
    scheduled_month = optional_text(payload.get("scheduled_month"))
    if scheduled_month:
        return f"{scheduled_month} · 날짜 미정"
    return "날짜 미정"


def build_push_copy(event_row: Dict[str, Any]) -> Tuple[str, str]:
    payload = event_row["payload"]
    entity_name = optional_text(payload.get("entity", {}).get("name")) or "새 일정"
    headline = optional_text(payload.get("headline")) or "신뢰도 높은 일정 신호가 업데이트됐습니다."
    reason = optional_text(payload.get("reason")) or "new_signal"
    date_label = build_date_label(payload)

    if reason == "date_status_upgrade":
        title = f"{entity_name} 일정 상태 업데이트"
    elif reason == "date_precision_gain":
        title = f"{entity_name} 날짜 정보가 더 구체화됐습니다"
    elif reason == "confidence_threshold_crossed":
        title = f"{entity_name} 신뢰도 높은 일정 신호"
    elif reason == "source_tier_upgrade":
        title = f"{entity_name} 공식성 높은 새 근거"
    else:
        title = f"{entity_name} 새 일정 신호"

    body = f"{headline} · {date_label}"
    return title, body


def build_push_message(event_row: Dict[str, Any], registration_row: Dict[str, Any]) -> Dict[str, Any]:
    payload = event_row["payload"]
    title, body = build_push_copy(event_row)

    return {
        "to": registration_row["expo_push_token"],
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": "trusted-upcoming",
        "data": {
            "notification_event_id": event_row["id"],
            "event_type": event_row["event_type"],
            "event_reason": event_row["event_reason"],
            "event_reason_value": event_row["event_reason_value"],
            "destination": event_row["canonical_destination"],
            "entity_slug": payload.get("entity", {}).get("slug"),
            "entity_name": payload.get("entity", {}).get("name"),
            "headline": payload.get("headline"),
            "scheduled_date": payload.get("scheduled_date"),
            "scheduled_month": payload.get("scheduled_month"),
            "date_precision": payload.get("date_precision"),
            "date_status": payload.get("date_status"),
            "release_format": payload.get("release_format"),
            "source_url": payload.get("source", {}).get("url"),
            "source_type": payload.get("source", {}).get("type"),
        },
    }


def classify_registration_skip_reason(registration_row: Dict[str, Any]) -> Optional[str]:
    if not bool(registration_row["alerts_enabled"]):
        return "alerts_disabled"

    permission_status = optional_text(registration_row["permission_status"]) or "not_determined"
    if permission_status == "denied":
        return "permission_denied"
    if permission_status == "not_determined":
        return "permission_not_determined"

    if not optional_text(registration_row.get("expo_push_token")):
        return optional_text(registration_row.get("disabled_reason")) or "token_missing"

    if not bool(registration_row["is_active"]):
        return optional_text(registration_row.get("disabled_reason")) or "inactive_registration"

    return None


def is_retryable_failure_code(code: Optional[str]) -> bool:
    if code is None:
        return False
    return code in RETRYABLE_FAILURE_CODES


def send_expo_push_message(provider_url: str, message: Dict[str, Any]) -> Dict[str, Any]:
    try:
        response = requests.post(
            provider_url,
            headers={"content-type": "application/json", "accept": "application/json"},
            json=message,
            timeout=10,
        )
    except requests.Timeout:
        return {
            "status": "failed",
            "failure_code": "timeout",
            "response_payload": {"error": "timeout"},
            "provider_message_id": None,
        }
    except requests.RequestException as error:
        return {
            "status": "failed",
            "failure_code": "network_error",
            "response_payload": {"error": str(error)},
            "provider_message_id": None,
        }

    try:
        payload = response.json()
    except ValueError:
        payload = {"raw_text": response.text}

    if response.status_code >= 400:
        return {
            "status": "failed",
            "failure_code": f"http_{response.status_code}",
            "response_payload": payload,
            "provider_message_id": None,
        }

    data = payload.get("data")
    if isinstance(data, list):
        data = data[0] if data else {}
    if not isinstance(data, dict):
        data = {}

    if data.get("status") == "ok":
        return {
            "status": "sent",
            "failure_code": None,
            "response_payload": payload,
            "provider_message_id": optional_text(data.get("id")),
        }

    details = data.get("details") if isinstance(data.get("details"), dict) else {}
    failure_code = optional_text(details.get("error")) or optional_text(data.get("message")) or "provider_error"
    return {
        "status": "failed",
        "failure_code": failure_code,
        "response_payload": payload,
        "provider_message_id": None,
    }


def fetch_queued_notification_events(connection: "psycopg.Connection[Any]") -> List[Dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              id::text as id,
              event_type,
              event_reason,
              event_reason_value,
              status,
              entity_id::text as entity_id,
              upcoming_signal_id::text as upcoming_signal_id,
              canonical_destination,
              payload,
              emitted_at
            from notification_events
            where event_type = %s
              and status = 'queued'
            order by emitted_at asc, created_at asc
            """,
            (TRUSTED_EVENT_TYPE,),
        )
        rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "event_type": row[1],
            "event_reason": row[2],
            "event_reason_value": row[3],
            "status": row[4],
            "entity_id": row[5],
            "upcoming_signal_id": row[6],
            "canonical_destination": row[7],
            "payload": row[8],
            "emitted_at": isoformat(row[9]),
        }
        for row in rows
    ]


def fetch_registrations(connection: "psycopg.Connection[Any]") -> List[Dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              id::text as id,
              installation_id,
              platform,
              build_profile,
              expo_push_token,
              alerts_enabled,
              permission_status,
              is_active,
              disabled_reason,
              last_seen_at,
              metadata
            from mobile_push_registrations
            order by created_at asc
            """
        )
        rows = cursor.fetchall()

    return [
        {
            "id": row[0],
            "installation_id": row[1],
            "platform": row[2],
            "build_profile": row[3],
            "expo_push_token": row[4],
            "alerts_enabled": row[5],
            "permission_status": row[6],
            "is_active": row[7],
            "disabled_reason": row[8],
            "last_seen_at": isoformat(row[9]),
            "metadata": row[10] or {},
        }
        for row in rows
    ]


def fetch_existing_delivery_rows(
    connection: "psycopg.Connection[Any]",
    event_ids: List[str],
) -> Dict[Tuple[str, str], Dict[str, Any]]:
    if not event_ids:
        return {}

    with connection.cursor() as cursor:
        cursor.execute(
            """
            select
              notification_event_id::text,
              registration_id::text,
              status,
              provider_message_id,
              skip_reason,
              failure_code,
              attempt_count
            from notification_event_push_deliveries
            where notification_event_id = any(%s::uuid[])
            """,
            (event_ids,),
        )
        rows = cursor.fetchall()

    deliveries: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for row in rows:
        deliveries[(row[0], row[1])] = {
            "notification_event_id": row[0],
            "registration_id": row[1],
            "status": row[2],
            "provider_message_id": row[3],
            "skip_reason": row[4],
            "failure_code": row[5],
            "attempt_count": row[6],
        }
    return deliveries


def insert_delivery_row(
    connection: "psycopg.Connection[Any]",
    *,
    event_id: str,
    registration_id: str,
    status: str,
    payload: Dict[str, Any],
    provider_message_id: Optional[str] = None,
    skip_reason: Optional[str] = None,
    failure_code: Optional[str] = None,
    response_payload: Optional[Dict[str, Any]] = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            insert into notification_event_push_deliveries (
              notification_event_id,
              registration_id,
              provider,
              status,
              provider_message_id,
              skip_reason,
              failure_code,
              payload,
              response_payload,
              sent_at
            )
            values (%s, %s, 'expo', %s, %s, %s, %s, %s::jsonb, %s::jsonb, case when %s = 'sent' then now() else null end)
            """,
            (
                event_id,
                registration_id,
                status,
                provider_message_id,
                skip_reason,
                failure_code,
                Jsonb(payload),
                Jsonb(response_payload) if response_payload is not None else None,
                status,
            ),
        )


def update_failed_delivery_row(
    connection: "psycopg.Connection[Any]",
    *,
    event_id: str,
    registration_id: str,
    status: str,
    provider_message_id: Optional[str],
    skip_reason: Optional[str],
    failure_code: Optional[str],
    response_payload: Optional[Dict[str, Any]],
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update notification_event_push_deliveries
            set
              status = %s,
              provider_message_id = %s,
              skip_reason = %s,
              failure_code = %s,
              response_payload = %s::jsonb,
              sent_at = case when %s = 'sent' then now() else sent_at end,
              attempt_count = attempt_count + 1,
              updated_at = now()
            where notification_event_id = %s
              and registration_id = %s
            """,
            (
                status,
                provider_message_id,
                skip_reason,
                failure_code,
                Jsonb(response_payload) if response_payload is not None else None,
                status,
                event_id,
                registration_id,
            ),
        )


def mark_registration_invalid(connection: "psycopg.Connection[Any]", registration_id: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            update mobile_push_registrations
            set
              is_active = false,
              disabled_reason = 'provider_invalid',
              disabled_at = now(),
              updated_at = now()
            where id = %s::uuid
            """,
            (registration_id,),
        )


def update_notification_event_status(
    connection: "psycopg.Connection[Any]",
    event_id: str,
    delivery_statuses: List[str],
) -> str:
    if any(status == "sent" for status in delivery_statuses):
        next_status = "sent"
    elif any(status == "failed" for status in delivery_statuses):
        next_status = "failed"
    else:
        next_status = "skipped"

    with connection.cursor() as cursor:
        cursor.execute(
            """
            update notification_events
            set status = %s
            where id = %s::uuid
            """,
            (next_status, event_id),
        )

    return next_status


def render_markdown_report(summary: Dict[str, Any]) -> str:
    lines = [
        "# Mobile Push Delivery Report",
        "",
        f"- generated_at: `{summary['generated_at']}`",
        f"- queued_events: `{summary['queued_events']}`",
        f"- registrations_considered: `{summary['registrations_considered']}`",
        f"- events_sent: `{summary['event_status_counts'].get('sent', 0)}`",
        f"- events_failed: `{summary['event_status_counts'].get('failed', 0)}`",
        f"- events_skipped: `{summary['event_status_counts'].get('skipped', 0)}`",
        f"- deliveries_sent: `{summary['delivery_status_counts'].get('sent', 0)}`",
        f"- deliveries_failed: `{summary['delivery_status_counts'].get('failed', 0)}`",
        f"- deliveries_skipped: `{summary['delivery_status_counts'].get('skipped', 0)}`",
        f"- invalidated_registrations: `{summary['invalidated_registrations']}`",
        "",
        "## Event Samples",
        "",
    ]

    samples = summary.get("events", [])[:10]
    if not samples:
        lines.append("- no queued trusted upcoming events")
    else:
        for sample in samples:
            lines.append(
                f"- `{sample['event_id']}` · `{sample['event_status']}` · `{sample['entity_name']}` · "
                f"`{sample['delivery_counts'].get('sent', 0)} sent / {sample['delivery_counts'].get('failed', 0)} failed / {sample['delivery_counts'].get('skipped', 0)} skipped`"
            )

    return "\n".join(lines) + "\n"


def main() -> None:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(f"{args.database_url_env} is required.")

    summary_path = Path(args.summary_path)
    markdown_path = Path(args.markdown_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.parent.mkdir(parents=True, exist_ok=True)

    generated_at = now_utc()
    summary: Dict[str, Any] = {
        "generated_at": isoformat(generated_at),
        "queued_events": 0,
        "registrations_considered": 0,
        "delivery_status_counts": {"sent": 0, "failed": 0, "skipped": 0},
        "event_status_counts": {"sent": 0, "failed": 0, "skipped": 0},
        "suppressed_existing_deliveries": 0,
        "invalidated_registrations": 0,
        "events": [],
    }

    with psycopg.connect(database_url) as connection:
        connection.autocommit = False
        queued_events = fetch_queued_notification_events(connection)
        registrations = fetch_registrations(connection)
        existing_deliveries = fetch_existing_delivery_rows(connection, [event["id"] for event in queued_events])

        summary["queued_events"] = len(queued_events)
        summary["registrations_considered"] = len(registrations)

        for event_row in queued_events:
            delivery_counts = Counter()
            entity_name = optional_text(event_row["payload"].get("entity", {}).get("name")) or "unknown"
            event_sample = {
                "event_id": event_row["id"],
                "entity_name": entity_name,
                "event_reason": event_row["event_reason"],
                "event_status": "queued",
                "delivery_counts": {},
            }

            per_event_statuses: List[str] = []
            for registration_row in registrations:
                delivery_key = (event_row["id"], registration_row["id"])
                existing_delivery = existing_deliveries.get(delivery_key)

                if existing_delivery and existing_delivery["status"] in {"sent", "skipped"}:
                    summary["suppressed_existing_deliveries"] += 1
                    per_event_statuses.append(existing_delivery["status"])
                    delivery_counts[existing_delivery["status"]] += 1
                    continue

                skip_reason = classify_registration_skip_reason(registration_row)
                payload = build_push_message(event_row, registration_row)

                if skip_reason is not None:
                    if existing_delivery and existing_delivery["status"] == "failed":
                        update_failed_delivery_row(
                            connection,
                            event_id=event_row["id"],
                            registration_id=registration_row["id"],
                            status="skipped",
                            provider_message_id=None,
                            skip_reason=skip_reason,
                            failure_code=None,
                            response_payload={"skip_reason": skip_reason},
                        )
                    elif existing_delivery is None:
                        insert_delivery_row(
                            connection,
                            event_id=event_row["id"],
                            registration_id=registration_row["id"],
                            status="skipped",
                            payload=payload,
                            skip_reason=skip_reason,
                            response_payload={"skip_reason": skip_reason},
                        )

                    per_event_statuses.append("skipped")
                    delivery_counts["skipped"] += 1
                    continue

                if existing_delivery and existing_delivery["status"] == "failed":
                    if existing_delivery["attempt_count"] >= MAX_ATTEMPTS or not is_retryable_failure_code(existing_delivery.get("failure_code")):
                        per_event_statuses.append("failed")
                        delivery_counts["failed"] += 1
                        continue

                provider_result = send_expo_push_message(args.provider_url, payload)
                if existing_delivery and existing_delivery["status"] == "failed":
                    update_failed_delivery_row(
                        connection,
                        event_id=event_row["id"],
                        registration_id=registration_row["id"],
                        status=provider_result["status"],
                        provider_message_id=provider_result.get("provider_message_id"),
                        skip_reason=None,
                        failure_code=provider_result.get("failure_code"),
                        response_payload=provider_result.get("response_payload"),
                    )
                else:
                    insert_delivery_row(
                        connection,
                        event_id=event_row["id"],
                        registration_id=registration_row["id"],
                        status=provider_result["status"],
                        payload=payload,
                        provider_message_id=provider_result.get("provider_message_id"),
                        failure_code=provider_result.get("failure_code"),
                        response_payload=provider_result.get("response_payload"),
                    )

                if provider_result["status"] == "failed" and provider_result.get("failure_code") in INVALID_TOKEN_CODES:
                    mark_registration_invalid(connection, registration_row["id"])
                    summary["invalidated_registrations"] += 1

                per_event_statuses.append(provider_result["status"])
                delivery_counts[provider_result["status"]] += 1

            if not per_event_statuses:
                per_event_statuses.append("skipped")

            event_status = update_notification_event_status(connection, event_row["id"], per_event_statuses)
            summary["event_status_counts"][event_status] = summary["event_status_counts"].get(event_status, 0) + 1

            for status_name in ("sent", "failed", "skipped"):
                summary["delivery_status_counts"][status_name] = (
                    summary["delivery_status_counts"].get(status_name, 0) + delivery_counts.get(status_name, 0)
                )

            event_sample["event_status"] = event_status
            event_sample["delivery_counts"] = dict(delivery_counts)
            summary["events"].append(event_sample)

        connection.commit()

    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(render_markdown_report(summary), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
