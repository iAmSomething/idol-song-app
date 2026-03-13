#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List


ROOT = Path(__file__).resolve().parent
INPUT_PATH = ROOT / "canonical_entity_metadata.json"
REPORT_JSON_PATH = ROOT / "backend" / "reports" / "official_social_survey_inventory.json"
REPORT_CSV_PATH = ROOT / "backend" / "reports" / "official_social_survey_inventory.csv"
REPORT_MD_PATH = ROOT / "backend" / "reports" / "official_social_survey_inventory.md"
WORKBENCH_JSON_PATH = ROOT / "backend" / "reports" / "official_social_survey_workbench.json"

SOCIAL_FIELDS = ("official_x", "official_instagram", "official_youtube")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def is_resolved(field_row: dict[str, Any]) -> bool:
    return field_row.get("status") == "resolved" and bool(field_row.get("value"))


def get_field(fields: dict[str, Any], field_name: str) -> dict[str, Any]:
    field_row = fields.get(field_name)
    if isinstance(field_row, dict):
        return field_row
    return {
        "value": None,
        "status": "missing",
        "provenance": None,
        "source_url": None,
        "review_notes": None,
    }


def classify_entity(row: dict[str, Any]) -> dict[str, Any]:
    fields = row["fields"]
    resolved_fields = [field_name for field_name in SOCIAL_FIELDS if is_resolved(get_field(fields, field_name))]
    weak_fields = [field_name for field_name in SOCIAL_FIELDS if field_name not in resolved_fields]

    if len(resolved_fields) == len(SOCIAL_FIELDS):
        eligibility_state = "survey_ready"
    elif resolved_fields:
        eligibility_state = "partially_ready"
    else:
        eligibility_state = "missing_handle"

    survey_sources = [
        {
            "field": field_name,
            "url": get_field(fields, field_name).get("value"),
            "provenance": get_field(fields, field_name).get("provenance"),
            "source_url": get_field(fields, field_name).get("source_url"),
        }
        for field_name in resolved_fields
    ]

    return {
        "group": row["group"],
        "slug": row["slug"],
        "eligibility_state": eligibility_state,
        "resolved_handle_count": len(resolved_fields),
        "resolved_fields": resolved_fields,
        "weak_fields": weak_fields,
        "field_statuses": {field_name: get_field(fields, field_name).get("status") for field_name in SOCIAL_FIELDS},
        "handles": {
            field_name: {
                "value": get_field(fields, field_name).get("value"),
                "status": get_field(fields, field_name).get("status"),
                "provenance": get_field(fields, field_name).get("provenance"),
                "source_url": get_field(fields, field_name).get("source_url"),
                "review_notes": get_field(fields, field_name).get("review_notes"),
            }
            for field_name in SOCIAL_FIELDS
        },
        "survey_sources": survey_sources,
    }


def build_field_status_counts(rows: Iterable[dict[str, Any]]) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {field_name: {} for field_name in SOCIAL_FIELDS}
    for row in rows:
        for field_name in SOCIAL_FIELDS:
            status = row["handles"][field_name]["status"] or "unknown"
            field_counts = counts[field_name]
            field_counts[status] = field_counts.get(status, 0) + 1
    return {field_name: dict(sorted(field_counts.items())) for field_name, field_counts in counts.items()}


def build_inventory_report(canonical_rows: list[dict[str, Any]]) -> dict[str, Any]:
    entities = sorted((classify_entity(row) for row in canonical_rows), key=lambda row: row["group"].casefold())

    eligibility_counts: dict[str, int] = {}
    for row in entities:
        eligibility = row["eligibility_state"]
        eligibility_counts[eligibility] = eligibility_counts.get(eligibility, 0) + 1

    weak_field_counts = {field_name: 0 for field_name in SOCIAL_FIELDS}
    for row in entities:
        for field_name in row["weak_fields"]:
            weak_field_counts[field_name] += 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity_count": len(entities),
        "eligibility_counts": dict(sorted(eligibility_counts.items())),
        "field_status_counts": build_field_status_counts(entities),
        "weak_field_counts": weak_field_counts,
        "entities": entities,
    }


def build_workbench(report: dict[str, Any]) -> dict[str, Any]:
    entries = [row for row in report["entities"] if row["eligibility_state"] != "survey_ready"]
    counts_by_state: dict[str, int] = {}
    for row in entries:
        counts_by_state[row["eligibility_state"]] = counts_by_state.get(row["eligibility_state"], 0) + 1

    return {
        "generated_at": report["generated_at"],
        "total_entries": len(entries),
        "counts_by_state": dict(sorted(counts_by_state.items())),
        "entries": entries,
    }


def write_csv(path: Path, entities: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "group",
                "slug",
                "eligibility_state",
                "resolved_handle_count",
                "official_x_status",
                "official_x_value",
                "official_instagram_status",
                "official_instagram_value",
                "official_youtube_status",
                "official_youtube_value",
                "weak_fields",
                "survey_source_urls",
            ]
        )
        for row in entities:
            writer.writerow(
                [
                    row["group"],
                    row["slug"],
                    row["eligibility_state"],
                    row["resolved_handle_count"],
                    row["handles"]["official_x"]["status"],
                    row["handles"]["official_x"]["value"],
                    row["handles"]["official_instagram"]["status"],
                    row["handles"]["official_instagram"]["value"],
                    row["handles"]["official_youtube"]["status"],
                    row["handles"]["official_youtube"]["value"],
                    ",".join(row["weak_fields"]),
                    ",".join(source["url"] for source in row["survey_sources"]),
                ]
            )


def build_markdown(report: dict[str, Any], workbench: dict[str, Any]) -> str:
    lines = [
        "# Official Social Survey Inventory",
        "",
        f"- tracked entities: **{report['entity_count']}**",
        f"- survey-ready: **{report['eligibility_counts'].get('survey_ready', 0)}**",
        f"- partially-ready: **{report['eligibility_counts'].get('partially_ready', 0)}**",
        f"- missing-handle: **{report['eligibility_counts'].get('missing_handle', 0)}**",
        "",
        "## Weak Handle Coverage",
        "",
        f"- official_x weak rows: **{report['weak_field_counts']['official_x']}**",
        f"- official_instagram weak rows: **{report['weak_field_counts']['official_instagram']}**",
        f"- official_youtube weak rows: **{report['weak_field_counts']['official_youtube']}**",
        "",
        "## Workbench",
        "",
        f"- total non-ready rows: **{workbench['total_entries']}**",
    ]
    for state, count in sorted(workbench["counts_by_state"].items()):
        lines.append(f"- {state}: **{count}**")
    return "\n".join(lines) + "\n"


def main() -> None:
    canonical_rows = load_json(INPUT_PATH)
    report = build_inventory_report(canonical_rows)
    workbench = build_workbench(report)

    write_json(REPORT_JSON_PATH, report)
    write_json(WORKBENCH_JSON_PATH, workbench)
    write_csv(REPORT_CSV_PATH, report["entities"])
    write_text(REPORT_MD_PATH, build_markdown(report, workbench))

    print(
        json.dumps(
            {
                "report_json": str(REPORT_JSON_PATH.relative_to(ROOT)),
                "report_csv": str(REPORT_CSV_PATH.relative_to(ROOT)),
                "report_md": str(REPORT_MD_PATH.relative_to(ROOT)),
                "workbench_json": str(WORKBENCH_JSON_PATH.relative_to(ROOT)),
                "entity_count": report["entity_count"],
                "survey_ready": report["eligibility_counts"].get("survey_ready", 0),
                "partially_ready": report["eligibility_counts"].get("partially_ready", 0),
                "missing_handle": report["eligibility_counts"].get("missing_handle", 0),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
