#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
UNRESOLVED_PATH = ROOT / "group_latest_release_since_2025-06-01_mb_unresolved.json"
WATCHLIST_PATH = ROOT / "tracking_watchlist.json"
UPCOMING_PATH = ROOT / "upcoming_release_candidates.json"
OUTPUT_JSON = ROOT / "manual_review_queue.json"
OUTPUT_CSV = ROOT / "manual_review_queue.csv"
EXACT_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def is_exact_date(value: str) -> bool:
    return bool(value and EXACT_DATE_PATTERN.match(value))


def is_month_key(value: str) -> bool:
    return bool(value and MONTH_PATTERN.match(value))


def get_date_precision(row: dict) -> str:
    precision = row.get("date_precision", "") or ""
    if precision in {"exact", "month_only", "unknown"}:
        return precision
    if is_exact_date(row.get("scheduled_date", "") or ""):
        return "exact"
    if is_month_key(row.get("scheduled_month", "") or ""):
        return "month_only"
    return "unknown"


def has_weak_source_provenance(row: dict) -> bool:
    return row.get("source_type") == "news_rss" and row.get("date_status") == "rumor"


def build_recommended_action(reasons: list[str]) -> str:
    if "unresolved_group" in reasons:
        return "Verify the group's latest release mapping and artist source manually."
    if "missing_source_link" in reasons and "inexact_date" in reasons:
        return "Confirm an official source and exact date before promoting the candidate."
    if "missing_source_link" in reasons:
        return "Backfill a stable source URL or replace it with an official notice."
    if "low_confidence" in reasons:
        return "Review the evidence and confidence score manually."
    if "inexact_date" in reasons:
        return "Keep the candidate in review until an exact date appears."
    return "Review this candidate manually."


def build_candidate_reasons(row: dict) -> list[str]:
    reasons: list[str] = []
    if float(row.get("confidence", 0) or 0) < 0.6:
        reasons.append("low_confidence")
    if get_date_precision(row) != "exact":
        reasons.append("inexact_date")
    if not row.get("source_url") or has_weak_source_provenance(row):
        reasons.append("missing_source_link")
    return reasons


def build_unresolved_queue_rows(unresolved_rows: list[dict], watchlist_by_group: dict[str, dict]) -> list[dict]:
    rows: list[dict] = []
    for row in unresolved_rows:
        group = row.get("group", "")
        tracking_status = watchlist_by_group.get(group, {}).get("tracking_status", "needs_manual_review")
        reasons = ["unresolved_group"]
        rows.append(
            {
                "group": group,
                "headline": "Unresolved latest release mapping",
                "scheduled_date": "",
                "scheduled_month": "",
                "date_precision": "unknown",
                "date_status": "",
                "confidence": 0,
                "source_type": "unresolved",
                "source_url": "",
                "evidence_summary": row.get("reason", ""),
                "tracking_status": tracking_status,
                "review_reason": reasons,
                "recommended_action": build_recommended_action(reasons),
            }
        )
    return rows


def build_upcoming_queue_rows(upcoming_rows: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for row in upcoming_rows:
        reasons = build_candidate_reasons(row)
        if not reasons:
            continue
        rows.append(
            {
                "group": row.get("group", ""),
                "headline": row.get("headline", ""),
                "scheduled_date": row.get("scheduled_date", ""),
                "scheduled_month": row.get("scheduled_month", ""),
                "date_precision": get_date_precision(row),
                "date_status": row.get("date_status", ""),
                "confidence": float(row.get("confidence", 0) or 0),
                "source_type": row.get("source_type", ""),
                "source_url": row.get("source_url", ""),
                "evidence_summary": row.get("evidence_summary", ""),
                "tracking_status": row.get("tracking_status", ""),
                "review_reason": reasons,
                "recommended_action": build_recommended_action(reasons),
            }
        )
    return rows


def sort_key(row: dict):
    precision_rank = {
        "exact": 0,
        "month_only": 1,
        "unknown": 2,
    }
    precision = get_date_precision(row)
    confidence = float(row.get("confidence", 0) or 0)
    return (
        row.get("group", "").lower(),
        precision_rank.get(precision, 2),
        row.get("scheduled_date", "") or row.get("scheduled_month", "") or "9999-12-31",
        confidence,
        row.get("headline", "").lower(),
    )


def main():
    unresolved_rows = load_json(UNRESOLVED_PATH)
    watchlist_rows = load_json(WATCHLIST_PATH)
    upcoming_rows = load_json(UPCOMING_PATH)

    watchlist_by_group = {row["group"]: row for row in watchlist_rows}
    queue_rows = [
        *build_unresolved_queue_rows(unresolved_rows, watchlist_by_group),
        *build_upcoming_queue_rows(upcoming_rows),
    ]
    queue_rows.sort(key=sort_key)

    OUTPUT_JSON.write_text(json.dumps(queue_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "headline",
                "scheduled_date",
                "scheduled_month",
                "date_precision",
                "date_status",
                "confidence",
                "source_type",
                "source_url",
                "evidence_summary",
                "tracking_status",
                "review_reason",
                "recommended_action",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in queue_rows:
            output = dict(row)
            output["review_reason"] = " ; ".join(output["review_reason"])
            writer.writerow(output)

    print(
        json.dumps(
            {
                "queue_items": len(queue_rows),
                "unresolved_groups": len(unresolved_rows),
                "candidate_items": max(0, len(queue_rows) - len(unresolved_rows)),
                "output_json": OUTPUT_JSON.name,
                "output_csv": OUTPUT_CSV.name,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
