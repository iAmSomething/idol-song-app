import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

import non_runtime_dataset_paths


ROOT = Path(__file__).resolve().parent
RELEASE_HISTORY_DATASET = "releaseHistory.json"
RELEASE_ARTWORK_DATASET = "releaseArtwork.json"
RELEASE_HISTORY_PATH = non_runtime_dataset_paths.resolve_input_path(RELEASE_HISTORY_DATASET)
RELEASE_ARTWORK_PATH = non_runtime_dataset_paths.resolve_input_path(RELEASE_ARTWORK_DATASET)
RELEASE_GROUP_PATTERN = re.compile(r"/release-group/([0-9a-f-]{36})/?$", re.IGNORECASE)


def load_json(path: Path) -> List[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_url(value: Any) -> Optional[str]:
    text = optional_text(value)
    if text is None:
        return None
    parsed = urlsplit(text)
    path = parsed.path.rstrip("/") or parsed.path
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))


def extract_release_group_id(source_url: Any) -> Optional[str]:
    url = normalize_url(source_url)
    if url is None:
        return None
    match = RELEASE_GROUP_PATTERN.search(url)
    return match.group(1) if match else None


def artwork_key(row: Dict[str, Any]) -> Tuple[str, str, str, str]:
    return (row["group"], row["release_title"], row["release_date"], row["stream"])


def build_verified_row(group: str, release: Dict[str, Any], release_group_id: str) -> Dict[str, Any]:
    artwork_source_url = f"https://coverartarchive.org/release-group/{release_group_id}"
    return {
        "group": group,
        "release_title": release["title"],
        "release_date": release["date"],
        "stream": release["stream"],
        "cover_image_url": f"{artwork_source_url}/front",
        "thumbnail_image_url": f"{artwork_source_url}/front-250",
        "artwork_source_type": "cover_art_archive",
        "artwork_source_url": artwork_source_url,
        "artwork_status": "verified",
        "artwork_provenance": "releaseHistory.releases.source",
    }


def build_fallback_row(group: str, release: Dict[str, Any], existing_row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if existing_row:
        status = optional_text(existing_row.get("artwork_status"))
        if status is None:
            status = "placeholder" if existing_row.get("artwork_source_type") == "placeholder" else "unresolved"
        provenance = optional_text(existing_row.get("artwork_provenance"))
        if provenance is None:
            provenance = (
                f"releaseArtwork.{existing_row.get('artwork_source_type')}"
                if optional_text(existing_row.get("artwork_source_type"))
                else "releaseArtwork.legacy_row"
            )
        return {
            "group": group,
            "release_title": release["title"],
            "release_date": release["date"],
            "stream": release["stream"],
            "cover_image_url": normalize_url(existing_row.get("cover_image_url")),
            "thumbnail_image_url": normalize_url(existing_row.get("thumbnail_image_url")),
            "artwork_source_type": optional_text(existing_row.get("artwork_source_type")),
            "artwork_source_url": normalize_url(existing_row.get("artwork_source_url")),
            "artwork_status": status,
            "artwork_provenance": provenance,
        }

    return {
        "group": group,
        "release_title": release["title"],
        "release_date": release["date"],
        "stream": release["stream"],
        "cover_image_url": None,
        "thumbnail_image_url": None,
        "artwork_source_type": None,
        "artwork_source_url": normalize_url(release.get("source")),
        "artwork_status": "unresolved",
        "artwork_provenance": "releaseHistory.releases.source_unresolved",
    }


def build_rows(
    history_rows: List[Dict[str, Any]],
    existing_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    existing_by_key = {artwork_key(row): row for row in existing_rows}
    rows: List[Dict[str, Any]] = []

    for group_row in sorted(history_rows, key=lambda row: row["group"].casefold()):
        for release in group_row.get("releases") or []:
            key = (group_row["group"], release["title"], release["date"], release["stream"])
            release_group_id = extract_release_group_id(release.get("source"))
            if release_group_id:
                rows.append(build_verified_row(group_row["group"], release, release_group_id))
            else:
                rows.append(build_fallback_row(group_row["group"], release, existing_by_key.get(key)))

    rows.sort(key=lambda row: (row["group"].casefold(), row["release_date"], row["stream"], row["release_title"].casefold()))
    return rows


def build_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    status_counts: Dict[str, int] = {}
    source_type_counts: Dict[str, int] = {}
    for row in rows:
        status = row.get("artwork_status") or "unknown"
        source_type = row.get("artwork_source_type") or "none"
        status_counts[status] = status_counts.get(status, 0) + 1
        source_type_counts[source_type] = source_type_counts.get(source_type, 0) + 1
    return {
        "artwork_rows": len(rows),
        "status_counts": dict(sorted(status_counts.items())),
        "source_type_counts": dict(sorted(source_type_counts.items())),
    }


def main() -> None:
    history_rows = load_json(RELEASE_HISTORY_PATH)
    existing_rows = load_json(RELEASE_ARTWORK_PATH)
    rows = build_rows(history_rows, existing_rows)
    io_paths = non_runtime_dataset_paths.write_json_dataset(RELEASE_ARTWORK_DATASET, rows)
    print(
        json.dumps(
            {
                "input_json": str(RELEASE_HISTORY_PATH.relative_to(ROOT)),
                **io_paths,
                "release_history_rows": sum(len(row.get("releases") or []) for row in history_rows),
                **build_summary(rows),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
