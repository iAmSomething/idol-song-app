import json
from pathlib import Path
from typing import Any, Dict, List

import non_runtime_dataset_paths


ROOT = Path(__file__).resolve().parent
ENTITY_METADATA_PATH = ROOT / "canonical_entity_metadata.json"
RELEASE_ARTWORK_PATH = non_runtime_dataset_paths.resolve_input_path("releaseArtwork.json")
RELEASE_HISTORY_PATH = non_runtime_dataset_paths.resolve_input_path("releaseHistory.json")
REPORT_JSON_PATH = ROOT / "backend" / "reports" / "entity_asset_coverage_report.json"
REPORT_MD_PATH = ROOT / "backend" / "reports" / "entity_asset_coverage_report.md"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def count_statuses(rows: List[Dict[str, Any]], field_key: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for row in rows:
        status = row["fields"][field_key]["status"]
        counts[status] = counts.get(status, 0) + 1
    return dict(sorted(counts.items()))


def build_report() -> Dict[str, Any]:
    entity_rows = load_json(ENTITY_METADATA_PATH)
    artwork_rows = load_json(RELEASE_ARTWORK_PATH)
    history_rows = load_json(RELEASE_HISTORY_PATH)
    total_release_rows = sum(len(row.get("releases") or []) for row in history_rows)

    artwork_status_counts: Dict[str, int] = {}
    artwork_source_counts: Dict[str, int] = {}
    for row in artwork_rows:
        status = row.get("artwork_status") or "unknown"
        source_type = row.get("artwork_source_type") or "none"
        artwork_status_counts[status] = artwork_status_counts.get(status, 0) + 1
        artwork_source_counts[source_type] = artwork_source_counts.get(source_type, 0) + 1

    return {
        "generated_at": None,
        "entity_metadata": {
            "entity_count": len(entity_rows),
            "field_status_counts": {
                "official_youtube": count_statuses(entity_rows, "official_youtube"),
                "official_x": count_statuses(entity_rows, "official_x"),
                "official_instagram": count_statuses(entity_rows, "official_instagram"),
                "agency_name": count_statuses(entity_rows, "agency_name"),
                "debut_year": count_statuses(entity_rows, "debut_year"),
                "representative_image": count_statuses(entity_rows, "representative_image"),
            },
        },
        "release_artwork": {
            "artwork_rows": len(artwork_rows),
            "release_history_rows": total_release_rows,
            "coverage_ratio": round(len(artwork_rows) / total_release_rows, 4) if total_release_rows else 0,
            "status_counts": dict(sorted(artwork_status_counts.items())),
            "source_type_counts": dict(sorted(artwork_source_counts.items())),
        },
    }


def main() -> None:
    report = build_report()
    write_json(REPORT_JSON_PATH, report)

    field_counts = report["entity_metadata"]["field_status_counts"]
    artwork = report["release_artwork"]
    md = "\n".join(
        [
            "# Entity Asset Coverage Report",
            "",
            f"- entities: {report['entity_metadata']['entity_count']}",
            f"- representative image resolved: {field_counts['representative_image'].get('resolved', 0)}",
            f"- agency resolved: {field_counts['agency_name'].get('resolved', 0)}",
            f"- debut year resolved: {field_counts['debut_year'].get('resolved', 0)}",
            f"- release artwork rows: {artwork['artwork_rows']}/{artwork['release_history_rows']}",
            f"- release artwork verified: {artwork['status_counts'].get('verified', 0)}",
            f"- release artwork placeholder: {artwork['status_counts'].get('placeholder', 0)}",
            "",
        ]
    )
    write_text(REPORT_MD_PATH, md)

    print(
        json.dumps(
            {
                "report_json": str(REPORT_JSON_PATH.relative_to(ROOT)),
                "report_md": str(REPORT_MD_PATH.relative_to(ROOT)),
                "representative_image_resolved": field_counts["representative_image"].get("resolved", 0),
                "release_artwork_rows": artwork["artwork_rows"],
                "release_history_rows": artwork["release_history_rows"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
