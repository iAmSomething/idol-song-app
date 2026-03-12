from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parent
BACKEND_EXPORT_DIR = ROOT / "backend" / "exports" / "non_runtime_web_snapshots"
WEB_DATA_DIR = ROOT / "web" / "src" / "data"

PRIMARY_DATASET_PATHS = {
    "artistProfiles.json": ROOT / "artist_profiles_seed.json",
    "teamBadgeAssets.json": ROOT / "team_badge_assets.json",
    "youtubeChannelAllowlists.json": ROOT / "youtube_channel_allowlists.json",
    "releaseDetails.json": ROOT / "release_detail_catalog.json",
    "releaseArtwork.json": ROOT / "release_artwork_catalog.json",
    "releaseHistory.json": ROOT / "verified_release_history_mb.json",
    "releases.json": ROOT / "group_latest_release_since_2025-06-01_mb.json",
    "watchlist.json": ROOT / "tracking_watchlist.json",
    "upcomingCandidates.json": ROOT / "upcoming_release_candidates.json",
}


def primary_path(file_name: str) -> Path:
    if file_name not in PRIMARY_DATASET_PATHS:
        raise KeyError(f"Unsupported non-runtime dataset: {file_name}")
    return PRIMARY_DATASET_PATHS[file_name]


def export_path(file_name: str) -> Path:
    return BACKEND_EXPORT_DIR / file_name


def web_path(file_name: str) -> Path:
    return WEB_DATA_DIR / file_name


def input_candidates(file_name: str) -> list[Path]:
    primary = primary_path(file_name)
    candidates = [primary, export_path(file_name), web_path(file_name)]
    deduped: list[Path] = []
    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        deduped.append(candidate)
    return deduped


def resolve_input_path(file_name: str) -> Path:
    for candidate in input_candidates(file_name):
        if candidate.exists():
            return candidate
    return primary_path(file_name)


def load_json_dataset(file_name: str) -> Any:
    return json.loads(resolve_input_path(file_name).read_text(encoding="utf-8"))


def mirror_output_paths(file_name: str) -> list[Path]:
    primary = primary_path(file_name)
    mirrors = [export_path(file_name), web_path(file_name)]
    deduped: list[Path] = []
    seen: set[Path] = {primary}
    for mirror in mirrors:
        if mirror in seen:
            continue
        seen.add(mirror)
        deduped.append(mirror)
    return deduped


def write_json_dataset(file_name: str, payload: Any) -> dict[str, list[str] | str]:
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    primary = primary_path(file_name)
    primary.parent.mkdir(parents=True, exist_ok=True)
    primary.write_text(serialized, encoding="utf-8")

    mirror_rel_paths: list[str] = []
    for mirror in mirror_output_paths(file_name):
        mirror.parent.mkdir(parents=True, exist_ok=True)
        mirror.write_text(serialized, encoding="utf-8")
        mirror_rel_paths.append(str(mirror.relative_to(ROOT)))

    return {
        "primary_path": str(primary.relative_to(ROOT)),
        "mirror_paths": mirror_rel_paths,
    }


def describe_dataset_io(file_name: str) -> dict[str, Any]:
    return {
        "file_name": file_name,
        "primary_path": str(primary_path(file_name).relative_to(ROOT)),
        "input_path": str(resolve_input_path(file_name).relative_to(ROOT)),
        "mirror_paths": [str(path.relative_to(ROOT)) for path in mirror_output_paths(file_name)],
    }


def ensure_primary_seed(file_name: str) -> Path:
    resolved = resolve_input_path(file_name)
    target = primary_path(file_name)
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(resolved.read_text(encoding="utf-8"), encoding="utf-8")
    return target


def ensure_primary_seeds(file_names: Iterable[str]) -> list[Path]:
    return [ensure_primary_seed(file_name) for file_name in file_names]
