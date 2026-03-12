#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

import non_runtime_dataset_paths


ROOT = Path(__file__).resolve().parent
KST = ZoneInfo("Asia/Seoul")
DEFAULT_SUMMARY_PATH = ROOT / "backend" / "reports" / "release_day_verification_targets.json"
DEFAULT_GROUPS_PATH = ROOT / "backend" / "reports" / "release_day_verification_groups.txt"
UPCOMING_PATH = non_runtime_dataset_paths.primary_path("upcomingCandidates.json")
DEFAULT_RELEASE_TIME = time(hour=12, minute=0)
WINDOW_END_TIME = time(hour=23, minute=59, second=59)

ENGLISH_MERIDIEM_PATTERN = re.compile(
    r"\b(?P<hour>1[0-2]|0?\d)(?::(?P<minute>[0-5]\d))?\s*(?P<period>a\.?m\.?|p\.?m\.?)\b",
    re.IGNORECASE,
)
KOREAN_TIME_PATTERN = re.compile(
    r"(?P<period>오전|오후)\s*(?P<hour>\d{1,2})시(?:\s*(?P<minute>\d{1,2})분?)?",
)
TWENTY_FOUR_HOUR_PATTERN = re.compile(
    r"\b(?:at\s*)?(?P<hour>[01]?\d|2[0-3]):(?P<minute>[0-5]\d)(?:\s*(?:kst|KST))?\b",
)
NOON_PATTERN = re.compile(r"\bnoon\b|정오", re.IGNORECASE)
MIDNIGHT_PATTERN = re.compile(r"\bmidnight\b|자정", re.IGNORECASE)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_groups(path: Path, groups: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if groups:
        path.write_text("\n".join(groups) + "\n", encoding="utf-8")
    else:
        path.write_text("", encoding="utf-8")


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_iso_date(value: str) -> Optional[date]:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_reference_datetime(value: Optional[str]) -> datetime:
    if value:
        text = value.strip()
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=KST)
        return parsed.astimezone(KST)
    return datetime.now(tz=KST)


def parse_published_at(value: str) -> float:
    if not value:
        return -1
    for pattern in ("%Y-%m-%dT%H:%M:%S%z", "%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(value, pattern).timestamp()
        except ValueError:
            continue
    return -1


def source_rank(source_type: str) -> int:
    if source_type in {"agency_notice", "weverse_notice"}:
        return 0
    if source_type == "official_social":
        return 1
    if source_type == "news_rss":
        return 2
    return 9


def status_rank(date_status: str) -> int:
    return {"confirmed": 0, "scheduled": 1}.get(date_status, 9)


def choose_representative_same_day_targets(rows: list[dict[str, Any]], reference_date: date) -> list[dict[str, Any]]:
    selected: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        group = optional_text(row.get("group"))
        scheduled_date_text = optional_text(row.get("scheduled_date"))
        date_status = optional_text(row.get("date_status")) or ""
        date_precision = optional_text(row.get("date_precision")) or ""
        scheduled_date = parse_iso_date(scheduled_date_text or "")
        if group is None or scheduled_date is None:
            continue
        if scheduled_date != reference_date:
            continue
        if date_precision != "exact":
            continue
        if date_status not in {"scheduled", "confirmed"}:
            continue

        key = (group, scheduled_date_text or "")
        candidate_rank = (
            source_rank(optional_text(row.get("source_type")) or ""),
            status_rank(date_status),
            -(float(row.get("confidence", 0) or 0)),
            -parse_published_at(optional_text(row.get("published_at")) or ""),
            optional_text(row.get("headline")) or "",
        )
        current = selected.get(key)
        if current is None:
            selected[key] = row
            continue

        current_rank = (
            source_rank(optional_text(current.get("source_type")) or ""),
            status_rank(optional_text(current.get("date_status")) or ""),
            -(float(current.get("confidence", 0) or 0)),
            -parse_published_at(optional_text(current.get("published_at")) or ""),
            optional_text(current.get("headline")) or "",
        )
        if candidate_rank < current_rank:
            selected[key] = row

    return sorted(
        selected.values(),
        key=lambda row: (
            optional_text(row.get("scheduled_date")) or "",
            (optional_text(row.get("group")) or "").lower(),
        ),
    )


def _match_to_time(match: re.Match[str], mode: str) -> time:
    hour = int(match.group("hour"))
    minute = int(match.groupdict().get("minute") or 0)
    if mode == "english":
        period = match.group("period").lower().replace(".", "")
        if period == "pm" and hour != 12:
            hour += 12
        if period == "am" and hour == 12:
            hour = 0
    elif mode == "korean":
        period = match.group("period")
        if period == "오후" and hour != 12:
            hour += 12
        if period == "오전" and hour == 12:
            hour = 0
    return time(hour=hour, minute=minute)


def extract_release_time(text: str) -> Optional[tuple[time, str]]:
    value = text.strip()
    if not value:
        return None

    if NOON_PATTERN.search(value):
        return time(hour=12, minute=0), "explicit_keyword"
    if MIDNIGHT_PATTERN.search(value):
        return time(hour=0, minute=0), "explicit_keyword"

    korean_match = KOREAN_TIME_PATTERN.search(value)
    if korean_match:
        return _match_to_time(korean_match, "korean"), "explicit_korean_time"

    english_match = ENGLISH_MERIDIEM_PATTERN.search(value)
    if english_match:
        return _match_to_time(english_match, "english"), "explicit_english_time"

    twenty_four_hour_match = TWENTY_FOUR_HOUR_PATTERN.search(value)
    if twenty_four_hour_match:
        return _match_to_time(twenty_four_hour_match, "twenty_four_hour"), "explicit_24h_time"

    return None


def resolve_release_time(row: dict[str, Any]) -> tuple[time, str, str]:
    for field in ("headline", "evidence_summary"):
        text = optional_text(row.get(field))
        if text is None:
            continue
        extracted = extract_release_time(text)
        if extracted is None:
            continue
        release_time, mode = extracted
        return release_time, mode, field
    return DEFAULT_RELEASE_TIME, "default_noon", "policy_default"


def build_target_window(row: dict[str, Any], reference_datetime: datetime) -> dict[str, Any]:
    scheduled_date = parse_iso_date(optional_text(row.get("scheduled_date")) or "")
    if scheduled_date is None:
        raise ValueError("scheduled_date is required for same-day target windows")

    release_time, window_mode, source_field = resolve_release_time(row)
    release_datetime = datetime.combine(scheduled_date, release_time, tzinfo=KST)
    day_start = datetime.combine(scheduled_date, time.min, tzinfo=KST)
    window_start = release_datetime - timedelta(hours=1) if window_mode != "default_noon" else release_datetime
    if window_start < day_start:
        window_start = day_start
    window_end = datetime.combine(scheduled_date, WINDOW_END_TIME, tzinfo=KST)

    if reference_datetime < window_start:
        status = "deferred"
    elif reference_datetime <= window_end:
        status = "eligible"
    else:
        status = "expired"

    return {
        "group": row.get("group"),
        "scheduled_date": row.get("scheduled_date"),
        "headline": row.get("headline"),
        "source_type": row.get("source_type"),
        "source_url": row.get("source_url"),
        "date_status": row.get("date_status"),
        "date_precision": row.get("date_precision"),
        "confidence": float(row.get("confidence", 0) or 0),
        "window_mode": window_mode,
        "release_time_source_field": source_field,
        "release_time_kst": release_datetime.isoformat(),
        "window_start_kst": window_start.isoformat(),
        "window_end_kst": window_end.isoformat(),
        "status": status,
    }


def build_same_day_target_summary(rows: list[dict[str, Any]], reference_datetime: datetime) -> dict[str, Any]:
    representative_rows = choose_representative_same_day_targets(rows, reference_datetime.date())
    windows = [build_target_window(row, reference_datetime) for row in representative_rows]
    eligible = [row for row in windows if row["status"] == "eligible"]
    deferred = [row for row in windows if row["status"] == "deferred"]
    expired = [row for row in windows if row["status"] == "expired"]

    summary_lines = [
        f"reference time (KST): {reference_datetime.isoformat()}",
        f"same-day exact targets: {len(windows)}",
        f"eligible now: {len(eligible)}",
        f"deferred: {len(deferred)}",
        f"expired: {len(expired)}",
    ]
    for row in eligible:
        summary_lines.append(
            f"eligible: {row['group']} ({row['window_mode']}, start={row['window_start_kst']}, source={row['release_time_source_field']})"
        )

    return {
        "generated_at": datetime.now(tz=KST).isoformat(),
        "timezone": "Asia/Seoul",
        "reference_time_kst": reference_datetime.isoformat(),
        "reference_date_kst": reference_datetime.date().isoformat(),
        "overall_status": "eligible_targets_present" if eligible else "no_eligible_targets",
        "eligible_target_count": len(eligible),
        "eligible_groups": [row["group"] for row in eligible if row.get("group")],
        "eligible_targets": eligible,
        "deferred_targets": deferred,
        "expired_targets": expired,
        "summary_lines": summary_lines,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Select exact-date same-day upcoming targets that are currently eligible for release-day verification."
    )
    parser.add_argument(
        "--upcoming-path",
        default=str(UPCOMING_PATH),
        help="Path to the canonical upcoming candidates snapshot.",
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable same-day target summary JSON.",
    )
    parser.add_argument(
        "--groups-path",
        default=str(DEFAULT_GROUPS_PATH),
        help="Path to write newline-delimited eligible group names.",
    )
    parser.add_argument(
        "--reference-datetime",
        default=None,
        help="Reference datetime in ISO-8601. Naive values are interpreted as Asia/Seoul.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    reference_datetime = parse_reference_datetime(args.reference_datetime)
    rows = load_json(Path(args.upcoming_path))
    summary = build_same_day_target_summary(rows, reference_datetime)
    write_json(Path(args.summary_path), summary)
    write_groups(Path(args.groups_path), summary["eligible_groups"])
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
