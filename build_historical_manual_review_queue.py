#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DETAILS_PATH = ROOT / "web/src/data/releaseDetails.json"
QUEUE_JSON_PATH = ROOT / "historical_manual_review_priority_queue.json"
QUEUE_CSV_PATH = ROOT / "historical_manual_review_priority_queue.csv"
REVIEW_REPORT_JSON_PATH = ROOT / "backend/reports/historical_manual_review_slice_report.json"
REVIEW_REPORT_MD_PATH = ROOT / "backend/reports/historical_manual_review_slice_report.md"

LEGACY_CUTOFF = "2025-01-01"
QUEUE_LIMIT = 120

HIGH_VISIBILITY_GROUPS = {
    "BTS",
    "BLACKPINK",
    "TWICE",
    "EXO",
    "SHINee",
    "SEVENTEEN",
    "Stray Kids",
    "Red Velvet",
    "(G)I-DLE",
    "TOMORROW X TOGETHER",
    "MAMAMOO",
    "ATEEZ",
    "ITZY",
    "NCT DREAM",
}

REVIEWED_SLICE = [
    ("TWICE", "One More Time", "2017-10-13", "song"),
    ("TWICE", "Candy Pop", "2018-01-12", "song"),
    ("TWICE", "Wake Me Up", "2018-04-25", "song"),
    ("TWICE", "BDZ", "2018-08-17", "song"),
    ("TWICE", "STAY BY MY SIDE", "2018-10-22", "song"),
]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def key_for(row: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        row["group"],
        row["release_title"],
        row["release_date"],
        row["stream"],
    )


def load_baseline_details() -> list[dict[str, Any]]:
    result = subprocess.run(
        ["git", "show", f"HEAD:{DETAILS_PATH.relative_to(ROOT).as_posix()}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def build_queue_reason(row: dict[str, Any]) -> str:
    reasons: list[str] = []
    if row.get("detail_status") not in {"verified", "manual_override"}:
        reasons.append(f"detail={row.get('detail_status') or 'missing'}")
    if row.get("title_track_status") not in {"verified", "inferred", "manual_override"}:
        reasons.append(f"title={row.get('title_track_status') or 'missing'}")
    if row.get("youtube_video_status") not in {"relation_match", "manual_override", "no_mv"}:
        reasons.append(f"mv={row.get('youtube_video_status') or 'missing'}")
    return ", ".join(reasons)


def build_priority_score(row: dict[str, Any]) -> int:
    score = 0
    if row["group"] in HIGH_VISIBILITY_GROUPS:
        score += 120
    if row["release_date"] < "2020-01-01":
        score += 60
    elif row["release_date"] < LEGACY_CUTOFF:
        score += 30
    if row["stream"] == "song":
        score += 20
    if row.get("detail_status") not in {"verified", "manual_override"}:
        score += 30
    if row.get("title_track_status") in {"review_needed", "unresolved"}:
        score += 35 if row.get("title_track_status") == "review_needed" else 25
    if row.get("youtube_video_status") in {"needs_review", "unresolved"}:
        score += 35 if row.get("youtube_video_status") == "needs_review" else 25
    if row["group"] == "TWICE":
        score += 10
    return score


def build_priority_tier(score: int) -> str:
    if score >= 220:
        return "tier_1"
    if score >= 170:
        return "tier_2"
    return "tier_3"


def main() -> None:
    current_rows = load_json(DETAILS_PATH)
    baseline_rows = load_baseline_details()
    current_by_key = {key_for(row): row for row in current_rows}
    baseline_by_key = {key_for(row): row for row in baseline_rows}
    reviewed_slice_keys = set(REVIEWED_SLICE)

    reviewed_rows: list[dict[str, Any]] = []
    for slice_key in REVIEWED_SLICE:
        before = baseline_by_key[slice_key]
        after = current_by_key[slice_key]
        reviewed_rows.append(
            {
                "group": after["group"],
                "release_title": after["release_title"],
                "release_date": after["release_date"],
                "stream": after["stream"],
                "before": {
                    "detail_status": before.get("detail_status"),
                    "title_track_status": before.get("title_track_status"),
                    "youtube_video_status": before.get("youtube_video_status"),
                    "track_count": len(before.get("tracks", [])),
                },
                "after": {
                    "detail_status": after.get("detail_status"),
                    "detail_provenance": after.get("detail_provenance"),
                    "title_track_status": after.get("title_track_status"),
                    "title_track_provenance": after.get("title_track_provenance"),
                    "youtube_video_status": after.get("youtube_video_status"),
                    "youtube_video_provenance": after.get("youtube_video_provenance"),
                    "track_count": len(after.get("tracks", [])),
                    "tracks": after.get("tracks", []),
                    "youtube_video_url": after.get("youtube_video_url"),
                },
            }
        )

    legacy_candidates = [
        row
        for row in current_rows
        if row["release_date"] < LEGACY_CUTOFF
        and key_for(row) not in reviewed_slice_keys
        and (
            row.get("detail_status") not in {"verified", "manual_override"}
            or row.get("title_track_status") in {"review_needed", "unresolved"}
            or row.get("youtube_video_status") in {"needs_review", "unresolved"}
        )
    ]

    queue_rows = []
    for row in legacy_candidates:
        priority_score = build_priority_score(row)
        queue_rows.append(
            {
                "priority_score": priority_score,
                "priority_tier": build_priority_tier(priority_score),
                "group": row["group"],
                "release_title": row["release_title"],
                "release_date": row["release_date"],
                "stream": row["stream"],
                "release_kind": row.get("release_kind"),
                "detail_status": row.get("detail_status"),
                "title_track_status": row.get("title_track_status"),
                "youtube_video_status": row.get("youtube_video_status"),
                "queue_reason": build_queue_reason(row),
                "suggested_action": "Curate release-detail override with tracks, title-track, and canonical MV decision.",
            }
        )

    queue_rows.sort(
        key=lambda row: (
            -row["priority_score"],
            row["release_date"],
            row["group"].casefold(),
            row["release_title"].casefold(),
        )
    )
    exported_rows = queue_rows[:QUEUE_LIMIT]

    write_json(
        QUEUE_JSON_PATH,
        {
            "legacy_cutoff": LEGACY_CUTOFF,
            "queue_scope_total": len(queue_rows),
            "queue_export_total": len(exported_rows),
            "queue_limit": QUEUE_LIMIT,
            "reviewed_slice_total": len(reviewed_rows),
            "rows": exported_rows,
        },
    )

    with QUEUE_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "priority_score",
                "priority_tier",
                "group",
                "release_title",
                "release_date",
                "stream",
                "release_kind",
                "detail_status",
                "title_track_status",
                "youtube_video_status",
                "queue_reason",
                "suggested_action",
            ],
        )
        writer.writeheader()
        writer.writerows(exported_rows)

    write_json(
        REVIEW_REPORT_JSON_PATH,
        {
            "reviewed_slice_name": "TWICE pre-2019 Japanese singles",
            "reviewed_slice_total": len(reviewed_rows),
            "rows": reviewed_rows,
        },
    )

    lines = [
        "# Historical Manual Review Slice",
        "",
        "Reviewed slice: `TWICE pre-2019 Japanese singles`",
        "",
        "| Release | Before | After |",
        "| --- | --- | --- |",
    ]
    for row in reviewed_rows:
        before = row["before"]
        after = row["after"]
        after_mv = after["youtube_video_status"]
        if after["youtube_video_url"]:
            after_mv = f"{after_mv} ({after['youtube_video_url']})"
        lines.append(
            f"| {row['release_date']} {row['release_title']} | "
            f"detail={before['detail_status']}, title={before['title_track_status']}, mv={before['youtube_video_status']} | "
            f"detail={after['detail_status']}, title={after['title_track_status']}, mv={after_mv} |"
        )

    REVIEW_REPORT_MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "reviewed_slice_total": len(reviewed_rows),
                "queue_scope_total": len(queue_rows),
                "queue_export_total": len(exported_rows),
                "queue_limit": QUEUE_LIMIT,
                "output_json": str(QUEUE_JSON_PATH.relative_to(ROOT)),
                "output_csv": str(QUEUE_CSV_PATH.relative_to(ROOT)),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
