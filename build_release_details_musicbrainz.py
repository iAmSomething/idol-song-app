import argparse
import csv
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import non_runtime_dataset_paths
from release_detail_acquisition import (
    MusicBrainzReleaseDetailClient,
    build_attempt,
    enrich_release_detail,
    get_actionable_release_detail_fields,
    get_missing_release_detail_fields,
)

ROOT = Path(__file__).resolve().parent
RELEASES_SNAPSHOT_DATASET = "releases.json"
RELEASE_HISTORY_DATASET = "releaseHistory.json"
RELEASE_DETAILS_DATASET = "releaseDetails.json"
RELEASES_SNAPSHOT_PATH = non_runtime_dataset_paths.resolve_input_path(RELEASES_SNAPSHOT_DATASET)
RELEASE_HISTORY_PATH = non_runtime_dataset_paths.resolve_input_path(RELEASE_HISTORY_DATASET)
OUTPUT_PATH = non_runtime_dataset_paths.primary_path(RELEASE_DETAILS_DATASET)
OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
MIGRATION_PRIORITY_SLICE_PATH = ROOT / "historical_migration_priority_slice.json"
AUDIT_OUTPUT_PATH = ROOT / "backend/reports/historical_release_detail_coverage_report.json"
AUDIT_MARKDOWN_OUTPUT_PATH = ROOT / "backend/reports/historical_release_detail_coverage_summary.md"
TITLE_TRACK_REVIEW_JSON_PATH = ROOT / "title_track_manual_review_queue.json"
TITLE_TRACK_REVIEW_CSV_PATH = ROOT / "title_track_manual_review_queue.csv"
DETAIL_REVIEW_JSON_PATH = ROOT / "release_detail_manual_review_queue.json"
DETAIL_REVIEW_CSV_PATH = ROOT / "release_detail_manual_review_queue.csv"
MV_COVERAGE_REPORT_PATH = ROOT / "mv_coverage_report.json"
MIN_ACQUISITION_ATTEMPTS = 5

DETAIL_STATUS_VERIFIED = "verified"
DETAIL_STATUS_INFERRED = "inferred"
DETAIL_STATUS_MANUAL = "manual_override"
DETAIL_STATUS_REVIEW = "review_needed"
DETAIL_STATUS_UNRESOLVED = "unresolved"

YOUTUBE_VIDEO_STATUS_RELATION = "relation_match"
YOUTUBE_VIDEO_STATUS_MANUAL = "manual_override"
YOUTUBE_VIDEO_STATUS_REVIEW = "needs_review"
YOUTUBE_VIDEO_STATUS_NO_MV = "no_mv"
YOUTUBE_VIDEO_STATUS_UNRESOLVED = "unresolved"
TITLE_TRACK_STATUS_NO_TRACKS = "no_tracks"
TITLE_TRACK_STATUS_MANUAL = "manual_override"
TITLE_TRACK_STATUS_EXISTING = "preserved_existing"
TITLE_TRACK_STATUS_AUTO_SINGLE = "auto_single"
TITLE_TRACK_STATUS_AUTO_DOUBLE = "auto_double"
TITLE_TRACK_STATUS_REVIEW = "review"
TITLE_TRACK_STATUS_UNRESOLVED = "unresolved"

DETAIL_TRUSTED_STATUSES = {DETAIL_STATUS_VERIFIED, DETAIL_STATUS_MANUAL}
TITLE_TRACK_COMPLETE_STATUSES = {DETAIL_STATUS_VERIFIED, DETAIL_STATUS_INFERRED, DETAIL_STATUS_MANUAL}
MV_COMPLETE_STATUSES = {YOUTUBE_VIDEO_STATUS_RELATION, YOUTUBE_VIDEO_STATUS_MANUAL}
TITLE_TRACK_NON_PROMOTED_PATTERN = re.compile(
    r"(?i)\b(intro|introduction|outro|interlude|skit|inst\.?|instrumental|preview|teaser|highlight|medley)\b"
)
FOLLOWUP_SONG_RELEASE_MAX_DAYS = 60

HISTORICAL_COMPLETENESS_THRESHOLDS = {
    "detail_payload_total_min": 1.0,
    "detail_payload_pre_2024_min": 1.0,
    "detail_trusted_total_min": 0.85,
    "detail_trusted_pre_2024_min": 0.5,
    "title_track_resolved_total_min": 0.8,
    "title_track_resolved_pre_2024_min": 0.6,
    "canonical_mv_total_min": 0.65,
    "canonical_mv_pre_2024_min": 0.35,
}

MIGRATION_PRIORITY_SLICE_THRESHOLDS = {
    "detail_payload_min": 1.0,
    "detail_trusted_min": 1.0,
    "title_track_resolved_min": 1.0,
    "canonical_mv_min": 1.0,
}
COHORT_YEAR_BANDS = (
    ("<=2017", None, 2017),
    ("2018-2020", 2018, 2020),
    ("2021-2023", 2021, 2023),
    ("2024+", 2024, None),
)
SCOPABLE_RELEASE_COHORTS = {"latest", "recent", "historical"}
TITLE_TRACK_COHORT_TARGETS = {
    "<=2017": {"single": 0.7, "ep": 0.6, "album": 0.55},
    "2018-2020": {"single": 0.78, "ep": 0.68, "album": 0.62},
    "2021-2023": {"single": 0.84, "ep": 0.74, "album": 0.68},
    "2024+": {"single": 0.9, "ep": 0.82, "album": 0.76},
}
CANONICAL_MV_COHORT_TARGETS = {
    "<=2017": {"single": 0.2, "ep": 0.12, "album": 0.08},
    "2018-2020": {"single": 0.32, "ep": 0.22, "album": 0.16},
    "2021-2023": {"single": 0.5, "ep": 0.35, "album": 0.28},
    "2024+": {"single": 0.72, "ep": 0.55, "album": 0.4},
}


def parse_positive_int_arg(raw_value: str) -> int:
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def parse_non_negative_int_arg(raw_value: str) -> int:
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a non-negative integer") from error
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be a non-negative integer")
    return parsed


def enrich_execution_scope(
    execution_scope: Optional[Dict],
    total_scoped_rows: int,
    selected_rows: int,
    max_rows: Optional[int],
    progress_every: int,
    row_offset: int,
) -> Dict:
    scope = dict(execution_scope or {})
    scope["scoped_rows_total"] = total_scoped_rows
    scope["selected_rows"] = selected_rows
    if max_rows is not None:
        scope["max_rows"] = max_rows
    scope["progress_every"] = progress_every
    scope["row_offset"] = row_offset
    return scope


def should_emit_progress(current_index: int, total_rows: int, progress_every: int) -> bool:
    if total_rows <= 0:
        return False
    return current_index == 1 or current_index == total_rows or current_index % progress_every == 0


def emit_progress(prefix: str, current_index: int, total_rows: int, row: Dict) -> None:
    print(
        (
            f"[{prefix}] {current_index}/{total_rows} "
            f"{row['group']} / {row['release_title']} / {row['release_date']} / {row['stream']}"
        ),
        file=sys.stderr,
        flush=True,
    )


def optional_text(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None

    stripped = value.strip()
    return stripped or None


def normalize_title(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value.casefold())
    return "".join(character for character in normalized if character.isalnum())


def extract_youtube_video_id(resource: str) -> Optional[str]:
    parsed = urlparse(resource)
    host = parsed.netloc.lower()
    segments = [segment for segment in parsed.path.split("/") if segment]

    if "youtu.be" in host:
        return parsed.path.strip("/") or None
    if "youtube.com" in host and "music.youtube.com" not in host:
        watch_id = parse_qs(parsed.query).get("v", [None])[0]
        if watch_id:
            return watch_id
        if "shorts" in segments or "embed" in segments:
            for index, segment in enumerate(segments):
                if segment in {"shorts", "embed"} and index + 1 < len(segments):
                    return segments[index + 1]
    return None


def build_youtube_video_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def infer_release_cohort(release_date_text: str, reference_date: date) -> str:
    try:
        release_date = date.fromisoformat(release_date_text)
    except ValueError:
        return "unknown"

    age_days = (reference_date - release_date).days
    if age_days <= 365:
        return "latest"
    if age_days <= 365 * 3:
        return "recent"
    return "historical"


def parse_scoped_cohorts(raw_value: Optional[str]) -> Optional[set[str]]:
    if not raw_value:
        return None

    scoped = {value.strip() for value in raw_value.split(",") if value.strip()}
    invalid = sorted(scoped - SCOPABLE_RELEASE_COHORTS)
    if invalid:
        raise ValueError(f"Unsupported cohort values: {', '.join(invalid)}")
    return scoped or None


def build_execution_scope(
    scoped_groups: Optional[set[str]],
    scoped_cohorts: Optional[set[str]],
) -> Optional[Dict]:
    if scoped_groups is None and scoped_cohorts is None:
        return None

    scope: Dict[str, object] = {"targeted_rebuild": True}
    if scoped_groups is not None:
        scope["groups"] = sorted(scoped_groups)
    if scoped_cohorts is not None:
        scope["cohorts"] = sorted(scoped_cohorts)
    return scope


def matches_execution_scope(
    item: Dict,
    scoped_groups: Optional[set[str]],
    scoped_cohorts: Optional[set[str]],
    reference_date: date,
) -> bool:
    if scoped_groups is not None and item["group"] not in scoped_groups:
        return False
    if scoped_cohorts is not None:
        release_cohort = infer_release_cohort(item["release_date"], reference_date)
        if release_cohort not in scoped_cohorts:
            return False
    return True


def extract_release_group_id(resource: Optional[str]) -> Optional[str]:
    resource_text = optional_text(resource)
    if not resource_text:
        return None

    parsed = urlparse(resource_text)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) >= 2 and segments[-2] == "release-group":
        return segments[-1]
    return None


def get_detail_key(group: str, release_title: str, release_date: str, stream: str) -> str:
    return "::".join([group, release_title, release_date, stream]).lower()


def get_relaxed_detail_key(group: str, release_title: str, stream: str) -> str:
    return "::".join([group, normalize_title(release_title), stream]).lower()


def load_rows(path: Path) -> List[Dict]:
    with path.open() as handle:
        return json.load(handle)


def load_optional_rows(path: Path) -> Optional[object]:
    if not path.exists():
        return None
    with path.open() as handle:
        return json.load(handle)


def load_detail_overrides() -> Dict[str, Dict]:
    merged: Dict[str, Dict] = {}
    for path in [MIGRATION_PRIORITY_SLICE_PATH, OVERRIDES_PATH]:
        if not path.exists():
            continue
        for row in load_rows(path):
            key = get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
            merged[key] = {**merged.get(key, {}), **row}
    return merged


def load_migration_priority_slice_rows() -> List[Dict]:
    if not MIGRATION_PRIORITY_SLICE_PATH.exists():
        return []
    return load_rows(MIGRATION_PRIORITY_SLICE_PATH)


def iter_release_items(history_rows: List[Dict]) -> List[Dict]:
    items: List[Dict] = []
    for row in history_rows:
        for release in row.get("releases", []):
            title = optional_text(release.get("title"))
            release_date = optional_text(release.get("date"))
            stream = optional_text(release.get("stream"))
            release_kind = optional_text(release.get("release_kind"))
            if not title or not release_date or stream not in {"song", "album"} or release_kind not in {"single", "album", "ep"}:
                continue

            items.append(
                {
                    "group": row["group"],
                    "release_title": title,
                    "release_date": release_date,
                    "stream": stream,
                    "release_kind": release_kind,
                    "release_group_id": extract_release_group_id(release.get("source")),
                }
            )

    items.sort(
        key=lambda item: (
            item["group"].casefold(),
            item["release_date"],
            item["stream"],
            item["release_title"].casefold(),
        )
    )
    return items


def iter_latest_snapshot_items(rows: List[Dict]) -> List[Dict]:
    items: List[Dict] = []
    for row in rows:
        for key, stream in (("latest_song", "song"), ("latest_album", "album")):
            release = row.get(key)
            if not isinstance(release, dict):
                continue

            title = optional_text(release.get("title"))
            release_date = optional_text(release.get("date"))
            release_kind = optional_text(release.get("release_kind"))
            if not title or not release_date or release_kind not in {"single", "album", "ep"}:
                continue

            items.append(
                {
                    "group": row["group"],
                    "release_title": title,
                    "release_date": release_date,
                    "stream": stream,
                    "release_kind": release_kind,
                    "release_group_id": extract_release_group_id(release.get("source")),
                }
            )

    items.sort(
        key=lambda item: (
            item["group"].casefold(),
            item["release_date"],
            item["stream"],
            item["release_title"].casefold(),
        )
    )
    return items


def normalize_tracks(tracks: object) -> List[Dict]:
    normalized_tracks: List[Dict] = []
    for track in tracks or []:
        if not isinstance(track, dict):
            continue

        order = track.get("order")
        title = optional_text(track.get("title"))
        if not isinstance(order, int) or order <= 0 or not title:
            continue

        normalized_track = {"order": order, "title": title}
        if isinstance(track.get("is_title_track"), bool):
            normalized_track["is_title_track"] = track["is_title_track"]
        normalized_tracks.append(normalized_track)

    return normalized_tracks


def has_resolved_youtube_video(detail: Dict) -> bool:
    if optional_text(detail.get("youtube_video_url")) or optional_text(detail.get("youtube_video_id")):
        return True

    status = optional_text(detail.get("youtube_video_status"))
    return status in {
        YOUTUBE_VIDEO_STATUS_RELATION,
        YOUTUBE_VIDEO_STATUS_MANUAL,
        YOUTUBE_VIDEO_STATUS_REVIEW,
        YOUTUBE_VIDEO_STATUS_NO_MV,
    }


def build_placeholder_note(item: Dict) -> str:
    return (
        "Historical release-detail seed generated from releaseHistory.json. "
        "Detailed track and service metadata remain unresolved."
    )


def is_placeholder_like_detail(detail: Dict, item: Dict) -> bool:
    return (
        not normalize_tracks(detail.get("tracks"))
        and optional_text(detail.get("spotify_url")) is None
        and optional_text(detail.get("youtube_music_url")) is None
        and optional_text(detail.get("youtube_video_url")) is None
        and optional_text(detail.get("youtube_video_id")) is None
        and (optional_text(detail.get("notes")) or "") == build_placeholder_note(item)
    )


def serialize_candidate_sources(candidates: List[Dict]) -> Optional[str]:
    flattened_sources: List[str] = []
    for candidate in candidates:
        for source in candidate.get("sources", []):
            if source and source not in flattened_sources:
                flattened_sources.append(source)

    if not flattened_sources:
        return None
    return " | ".join(flattened_sources)


def derive_existing_detail_metadata(item: Dict, existing: Dict, is_relaxed_match: bool) -> Tuple[str, Optional[str]]:
    explicit_status = optional_text(existing.get("detail_status"))
    explicit_provenance = optional_text(existing.get("detail_provenance"))
    if explicit_status:
        if (
            explicit_status == DETAIL_STATUS_UNRESOLVED
            and explicit_provenance == "releaseHistory.placeholder_seed"
            and is_placeholder_like_detail(existing, item)
        ):
            return DETAIL_STATUS_INFERRED, "releaseHistory.placeholder_seed"
        return explicit_status, explicit_provenance

    if is_relaxed_match:
        return DETAIL_STATUS_INFERRED, "releaseDetails.relaxed_date_match"

    if is_placeholder_like_detail(existing, item):
        return DETAIL_STATUS_INFERRED, "releaseHistory.placeholder_seed"

    return DETAIL_STATUS_VERIFIED, "releaseDetails.existing_row"


def derive_existing_mv_provenance(item: Dict, existing: Dict, youtube_video_status: str) -> Optional[str]:
    explicit_provenance = optional_text(existing.get("youtube_video_provenance"))
    if explicit_provenance:
        return explicit_provenance

    if youtube_video_status == YOUTUBE_VIDEO_STATUS_RELATION and (
        optional_text(existing.get("youtube_video_url")) or optional_text(existing.get("youtube_video_id"))
    ):
        return "releaseDetails.youtube_video_url"

    if youtube_video_status == YOUTUBE_VIDEO_STATUS_UNRESOLVED and is_placeholder_like_detail(existing, item):
        return "releaseHistory.placeholder_seed"

    if youtube_video_status == YOUTUBE_VIDEO_STATUS_UNRESOLVED:
        return "releaseDetails.no_mv_signal"

    return None


def derive_title_track_metadata(status: str, selected_titles: List[str], candidates: List[Dict]) -> Tuple[str, Optional[str]]:
    if status == TITLE_TRACK_STATUS_MANUAL:
        return DETAIL_STATUS_MANUAL, "release_detail_overrides.title_tracks"
    if status == TITLE_TRACK_STATUS_EXISTING:
        return DETAIL_STATUS_VERIFIED, "releaseDetails.existing_title_flags"
    if status in {TITLE_TRACK_STATUS_AUTO_SINGLE, TITLE_TRACK_STATUS_AUTO_DOUBLE}:
        return DETAIL_STATUS_INFERRED, serialize_candidate_sources(candidates) or "title_track_inference"
    if status == TITLE_TRACK_STATUS_REVIEW:
        return DETAIL_STATUS_REVIEW, serialize_candidate_sources(candidates) or "mixed_title_track_candidates"
    if status == TITLE_TRACK_STATUS_NO_TRACKS:
        return DETAIL_STATUS_UNRESOLVED, "no_tracklist"
    if status == TITLE_TRACK_STATUS_UNRESOLVED:
        return DETAIL_STATUS_UNRESOLVED, "no_dependable_title_track_signal"

    if selected_titles:
        return DETAIL_STATUS_VERIFIED, None
    return DETAIL_STATUS_UNRESOLVED, None


def build_empty_detail(item: Dict) -> Dict:
    return {
        "group": item["group"],
        "release_title": item["release_title"],
        "release_date": item["release_date"],
        "stream": item["stream"],
        "release_kind": item["release_kind"],
        "detail_status": DETAIL_STATUS_INFERRED,
        "detail_provenance": "releaseHistory.placeholder_seed",
        "title_track_status": DETAIL_STATUS_UNRESOLVED,
        "title_track_provenance": "no_tracklist",
        "tracks": [],
        "spotify_url": None,
        "youtube_music_url": None,
        "youtube_video_url": None,
        "youtube_video_id": None,
        "youtube_video_status": YOUTUBE_VIDEO_STATUS_UNRESOLVED,
        "youtube_video_provenance": "releaseHistory.placeholder_seed",
        "notes": build_placeholder_note(item),
    }


def parse_iso_date(value: str) -> Optional[date]:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def strip_track_variant_metadata(value: str) -> str:
    without_groups = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", value)
    without_markers = re.sub(
        r"(?i)\b(inst\.?|instrumental|english ver\.?|japanese ver\.?|korean ver\.?|member ver\.?|remix|ver\.?|version)\b",
        " ",
        without_groups,
    )
    without_separators = re.sub(r"[-–—/:]+", " ", without_markers)
    return " ".join(without_separators.split()).strip()


def normalize_base_title(value: str) -> str:
    return normalize_title(strip_track_variant_metadata(value))


def select_preferred_track_title(tracks: List[Dict], normalized_base_title: str) -> Optional[str]:
    if not normalized_base_title:
        return None

    for track in tracks:
        title = optional_text(track.get("title"))
        if title and normalize_title(title) == normalized_base_title:
            return title

    for track in tracks:
        title = optional_text(track.get("title"))
        if title and normalize_base_title(title) == normalized_base_title:
            return title

    return None


def build_song_release_index(items: List[Dict]) -> Dict[str, List[Dict]]:
    index: Dict[str, List[Dict]] = {}
    for item in items:
        if item["stream"] != "song":
            continue

        release_date = parse_iso_date(item["release_date"])
        base_title = normalize_base_title(item["release_title"])
        if release_date is None or not base_title:
            continue

        index.setdefault(item["group"], []).append(
            {
                "title": item["release_title"],
                "release_date": release_date,
                "base_title": base_title,
            }
        )

    return index


def append_title_track_candidate(
    candidates: Dict[str, Dict],
    tracks: List[Dict],
    title: str,
    source: str,
) -> None:
    normalized_base_title = normalize_base_title(title)
    if not normalized_base_title:
        return

    preferred_title = select_preferred_track_title(tracks, normalized_base_title)
    if preferred_title is None:
        return
    if TITLE_TRACK_NON_PROMOTED_PATTERN.search(preferred_title):
        return

    candidate = candidates.setdefault(
        normalized_base_title,
        {"title": preferred_title, "sources": []},
    )
    if source not in candidate["sources"]:
        candidate["sources"].append(source)


def is_song_release_source(source: str) -> bool:
    return source.startswith("nearby_song_release:") or source.startswith("followup_song_release:")


def infer_title_track_resolution(detail: Dict, song_release_index: Dict[str, List[Dict]]) -> Dict:
    tracks = detail.get("tracks", [])
    if not tracks:
        return {
            "status": TITLE_TRACK_STATUS_NO_TRACKS,
            "selected_titles": [],
            "candidates": [],
            "reason": "No tracklist is attached to this release detail row.",
        }

    candidates: Dict[str, Dict] = {}
    review_reasons: List[str] = []

    if len(tracks) == 1:
        append_title_track_candidate(candidates, tracks, tracks[0]["title"], "single_track_release")

    normalized_release_title = normalize_title(detail.get("release_title", ""))
    exact_matches = [
        track["title"]
        for track in tracks
        if normalize_title(track.get("title", "")) == normalized_release_title
    ]
    if len(exact_matches) == 1:
        append_title_track_candidate(candidates, tracks, exact_matches[0], "release_title_exact")

    if detail.get("stream") == "song":
        base_title_groups: Dict[str, List[str]] = {}
        for track in tracks:
            title = optional_text(track.get("title"))
            if not title:
                continue

            base_title = normalize_base_title(title)
            if not base_title:
                continue

            base_title_groups.setdefault(base_title, []).append(title)

        if len(base_title_groups) == 1:
            only_base_title = next(iter(base_title_groups))
            preferred_title = select_preferred_track_title(tracks, only_base_title)
            if preferred_title:
                append_title_track_candidate(candidates, tracks, preferred_title, "song_variant_collapse")

    normalized_release_base_title = normalize_base_title(detail.get("release_title", ""))
    substring_candidates: List[str] = []
    if len(normalized_release_base_title) >= 5:
        seen_substring_keys = set()
        for track in tracks:
            title = optional_text(track.get("title"))
            if not title:
                continue

            base_title = normalize_base_title(title)
            if (
                len(base_title) >= 4
                and base_title not in seen_substring_keys
                and (base_title in normalized_release_base_title or normalized_release_base_title in base_title)
            ):
                seen_substring_keys.add(base_title)
                substring_candidates.append(title)

        if len(substring_candidates) == 1:
            append_title_track_candidate(candidates, tracks, substring_candidates[0], "release_title_substring")
        elif len(substring_candidates) == 2 and "/" in (detail.get("release_title") or ""):
            for title in substring_candidates:
                append_title_track_candidate(candidates, tracks, title, "release_title_substring")
        elif len(substring_candidates) > 2:
            review_reasons.append("More than two substring-based title-track candidates were found.")

    detail_release_date = parse_iso_date(detail.get("release_date", ""))
    if detail_release_date is not None:
        track_title_by_base_title = {
            normalize_base_title(track.get("title", "")): track["title"]
            for track in tracks
            if normalize_base_title(track.get("title", ""))
        }
        nearby_song_matches: List[Tuple[int, str, str]] = []
        followup_song_matches: List[Tuple[int, str, str]] = []
        for song_release in song_release_index.get(detail["group"], []):
            delta_days = (detail_release_date - song_release["release_date"]).days
            candidate_track_title = track_title_by_base_title.get(song_release["base_title"])
            if candidate_track_title is None:
                continue

            if 0 <= delta_days <= 180:
                nearby_song_matches.append(
                    (
                        delta_days,
                        candidate_track_title,
                        song_release["release_date"].isoformat(),
                    )
                )
            elif 0 < -delta_days <= FOLLOWUP_SONG_RELEASE_MAX_DAYS:
                followup_song_matches.append(
                    (
                        abs(delta_days),
                        candidate_track_title,
                        song_release["release_date"].isoformat(),
                    )
                )

        nearby_song_matches.sort()
        unique_nearby_matches: List[Tuple[str, str]] = []
        seen_nearby_keys = set()
        for _, title, release_date_text in nearby_song_matches:
            base_title = normalize_base_title(title)
            if base_title in seen_nearby_keys:
                continue
            seen_nearby_keys.add(base_title)
            unique_nearby_matches.append((title, release_date_text))

        if 1 <= len(unique_nearby_matches) <= 2:
            for title, release_date_text in unique_nearby_matches:
                append_title_track_candidate(
                    candidates,
                    tracks,
                    title,
                    f"nearby_song_release:{release_date_text}",
                )
        elif len(unique_nearby_matches) > 2:
            review_reasons.append("More than two nearby song-release title-track candidates were found.")

        followup_song_matches.sort()
        unique_followup_matches: List[Tuple[str, str]] = []
        seen_followup_keys = set()
        for _, title, release_date_text in followup_song_matches:
            base_title = normalize_base_title(title)
            if base_title in seen_followup_keys:
                continue
            seen_followup_keys.add(base_title)
            unique_followup_matches.append((title, release_date_text))

        if not unique_nearby_matches and 1 <= len(unique_followup_matches) <= 2:
            for title, release_date_text in unique_followup_matches:
                append_title_track_candidate(
                    candidates,
                    tracks,
                    title,
                    f"followup_song_release:{release_date_text}",
                )
        elif len(unique_followup_matches) > 2:
            review_reasons.append("More than two follow-up song-release title-track candidates were found.")

    candidate_rows = sorted(candidates.values(), key=lambda row: row["title"].casefold())
    if not candidate_rows:
        if review_reasons:
            return {
                "status": TITLE_TRACK_STATUS_REVIEW,
                "selected_titles": [],
                "candidates": [],
                "reason": " ".join(review_reasons),
            }

        return {
            "status": TITLE_TRACK_STATUS_UNRESOLVED,
            "selected_titles": [],
            "candidates": [],
            "reason": "No dependable title-track signal was found for this release detail row.",
        }

    if len(candidate_rows) == 1:
        return {
            "status": TITLE_TRACK_STATUS_AUTO_SINGLE,
            "selected_titles": [candidate_rows[0]["title"]],
            "candidates": candidate_rows,
            "reason": "A single dependable title-track candidate was inferred automatically.",
        }

    if len(candidate_rows) == 2:
        exact_or_substring_candidates = [
            candidate
            for candidate in candidate_rows
            if "release_title_exact" in candidate["sources"] or "release_title_substring" in candidate["sources"]
        ]
        song_release_only_candidates = [
            candidate
            for candidate in candidate_rows
            if candidate["sources"]
            and all(is_song_release_source(source) for source in candidate["sources"])
        ]
        if len(exact_or_substring_candidates) == 1 and len(song_release_only_candidates) == 1:
            preferred_candidate = exact_or_substring_candidates[0]
            return {
                "status": TITLE_TRACK_STATUS_AUTO_SINGLE,
                "selected_titles": [preferred_candidate["title"]],
                "candidates": candidate_rows,
                "reason": "Release-title evidence outranked a song-release fallback, so the title track was resolved automatically.",
            }

        all_nearby_song_resolved = all(
            candidate["sources"]
            and all(is_song_release_source(source) for source in candidate["sources"])
            for candidate in candidate_rows
        )
        slash_title_pair = "/" in (detail.get("release_title") or "") and all(
            "release_title_substring" in candidate["sources"]
            for candidate in candidate_rows
        )
        if all_nearby_song_resolved or slash_title_pair:
            return {
                "status": TITLE_TRACK_STATUS_AUTO_DOUBLE,
                "selected_titles": [candidate["title"] for candidate in candidate_rows],
                "candidates": candidate_rows,
                "reason": "Two title tracks were inferred automatically from dependable paired evidence.",
            }

        return {
            "status": TITLE_TRACK_STATUS_REVIEW,
            "selected_titles": [],
            "candidates": candidate_rows,
            "reason": "Multiple title-track candidates were found, but the evidence mix requires a manual override.",
        }

    return {
        "status": TITLE_TRACK_STATUS_REVIEW,
        "selected_titles": [],
        "candidates": candidate_rows,
        "reason": "More than two title-track candidates were found, so the row must stay in manual review.",
    }


def select_relaxed_existing_detail(item: Dict, candidates: List[Dict]) -> Optional[Dict]:
    item_date = parse_iso_date(item["release_date"])
    if item_date is None:
        return None

    best_match: Optional[Dict] = None
    best_distance: Optional[int] = None
    for candidate in candidates:
        candidate_date = parse_iso_date(candidate["release_date"])
        if candidate_date is None:
            continue

        distance = abs((item_date - candidate_date).days)
        if best_distance is None or distance < best_distance:
            best_match = candidate
            best_distance = distance

    if best_distance is None or best_distance > 7:
        return None
    return best_match


def normalize_existing_detail(item: Dict, existing: Dict, is_relaxed_match: bool) -> Dict:
    youtube_video_url = optional_text(existing.get("youtube_video_url"))
    youtube_video_id = optional_text(existing.get("youtube_video_id"))
    if youtube_video_id is None and youtube_video_url:
        youtube_video_id = extract_youtube_video_id(youtube_video_url)
    if youtube_video_url is None and youtube_video_id:
        youtube_video_url = build_youtube_video_url(youtube_video_id)

    youtube_video_status = optional_text(existing.get("youtube_video_status"))
    if youtube_video_status is None:
        youtube_video_status = (
            YOUTUBE_VIDEO_STATUS_RELATION if youtube_video_url or youtube_video_id else YOUTUBE_VIDEO_STATUS_UNRESOLVED
        )
    detail_status, detail_provenance = derive_existing_detail_metadata(item, existing, is_relaxed_match)

    return {
        "group": item["group"],
        "release_title": item["release_title"],
        "release_date": item["release_date"],
        "stream": item["stream"],
        "release_kind": item["release_kind"],
        "detail_status": detail_status,
        "detail_provenance": detail_provenance,
        "title_track_status": optional_text(existing.get("title_track_status")),
        "title_track_provenance": optional_text(existing.get("title_track_provenance")),
        "tracks": normalize_tracks(existing.get("tracks")),
        "spotify_url": optional_text(existing.get("spotify_url")),
        "youtube_music_url": optional_text(existing.get("youtube_music_url")),
        "youtube_video_url": youtube_video_url,
        "youtube_video_id": youtube_video_id,
        "youtube_video_status": youtube_video_status,
        "youtube_video_provenance": derive_existing_mv_provenance(item, existing, youtube_video_status),
        "notes": optional_text(existing.get("notes")) or build_placeholder_note(item),
    }


def mark_title_tracks(tracks: List[Dict], title_track_titles: List[str]) -> List[Dict]:
    if not tracks:
        return tracks

    normalized_titles = [normalize_title(title) for title in title_track_titles if title]
    wanted_titles = {title for title in normalized_titles if title}
    if not wanted_titles:
        return tracks

    matched_titles = {
        normalize_title(track.get("title", ""))
        for track in tracks
        if normalize_title(track.get("title", "")) in wanted_titles
    }
    if not matched_titles:
        return tracks

    seen_titles: set[str] = set()
    flagged_tracks: List[Dict] = []
    for track in tracks:
        normalized_track_title = normalize_title(track.get("title", ""))
        is_title_track = False
        if normalized_track_title in matched_titles and normalized_track_title not in seen_titles:
            is_title_track = True
            seen_titles.add(normalized_track_title)

        flagged_tracks.append(
            {
                **track,
                "is_title_track": is_title_track,
            }
        )

    return flagged_tracks


def apply_detail_override(
    detail: Dict,
    override_by_key: Dict[str, Dict],
    song_release_index: Dict[str, List[Dict]],
) -> Tuple[Dict, bool, Dict]:
    override = override_by_key.get(
        get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
    )
    if override:
        override_tracks = normalize_tracks(override.get("tracks"))
        override_detail_status = optional_text(override.get("detail_status"))
        override_detail_provenance = optional_text(override.get("detail_provenance"))
        if override_tracks:
            detail["tracks"] = override_tracks
            if not override_detail_status:
                override_detail_status = DETAIL_STATUS_MANUAL
            if not override_detail_provenance:
                override_detail_provenance = "release_detail_overrides.tracks"

        if override_detail_status:
            detail["detail_status"] = override_detail_status
            detail["detail_provenance"] = override_detail_provenance
            detail_note = (
                f" Release detail metadata was supplied explicitly from release_detail_overrides.json"
                f" ({override_detail_provenance or override_detail_status})."
            )
            if detail_note not in detail["notes"]:
                detail["notes"] += detail_note

        spotify_url = optional_text(override.get("spotify_url"))
        override_spotify_status = optional_text(override.get("spotify_status"))
        if spotify_url:
            detail["spotify_url"] = spotify_url
            spotify_provenance = optional_text(override.get("spotify_provenance")) or optional_text(override.get("provenance"))
            if spotify_provenance and spotify_provenance not in detail["notes"]:
                detail["notes"] += f" Canonical Spotify URL preserved from release_detail_overrides.json ({spotify_provenance})."
        elif override_spotify_status in {"no_link", "needs_review"}:
            detail["spotify_url"] = None

        youtube_music_url = optional_text(override.get("youtube_music_url"))
        override_youtube_music_status = optional_text(override.get("youtube_music_status"))
        if youtube_music_url:
            detail["youtube_music_url"] = youtube_music_url
        elif override_youtube_music_status in {"no_link", "needs_review"}:
            detail["youtube_music_url"] = None

        provenance = optional_text(override.get("youtube_music_provenance")) or optional_text(override.get("provenance"))
        if youtube_music_url and provenance and provenance not in detail["notes"]:
            detail["notes"] += f" Canonical YouTube Music URL preserved from release_detail_overrides.json ({provenance})."
        elif override_youtube_music_status in {"no_link", "needs_review"} and provenance and provenance not in detail["notes"]:
            detail["notes"] += f" YouTube Music curation status preserved from release_detail_overrides.json ({provenance})."

        youtube_video_url = optional_text(override.get("youtube_video_url"))
        youtube_video_id = optional_text(override.get("youtube_video_id"))
        override_video_status = optional_text(override.get("youtube_video_status"))
        override_review_reason = optional_text(override.get("youtube_video_review_reason"))
        if youtube_video_url or youtube_video_id:
            resolved_video_id = youtube_video_id or extract_youtube_video_id(youtube_video_url or "")
            if resolved_video_id:
                detail["youtube_video_id"] = resolved_video_id
                detail["youtube_video_url"] = youtube_video_url or build_youtube_video_url(resolved_video_id)
                video_provenance = optional_text(override.get("youtube_video_provenance")) or "curated official YouTube watch URL"
                detail["youtube_video_status"] = YOUTUBE_VIDEO_STATUS_MANUAL
                detail["youtube_video_provenance"] = video_provenance
                video_note = f" Canonical YouTube MV preserved from release_detail_overrides.json ({video_provenance})."
                if video_note not in detail["notes"]:
                    detail["notes"] += video_note
        elif override_video_status == YOUTUBE_VIDEO_STATUS_NO_MV:
            detail["youtube_video_id"] = None
            detail["youtube_video_url"] = None
            detail["youtube_video_status"] = YOUTUBE_VIDEO_STATUS_NO_MV
            detail["youtube_video_provenance"] = optional_text(override.get("youtube_video_provenance"))
        elif override_video_status == YOUTUBE_VIDEO_STATUS_REVIEW:
            detail["youtube_video_id"] = None
            detail["youtube_video_url"] = None
            detail["youtube_video_status"] = YOUTUBE_VIDEO_STATUS_REVIEW
            detail["youtube_video_provenance"] = override_review_reason or optional_text(
                override.get("youtube_video_provenance")
            )

    title_track_titles = override.get("title_tracks") if override else None
    override_title_track_status = optional_text(override.get("title_track_status")) if override else None
    override_title_track_review_reason = optional_text(override.get("title_track_review_reason")) if override else None
    existing_title_tracks = [track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")]
    unique_existing_title_tracks = list(dict.fromkeys(existing_title_tracks))
    existing_title_tracks_are_ambiguous = (
        len(existing_title_tracks) != len(unique_existing_title_tracks)
        or len(unique_existing_title_tracks) > 2
    )
    if existing_title_tracks_are_ambiguous:
        detail["tracks"] = [
            {
                **track,
                "is_title_track": False,
            }
            for track in detail.get("tracks", [])
        ]
    if title_track_titles:
        detail["tracks"] = mark_title_tracks(detail.get("tracks", []), title_track_titles)
        title_track_resolution = {
            "status": TITLE_TRACK_STATUS_MANUAL,
            "selected_titles": title_track_titles,
            "candidates": [
                {"title": title, "sources": ["release_detail_overrides.json"]}
                for title in title_track_titles
            ],
            "reason": "Title-track metadata was supplied explicitly from release_detail_overrides.json.",
        }
    elif override_title_track_status in {TITLE_TRACK_STATUS_REVIEW, TITLE_TRACK_STATUS_UNRESOLVED, TITLE_TRACK_STATUS_NO_TRACKS}:
        title_track_resolution = {
            "status": override_title_track_status,
            "selected_titles": [],
            "candidates": [],
            "reason": override_title_track_review_reason
            or "Title-track manual curation kept this release unresolved.",
        }
    elif existing_title_tracks and not existing_title_tracks_are_ambiguous:
        title_track_resolution = {
            "status": TITLE_TRACK_STATUS_EXISTING,
            "selected_titles": unique_existing_title_tracks,
            "candidates": [],
            "reason": "Existing release-detail row already contained title-track flags.",
        }
    else:
        title_track_resolution = infer_title_track_resolution(detail, song_release_index)
        if title_track_resolution["selected_titles"]:
            detail["tracks"] = mark_title_tracks(detail.get("tracks", []), title_track_resolution["selected_titles"])

    title_track_status, title_track_provenance = derive_title_track_metadata(
        title_track_resolution["status"],
        title_track_resolution["selected_titles"],
        title_track_resolution["candidates"],
    )
    detail["title_track_status"] = title_track_status
    detail["title_track_provenance"] = title_track_provenance

    return detail, bool(override), title_track_resolution


def build_title_track_review_rows(details_after: List[Dict], title_track_resolutions: List[Dict]) -> List[Dict]:
    details_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }
    review_rows: List[Dict] = []
    for resolution in title_track_resolutions:
        if resolution["status"] not in {TITLE_TRACK_STATUS_REVIEW, TITLE_TRACK_STATUS_UNRESOLVED}:
            continue

        detail = details_by_key[resolution["key"]]
        review_rows.append(
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "release_kind": detail["release_kind"],
                "track_titles": [track["title"] for track in detail.get("tracks", [])],
                "candidate_titles": [candidate["title"] for candidate in resolution["candidates"]],
                "candidate_sources": [
                    f"{candidate['title']}: {' | '.join(candidate['sources'])}"
                    for candidate in resolution["candidates"]
                ],
                "review_reason": resolution["reason"],
                "recommended_action": (
                    "Confirm the promoted track(s) from a dependable source, then add explicit "
                    "title_tracks to release_detail_overrides.json."
                ),
            }
        )

    review_rows.sort(
        key=lambda row: (
            row["group"].casefold(),
            row["release_date"],
            row["stream"],
            row["release_title"].casefold(),
        )
    )
    return review_rows


def write_title_track_review_queue(review_rows: List[Dict]) -> None:
    TITLE_TRACK_REVIEW_JSON_PATH.write_text(
        json.dumps(review_rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    with TITLE_TRACK_REVIEW_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "release_title",
                "release_date",
                "stream",
                "release_kind",
                "track_titles",
                "candidate_titles",
                "candidate_sources",
                "review_reason",
                "recommended_action",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in review_rows:
            output = dict(row)
            output["track_titles"] = " ; ".join(output["track_titles"])
            output["candidate_titles"] = " ; ".join(output["candidate_titles"])
            output["candidate_sources"] = " ; ".join(output["candidate_sources"])
            writer.writerow(output)


def build_release_detail_review_rows(details_after: List[Dict], acquisition_traces: List[Dict]) -> List[Dict]:
    details_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }
    review_rows: List[Dict] = []
    for trace in acquisition_traces:
        missing_fields_after = trace["missing_fields_after"]
        if not missing_fields_after:
            continue

        detail = details_by_key[trace["key"]]
        attempts = trace["attempts"]
        attempted_methods = [attempt["method"] for attempt in attempts]
        review_rows.append(
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "release_kind": detail["release_kind"],
                "missing_fields": missing_fields_after,
                "attempted_methods_count": len({attempt["method"] for attempt in attempts}),
                "attempted_methods": attempted_methods,
                "attempts": attempts,
                "compliant_min_attempts": len({attempt["method"] for attempt in attempts}) >= MIN_ACQUISITION_ATTEMPTS,
                "recommended_action": (
                    "Escalate to manual verification only after checking dependable official or platform sources for "
                    "the remaining null fields."
                ),
            }
        )

    review_rows.sort(
        key=lambda row: (
            row["group"].casefold(),
            row["release_date"],
            row["stream"],
            row["release_title"].casefold(),
        )
    )
    return review_rows


def write_release_detail_review_queue(review_rows: List[Dict]) -> None:
    DETAIL_REVIEW_JSON_PATH.write_text(
        json.dumps(review_rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    with DETAIL_REVIEW_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "release_title",
                "release_date",
                "stream",
                "release_kind",
                "missing_fields",
                "attempted_methods_count",
                "attempted_methods",
                "compliant_min_attempts",
                "recommended_action",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in review_rows:
            output = dict(row)
            output["missing_fields"] = " ; ".join(output["missing_fields"])
            output["attempted_methods"] = " ; ".join(output["attempted_methods"])
            output.pop("attempts", None)
            writer.writerow(output)


def build_title_track_spot_checks(details_after: List[Dict], title_track_resolutions: List[Dict]) -> List[Dict]:
    details_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }

    buckets = {
        "auto_double": [],
        "auto_single": [],
        "review": [],
        "unresolved": [],
        "existing_older": [],
        "manual": [],
    }
    for resolution in title_track_resolutions:
        detail = details_by_key[resolution["key"]]
        sample = {
            "group": detail["group"],
            "release_title": detail["release_title"],
            "release_date": detail["release_date"],
            "stream": detail["stream"],
            "release_kind": detail["release_kind"],
            "status": resolution["status"],
            "title_tracks": [
                track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")
            ],
            "candidate_titles": [candidate["title"] for candidate in resolution["candidates"]],
        }
        if resolution["status"] == TITLE_TRACK_STATUS_AUTO_DOUBLE:
            buckets["auto_double"].append(sample)
        elif resolution["status"] == TITLE_TRACK_STATUS_AUTO_SINGLE:
            buckets["auto_single"].append(sample)
        elif resolution["status"] == TITLE_TRACK_STATUS_REVIEW:
            buckets["review"].append(sample)
        elif resolution["status"] == TITLE_TRACK_STATUS_UNRESOLVED:
            buckets["unresolved"].append(sample)
        elif resolution["status"] == TITLE_TRACK_STATUS_MANUAL:
            buckets["manual"].append(sample)
        elif resolution["status"] == TITLE_TRACK_STATUS_EXISTING and detail["release_date"] <= "2024-12-31":
            buckets["existing_older"].append(sample)

    ordered_samples: List[Dict] = []
    for key, limit in (
        ("auto_double", 5),
        ("auto_single", 10),
        ("review", 5),
        ("unresolved", 5),
        ("existing_older", 8),
        ("manual", 4),
    ):
        ordered_samples.extend(buckets[key][:limit])

    unique_samples: List[Dict] = []
    seen_keys = set()
    for sample in ordered_samples:
        sample_key = get_detail_key(
            sample["group"],
            sample["release_title"],
            sample["release_date"],
            sample["stream"],
        )
        if sample_key in seen_keys:
            continue
        seen_keys.add(sample_key)
        unique_samples.append(sample)
        if len(unique_samples) >= 25:
            break

    if len(unique_samples) < 25:
        for resolution in title_track_resolutions:
            detail = details_by_key[resolution["key"]]
            if not detail.get("tracks"):
                continue

            sample = {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "release_kind": detail["release_kind"],
                "status": resolution["status"],
                "title_tracks": [
                    track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")
                ],
                "candidate_titles": [candidate["title"] for candidate in resolution["candidates"]],
            }
            sample_key = get_detail_key(
                sample["group"],
                sample["release_title"],
                sample["release_date"],
                sample["stream"],
            )
            if sample_key in seen_keys:
                continue
            seen_keys.add(sample_key)
            unique_samples.append(sample)
            if len(unique_samples) >= 25:
                break

    return unique_samples


def build_verification_state_samples(details_after: List[Dict]) -> Dict[str, Optional[Dict]]:
    def build_sample(row: Dict) -> Dict:
        return build_release_row_sample(row)

    def first_match(predicate) -> Optional[Dict]:
        for row in details_after:
            if predicate(row):
                return build_sample(row)
        return None

    return {
        "verified": first_match(lambda row: row.get("detail_status") == DETAIL_STATUS_VERIFIED),
        "inferred": first_match(
            lambda row: row.get("detail_status") == DETAIL_STATUS_INFERRED
            or row.get("title_track_status") == DETAIL_STATUS_INFERRED
        ),
        "manual_override": first_match(lambda row: row.get("title_track_status") == DETAIL_STATUS_MANUAL)
        or first_match(lambda row: row.get("youtube_video_status") == YOUTUBE_VIDEO_STATUS_MANUAL),
        "relation_derived_mv": first_match(lambda row: row.get("youtube_video_status") == YOUTUBE_VIDEO_STATUS_RELATION),
        "review_needed": first_match(
            lambda row: row.get("title_track_status") == DETAIL_STATUS_REVIEW
            or row.get("youtube_video_status") == YOUTUBE_VIDEO_STATUS_REVIEW
        ),
        "unresolved": first_match(
            lambda row: row.get("detail_status") == DETAIL_STATUS_UNRESOLVED
            or row.get("title_track_status") == DETAIL_STATUS_UNRESOLVED
            or row.get("youtube_video_status") == YOUTUBE_VIDEO_STATUS_UNRESOLVED
        ),
    }


def build_release_row_sample(row: Dict) -> Dict:
    return {
        "group": row["group"],
        "release_title": row["release_title"],
        "release_date": row["release_date"],
        "stream": row["stream"],
        "release_kind": row.get("release_kind"),
        "detail_status": row.get("detail_status"),
        "detail_provenance": row.get("detail_provenance"),
        "title_track_status": row.get("title_track_status"),
        "title_track_provenance": row.get("title_track_provenance"),
        "youtube_video_status": row.get("youtube_video_status"),
        "youtube_video_provenance": row.get("youtube_video_provenance"),
        "title_tracks": [track["title"] for track in row.get("tracks", []) if track.get("is_title_track")],
        "track_count": len(row.get("tracks", [])),
    }


def ratio(count: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(count / total, 4)


def format_percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def build_slice_metrics(rows: List[Dict]) -> Dict:
    total_rows = len(rows)
    detail_statuses = [optional_text(row.get("detail_status")) or DETAIL_STATUS_UNRESOLVED for row in rows]
    title_track_statuses = [optional_text(row.get("title_track_status")) or DETAIL_STATUS_UNRESOLVED for row in rows]
    youtube_video_statuses = [
        optional_text(row.get("youtube_video_status")) or YOUTUBE_VIDEO_STATUS_UNRESOLVED for row in rows
    ]

    detail_payload_rows = total_rows
    detail_trusted_rows = sum(status in DETAIL_TRUSTED_STATUSES for status in detail_statuses)
    detail_inferred_rows = sum(status == DETAIL_STATUS_INFERRED for status in detail_statuses)
    detail_review_rows = sum(status == DETAIL_STATUS_REVIEW for status in detail_statuses)
    detail_unresolved_rows = sum(status == DETAIL_STATUS_UNRESOLVED for status in detail_statuses)

    title_track_resolved_rows = sum(status in TITLE_TRACK_COMPLETE_STATUSES for status in title_track_statuses)
    title_track_review_rows = sum(status == DETAIL_STATUS_REVIEW for status in title_track_statuses)
    title_track_unresolved_rows = sum(status == DETAIL_STATUS_UNRESOLVED for status in title_track_statuses)

    canonical_mv_rows = sum(status in MV_COMPLETE_STATUSES for status in youtube_video_statuses)
    mv_review_rows = sum(status == YOUTUBE_VIDEO_STATUS_REVIEW for status in youtube_video_statuses)
    mv_unresolved_rows = sum(status == YOUTUBE_VIDEO_STATUS_UNRESOLVED for status in youtube_video_statuses)
    mv_no_mv_rows = sum(status == YOUTUBE_VIDEO_STATUS_NO_MV for status in youtube_video_statuses)

    return {
        "total_rows": total_rows,
        "detail_payload_rows": detail_payload_rows,
        "detail_payload_ratio": ratio(detail_payload_rows, total_rows),
        "detail_trusted_rows": detail_trusted_rows,
        "detail_trusted_ratio": ratio(detail_trusted_rows, total_rows),
        "detail_inferred_rows": detail_inferred_rows,
        "detail_inferred_ratio": ratio(detail_inferred_rows, total_rows),
        "detail_review_rows": detail_review_rows,
        "detail_review_ratio": ratio(detail_review_rows, total_rows),
        "detail_unresolved_rows": detail_unresolved_rows,
        "detail_unresolved_ratio": ratio(detail_unresolved_rows, total_rows),
        "title_track_resolved_rows": title_track_resolved_rows,
        "title_track_resolved_ratio": ratio(title_track_resolved_rows, total_rows),
        "title_track_review_rows": title_track_review_rows,
        "title_track_review_ratio": ratio(title_track_review_rows, total_rows),
        "title_track_unresolved_rows": title_track_unresolved_rows,
        "title_track_unresolved_ratio": ratio(title_track_unresolved_rows, total_rows),
        "canonical_mv_rows": canonical_mv_rows,
        "canonical_mv_ratio": ratio(canonical_mv_rows, total_rows),
        "mv_review_rows": mv_review_rows,
        "mv_review_ratio": ratio(mv_review_rows, total_rows),
        "mv_unresolved_rows": mv_unresolved_rows,
        "mv_unresolved_ratio": ratio(mv_unresolved_rows, total_rows),
        "mv_no_mv_rows": mv_no_mv_rows,
        "mv_no_mv_ratio": ratio(mv_no_mv_rows, total_rows),
    }


def get_year_band(release_date: str) -> str:
    release_year = int(release_date[:4])
    for label, lower, upper in COHORT_YEAR_BANDS:
        if lower is not None and release_year < lower:
            continue
        if upper is not None and release_year > upper:
            continue
        return label
    return COHORT_YEAR_BANDS[-1][0]


def build_breakdown(rows: List[Dict], key_name: str) -> Dict[str, Dict]:
    grouped: Dict[str, List[Dict]] = {}
    for row in rows:
        if key_name == "year":
            key = row["release_date"][:4]
        elif key_name == "release_kind":
            key = row["release_kind"]
        else:
            raise ValueError(f"Unsupported breakdown key: {key_name}")
        grouped.setdefault(key, []).append(row)

    return {
        key: build_slice_metrics(bucket)
        for key, bucket in sorted(grouped.items(), key=lambda item: item[0])
    }


def build_status_cohort_rows(
    rows: List[Dict],
    status_key: str,
    resolved_statuses: set[str],
    review_statuses: set[str],
    target_map: Dict[str, Dict[str, float]],
) -> List[Dict]:
    cohorts: Dict[Tuple[str, str], List[Dict]] = {}
    for row in rows:
        year_band = get_year_band(row["release_date"])
        release_kind = row["release_kind"]
        cohorts.setdefault((year_band, release_kind), []).append(row)

    cohort_rows: List[Dict] = []
    for (year_band, release_kind), bucket in sorted(cohorts.items(), key=lambda item: (item[0][0], item[0][1])):
        statuses = [optional_text(row.get(status_key)) or DETAIL_STATUS_UNRESOLVED for row in bucket]
        resolved_rows = sum(status in resolved_statuses for status in statuses)
        review_rows = sum(status in review_statuses for status in statuses)
        unresolved_rows = len(bucket) - resolved_rows - review_rows
        resolved_ratio = ratio(resolved_rows, len(bucket))
        threshold = target_map.get(year_band, {}).get(release_kind, 0.0)
        cohort_rows.append(
            {
                "year_band": year_band,
                "release_kind": release_kind,
                "total_rows": len(bucket),
                "resolved_rows": resolved_rows,
                "resolved_ratio": resolved_ratio,
                "review_rows": review_rows,
                "review_ratio": ratio(review_rows, len(bucket)),
                "unresolved_rows": unresolved_rows,
                "unresolved_ratio": ratio(unresolved_rows, len(bucket)),
                "threshold": threshold,
                "gap_to_target": round(max(threshold - resolved_ratio, 0.0), 4),
                "status": "pass" if resolved_ratio >= threshold else "fail",
            }
        )

    cohort_rows.sort(
        key=lambda row: (
            row["status"] == "pass",
            -row["gap_to_target"],
            -row["unresolved_rows"],
            row["year_band"],
            row["release_kind"],
        )
    )
    return cohort_rows


def mv_backfill_scope_matches(summary: Dict, execution_scope: Optional[Dict]) -> bool:
    if not execution_scope:
        return True
    summary_scope = summary.get("execution_scope") or {}
    execution_groups = set(execution_scope.get("groups") or [])
    summary_groups = set(summary_scope.get("groups") or [])
    execution_cohorts = set(execution_scope.get("cohorts") or [])
    summary_cohorts = set(summary_scope.get("cohorts") or [])

    if execution_groups and execution_groups != summary_groups:
        return False
    if execution_cohorts and execution_cohorts != summary_cohorts:
        return False
    return True


def build_external_acquisition_summary(
    acquisition_traces: List[Dict],
    details_after: List[Dict],
    execution_scope: Optional[Dict],
) -> Dict:
    details_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }

    candidate_traces = [
        trace
        for trace in acquisition_traces
        if any(field in {"youtube_music_url", "youtube_video"} for field in trace["missing_fields_before"])
    ]
    youtube_music_attempted = 0
    youtube_music_resolved = 0
    youtube_music_unresolved = 0
    youtube_music_out_of_scope = 0
    youtube_mv_attempted = 0
    youtube_mv_resolved = 0
    youtube_mv_review_needed = 0
    youtube_mv_no_mv = 0
    youtube_mv_unresolved = 0
    youtube_mv_out_of_scope = 0

    for trace in candidate_traces:
        detail = details_by_key[trace["key"]]
        attempt_methods = {attempt["method"] for attempt in trace["attempts"]}
        out_of_scope = "external_acquisition_out_of_scope" in attempt_methods

        if "youtube_music_url" in trace["missing_fields_before"]:
            if out_of_scope:
                youtube_music_out_of_scope += 1
            if "musicbrainz_release_group_release_lookup" in attempt_methods or "musicbrainz_release_search_release_lookup" in attempt_methods:
                youtube_music_attempted += 1
            if optional_text(detail.get("youtube_music_url")):
                youtube_music_resolved += 1
            else:
                youtube_music_unresolved += 1

        if "youtube_video" in trace["missing_fields_before"]:
            if out_of_scope:
                youtube_mv_out_of_scope += 1
            if "musicbrainz_release_group_release_lookup" in attempt_methods or "musicbrainz_release_search_release_lookup" in attempt_methods:
                youtube_mv_attempted += 1
            youtube_video_status = optional_text(detail.get("youtube_video_status")) or YOUTUBE_VIDEO_STATUS_UNRESOLVED
            if youtube_video_status in MV_COMPLETE_STATUSES:
                youtube_mv_resolved += 1
            elif youtube_video_status == YOUTUBE_VIDEO_STATUS_REVIEW:
                youtube_mv_review_needed += 1
            elif youtube_video_status == YOUTUBE_VIDEO_STATUS_NO_MV:
                youtube_mv_no_mv += 1
            else:
                youtube_mv_unresolved += 1

    summary = {
        "candidate_rows": len(candidate_traces),
        "youtube_music": {
            "attempted": youtube_music_attempted,
            "resolved": youtube_music_resolved,
            "out_of_scope": youtube_music_out_of_scope,
            "unresolved": youtube_music_unresolved,
        },
        "youtube_mv": {
            "attempted": youtube_mv_attempted,
            "resolved": youtube_mv_resolved,
            "review_needed": youtube_mv_review_needed,
            "no_mv": youtube_mv_no_mv,
            "out_of_scope": youtube_mv_out_of_scope,
            "unresolved": youtube_mv_unresolved,
        },
    }
    mv_backfill_summary = load_optional_rows(MV_COVERAGE_REPORT_PATH)
    if isinstance(mv_backfill_summary, dict) and mv_backfill_scope_matches(mv_backfill_summary, execution_scope):
        summary["youtube_mv_search"] = {
            "attempted": int(mv_backfill_summary.get("attempted_rows") or 0),
            "resolved": int(mv_backfill_summary.get("resolved_now") or 0),
            "review_needed": int(mv_backfill_summary.get("review_row_count") or 0),
            "unresolved": int(mv_backfill_summary.get("unresolved_remainder") or 0),
            "coverage_lift": int(mv_backfill_summary.get("coverage_lift") or 0),
        }
    return summary


def build_top_gap_entities(rows: List[Dict], limit: int = 10) -> Dict[str, List[Dict]]:
    grouped: Dict[str, Dict] = {}
    for row in rows:
        group = row["group"]
        detail_status = optional_text(row.get("detail_status")) or DETAIL_STATUS_UNRESOLVED
        title_track_status = optional_text(row.get("title_track_status")) or DETAIL_STATUS_UNRESOLVED
        youtube_video_status = optional_text(row.get("youtube_video_status")) or YOUTUBE_VIDEO_STATUS_UNRESOLVED

        stats = grouped.setdefault(
            group,
            {
                "group": group,
                "total_rows": 0,
                "detail_gap_rows": 0,
                "title_track_gap_rows": 0,
                "mv_gap_rows": 0,
            },
        )
        stats["total_rows"] += 1
        if detail_status not in DETAIL_TRUSTED_STATUSES:
            stats["detail_gap_rows"] += 1
        if title_track_status not in TITLE_TRACK_COMPLETE_STATUSES:
            stats["title_track_gap_rows"] += 1
        if youtube_video_status not in MV_COMPLETE_STATUSES:
            stats["mv_gap_rows"] += 1

    def top_rows(metric: str) -> List[Dict]:
        ranked = sorted(
            grouped.values(),
            key=lambda row: (-row[metric], -row["total_rows"], row["group"].casefold()),
        )[:limit]
        return [
            {
                **row,
                metric.replace("_rows", "_ratio"): ratio(row[metric], row["total_rows"]),
            }
            for row in ranked
            if row[metric] > 0
        ]

    return {
        "detail": top_rows("detail_gap_rows"),
        "title_track": top_rows("title_track_gap_rows"),
        "mv": top_rows("mv_gap_rows"),
    }


def build_gap_samples(rows: List[Dict], predicate, limit: int = 10) -> List[Dict]:
    samples: List[Dict] = []
    for row in rows:
        if predicate(row):
            samples.append(build_release_row_sample(row))
            if len(samples) >= limit:
                break
    return samples


def build_cutover_gates(overall_metrics: Dict, historical_metrics: Dict) -> Dict:
    gate_specs = {
        "detail_payload": {
            "observed_total": overall_metrics["detail_payload_ratio"],
            "observed_pre_2024": historical_metrics["detail_payload_ratio"],
            "threshold_total": HISTORICAL_COMPLETENESS_THRESHOLDS["detail_payload_total_min"],
            "threshold_pre_2024": HISTORICAL_COMPLETENESS_THRESHOLDS["detail_payload_pre_2024_min"],
        },
        "detail_trusted": {
            "observed_total": overall_metrics["detail_trusted_ratio"],
            "observed_pre_2024": historical_metrics["detail_trusted_ratio"],
            "threshold_total": HISTORICAL_COMPLETENESS_THRESHOLDS["detail_trusted_total_min"],
            "threshold_pre_2024": HISTORICAL_COMPLETENESS_THRESHOLDS["detail_trusted_pre_2024_min"],
        },
        "title_track_resolved": {
            "observed_total": overall_metrics["title_track_resolved_ratio"],
            "observed_pre_2024": historical_metrics["title_track_resolved_ratio"],
            "threshold_total": HISTORICAL_COMPLETENESS_THRESHOLDS["title_track_resolved_total_min"],
            "threshold_pre_2024": HISTORICAL_COMPLETENESS_THRESHOLDS["title_track_resolved_pre_2024_min"],
        },
        "canonical_mv": {
            "observed_total": overall_metrics["canonical_mv_ratio"],
            "observed_pre_2024": historical_metrics["canonical_mv_ratio"],
            "threshold_total": HISTORICAL_COMPLETENESS_THRESHOLDS["canonical_mv_total_min"],
            "threshold_pre_2024": HISTORICAL_COMPLETENESS_THRESHOLDS["canonical_mv_pre_2024_min"],
        },
    }

    gates: Dict[str, Dict] = {}
    for name, spec in gate_specs.items():
        status = "pass"
        if spec["observed_total"] < spec["threshold_total"] or spec["observed_pre_2024"] < spec["threshold_pre_2024"]:
            status = "fail"
        gates[name] = {
            "status": status,
            "observed_total": spec["observed_total"],
            "observed_pre_2024": spec["observed_pre_2024"],
            "threshold_total": spec["threshold_total"],
            "threshold_pre_2024": spec["threshold_pre_2024"],
        }

    cutover_ready = all(gate["status"] == "pass" for gate in gates.values())
    summary_lines = [
        (
            f"detail payload gate: {gates['detail_payload']['status']} "
            f"(total {format_percent(gates['detail_payload']['observed_total'])}, "
            f"pre-2024 {format_percent(gates['detail_payload']['observed_pre_2024'])})"
        ),
        (
            f"detail trusted gate: {gates['detail_trusted']['status']} "
            f"(total {format_percent(gates['detail_trusted']['observed_total'])}, "
            f"pre-2024 {format_percent(gates['detail_trusted']['observed_pre_2024'])})"
        ),
        (
            f"title-track resolved gate: {gates['title_track_resolved']['status']} "
            f"(total {format_percent(gates['title_track_resolved']['observed_total'])}, "
            f"pre-2024 {format_percent(gates['title_track_resolved']['observed_pre_2024'])})"
        ),
        (
            f"canonical MV gate: {gates['canonical_mv']['status']} "
            f"(total {format_percent(gates['canonical_mv']['observed_total'])}, "
            f"pre-2024 {format_percent(gates['canonical_mv']['observed_pre_2024'])})"
        ),
    ]
    return {
        "thresholds": HISTORICAL_COMPLETENESS_THRESHOLDS,
        "gates": gates,
        "cutover_ready": cutover_ready,
        "cutover_status": "pass" if cutover_ready else "fail",
        "generated_at": date.today().isoformat(),
        "summary_lines": summary_lines,
    }


def build_single_slice_gates(metrics: Dict, thresholds: Dict[str, float]) -> Dict:
    gate_specs = {
        "detail_payload": {
            "observed": metrics["detail_payload_ratio"],
            "threshold": thresholds["detail_payload_min"],
        },
        "detail_trusted": {
            "observed": metrics["detail_trusted_ratio"],
            "threshold": thresholds["detail_trusted_min"],
        },
        "title_track_resolved": {
            "observed": metrics["title_track_resolved_ratio"],
            "threshold": thresholds["title_track_resolved_min"],
        },
        "canonical_mv": {
            "observed": metrics["canonical_mv_ratio"],
            "threshold": thresholds["canonical_mv_min"],
        },
    }

    gates: Dict[str, Dict] = {}
    for name, spec in gate_specs.items():
        gates[name] = {
            "status": "pass" if spec["observed"] >= spec["threshold"] else "fail",
            "observed": spec["observed"],
            "threshold": spec["threshold"],
        }

    slice_ready = all(gate["status"] == "pass" for gate in gates.values())
    return {
        "thresholds": thresholds,
        "gates": gates,
        "cutover_ready": slice_ready,
        "cutover_status": "pass" if slice_ready else "fail",
        "generated_at": date.today().isoformat(),
        "summary_lines": [
            f"{name} gate: {gate['status']} ({format_percent(gate['observed'])} vs {format_percent(gate['threshold'])})"
            for name, gate in gates.items()
        ],
    }


def build_migration_priority_slice_report(details_before: List[Dict], details_after: List[Dict]) -> Dict:
    slice_rows = load_migration_priority_slice_rows()
    slice_keys = [
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        for row in slice_rows
    ]
    details_before_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_before
    }
    details_after_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }

    slice_before = [details_before_by_key[key] for key in slice_keys if key in details_before_by_key]
    slice_after = [details_after_by_key[key] for key in slice_keys if key in details_after_by_key]
    missing_before = [row for row, key in zip(slice_rows, slice_keys) if key not in details_before_by_key]
    missing_after = [row for row, key in zip(slice_rows, slice_keys) if key not in details_after_by_key]
    metrics_before = build_slice_metrics(slice_before)
    metrics_after = build_slice_metrics(slice_after)
    gates = build_single_slice_gates(metrics_after, MIGRATION_PRIORITY_SLICE_THRESHOLDS)

    return {
        "label": "migration_critical_first_slice",
        "entity_groups": sorted({row["group"] for row in slice_rows}),
        "expected_rows": len(slice_rows),
        "rows_before": len(slice_before),
        "rows_after": len(slice_after),
        "missing_rows_before": missing_before,
        "missing_rows_after": missing_after,
        "before": metrics_before,
        "after": metrics_after,
        "gates": gates,
        "release_rows": slice_rows,
    }


def build_coverage_summary_lines(
    overall_metrics: Dict,
    historical_metrics: Dict,
    cutover_gates: Dict,
    migration_priority_slice: Dict,
    title_track_review_rows: List[Dict],
    detail_review_rows: List[Dict],
    external_acquisition_summary: Dict,
    title_track_cohorts: List[Dict],
    canonical_mv_cohorts: List[Dict],
) -> List[str]:
    worst_title_track_cohort = next((row for row in title_track_cohorts if row["status"] == "fail"), None)
    worst_mv_cohort = next((row for row in canonical_mv_cohorts if row["status"] == "fail"), None)
    mv_search_summary = external_acquisition_summary.get("youtube_mv_search")
    return [
        (
            f"detail payload coverage: {overall_metrics['detail_payload_rows']}/{overall_metrics['total_rows']} "
            f"({format_percent(overall_metrics['detail_payload_ratio'])}), pre-2024 "
            f"{historical_metrics['detail_payload_rows']}/{historical_metrics['total_rows']} "
            f"({format_percent(historical_metrics['detail_payload_ratio'])})"
        ),
        (
            f"detail trusted coverage: {overall_metrics['detail_trusted_rows']}/{overall_metrics['total_rows']} "
            f"({format_percent(overall_metrics['detail_trusted_ratio'])}), pre-2024 "
            f"{historical_metrics['detail_trusted_rows']}/{historical_metrics['total_rows']} "
            f"({format_percent(historical_metrics['detail_trusted_ratio'])})"
        ),
        (
            f"title-track resolved coverage: {overall_metrics['title_track_resolved_rows']}/{overall_metrics['total_rows']} "
            f"({format_percent(overall_metrics['title_track_resolved_ratio'])}), pre-2024 "
            f"{historical_metrics['title_track_resolved_rows']}/{historical_metrics['total_rows']} "
            f"({format_percent(historical_metrics['title_track_resolved_ratio'])}), review queue {len(title_track_review_rows)}"
        ),
        (
            f"canonical MV coverage: {overall_metrics['canonical_mv_rows']}/{overall_metrics['total_rows']} "
            f"({format_percent(overall_metrics['canonical_mv_ratio'])}), pre-2024 "
            f"{historical_metrics['canonical_mv_rows']}/{historical_metrics['total_rows']} "
            f"({format_percent(historical_metrics['canonical_mv_ratio'])}), mv review {overall_metrics['mv_review_rows']}"
        ),
        (
            f"external acquisition pass: YTM attempted {external_acquisition_summary['youtube_music']['attempted']}, "
            f"resolved {external_acquisition_summary['youtube_music']['resolved']}; MV attempted "
            f"{external_acquisition_summary['youtube_mv']['attempted']}, resolved "
            f"{external_acquisition_summary['youtube_mv']['resolved']}, review "
            f"{external_acquisition_summary['youtube_mv']['review_needed']}"
        ),
        (
            "youtube MV search pass: "
            + (
                f"attempted {mv_search_summary['attempted']}, resolved {mv_search_summary['resolved']}, "
                f"review {mv_search_summary['review_needed']}, unresolved {mv_search_summary['unresolved']}, "
                f"coverage lift +{mv_search_summary['coverage_lift']}"
                if mv_search_summary
                else "not available for this execution scope"
            )
        ),
        (
            f"migration-critical first slice: title-track "
            f"{migration_priority_slice['after']['title_track_resolved_rows']}/{migration_priority_slice['expected_rows']} "
            f"({format_percent(migration_priority_slice['after']['title_track_resolved_ratio'])}), canonical MV "
            f"{migration_priority_slice['after']['canonical_mv_rows']}/{migration_priority_slice['expected_rows']} "
            f"({format_percent(migration_priority_slice['after']['canonical_mv_ratio'])}), gate "
            f"{migration_priority_slice['gates']['cutover_status']}"
        ),
        (
            "worst title-track cohort: "
            + (
                f"{worst_title_track_cohort['year_band']} {worst_title_track_cohort['release_kind']} "
                f"{format_percent(worst_title_track_cohort['resolved_ratio'])} / target "
                f"{format_percent(worst_title_track_cohort['threshold'])}"
                if worst_title_track_cohort
                else "all cohorts passing"
            )
        ),
        (
            "worst canonical MV cohort: "
            + (
                f"{worst_mv_cohort['year_band']} {worst_mv_cohort['release_kind']} "
                f"{format_percent(worst_mv_cohort['resolved_ratio'])} / target "
                f"{format_percent(worst_mv_cohort['threshold'])}"
                if worst_mv_cohort
                else "all cohorts passing"
            )
        ),
        f"release-detail null review queue: {len(detail_review_rows)} rows",
        f"historical catalog cutover gate: {cutover_gates['cutover_status']}",
    ]


def build_coverage_markdown(report: Dict) -> str:
    overall = report["completeness"]["overall"]
    historical = report["completeness"]["pre_2024"]
    gates = report["cutover_gates"]
    priority_slice = report["migration_priority_slice"]
    priority_slice_after = priority_slice["after"]
    priority_slice_before = priority_slice["before"]
    priority_slice_gates = priority_slice["gates"]

    lines = [
        "# Historical Catalog Completeness Summary",
        "",
        f"- generated_at: `{report['generated_at']}`",
        f"- cutover status: `{gates['cutover_status']}`",
        "",
        "## Summary",
        "",
    ]
    lines.extend([f"- {line}" for line in report["summary_lines"]])
    lines.extend(
        [
            "",
            "## Overall Coverage",
            "",
            "| domain | covered | total | ratio |",
            "| --- | ---: | ---: | ---: |",
            f"| detail payload | {overall['detail_payload_rows']} | {overall['total_rows']} | {format_percent(overall['detail_payload_ratio'])} |",
            f"| detail trusted | {overall['detail_trusted_rows']} | {overall['total_rows']} | {format_percent(overall['detail_trusted_ratio'])} |",
            f"| title-track resolved | {overall['title_track_resolved_rows']} | {overall['total_rows']} | {format_percent(overall['title_track_resolved_ratio'])} |",
            f"| canonical MV | {overall['canonical_mv_rows']} | {overall['total_rows']} | {format_percent(overall['canonical_mv_ratio'])} |",
            "",
            "## Pre-2024 Historical Slice",
            "",
            "| domain | covered | total | ratio |",
            "| --- | ---: | ---: | ---: |",
            f"| detail payload | {historical['detail_payload_rows']} | {historical['total_rows']} | {format_percent(historical['detail_payload_ratio'])} |",
            f"| detail trusted | {historical['detail_trusted_rows']} | {historical['total_rows']} | {format_percent(historical['detail_trusted_ratio'])} |",
            f"| title-track resolved | {historical['title_track_resolved_rows']} | {historical['total_rows']} | {format_percent(historical['title_track_resolved_ratio'])} |",
            f"| canonical MV | {historical['canonical_mv_rows']} | {historical['total_rows']} | {format_percent(historical['canonical_mv_ratio'])} |",
            "",
            "## Migration-Critical First Slice",
            "",
            f"- entities: `{', '.join(priority_slice['entity_groups'])}`",
            f"- expected rows: `{priority_slice['expected_rows']}`",
            f"- gate status: `{priority_slice_gates['cutover_status']}`",
            "",
            "| domain | before | after | threshold |",
            "| --- | ---: | ---: | ---: |",
            f"| detail payload | {format_percent(priority_slice_before['detail_payload_ratio'])} | {format_percent(priority_slice_after['detail_payload_ratio'])} | {format_percent(priority_slice_gates['thresholds']['detail_payload_min'])} |",
            f"| detail trusted | {format_percent(priority_slice_before['detail_trusted_ratio'])} | {format_percent(priority_slice_after['detail_trusted_ratio'])} | {format_percent(priority_slice_gates['thresholds']['detail_trusted_min'])} |",
            f"| title-track resolved | {format_percent(priority_slice_before['title_track_resolved_ratio'])} | {format_percent(priority_slice_after['title_track_resolved_ratio'])} | {format_percent(priority_slice_gates['thresholds']['title_track_resolved_min'])} |",
            f"| canonical MV | {format_percent(priority_slice_before['canonical_mv_ratio'])} | {format_percent(priority_slice_after['canonical_mv_ratio'])} | {format_percent(priority_slice_gates['thresholds']['canonical_mv_min'])} |",
            "",
            "## Cutover Gates",
            "",
            "| gate | status | total | threshold | pre-2024 | threshold |",
            "| --- | --- | ---: | ---: | ---: | ---: |",
        ]
    )

    for gate_name, gate in gates["gates"].items():
        lines.append(
            f"| {gate_name} | `{gate['status']}` | {format_percent(gate['observed_total'])} | {format_percent(gate['threshold_total'])} | "
            f"{format_percent(gate['observed_pre_2024'])} | {format_percent(gate['threshold_pre_2024'])} |"
        )

    lines.extend(
        [
            "",
            "## Top Gap Entities (Pre-2024)",
            "",
            "| domain | entity | gap rows | total rows | gap ratio |",
            "| --- | --- | ---: | ---: | ---: |",
        ]
    )
    for domain, rows in report["top_gap_entities"]["pre_2024"].items():
        for row in rows[:5]:
            lines.append(
                f"| {domain} | {row['group']} | {row[f'{domain}_gap_rows' if domain != 'title_track' else 'title_track_gap_rows']} | "
                f"{row['total_rows']} | {format_percent(row[f'{domain}_gap_ratio' if domain != 'title_track' else 'title_track_gap_ratio'])} |"
            )

    lines.extend(
        [
            "",
            "## External Acquisition",
            "",
            f"- YTM attempted: `{report['external_acquisition']['youtube_music']['attempted']}`",
            f"- YTM resolved: `{report['external_acquisition']['youtube_music']['resolved']}`",
            f"- MV attempted: `{report['external_acquisition']['youtube_mv']['attempted']}`",
            f"- MV resolved: `{report['external_acquisition']['youtube_mv']['resolved']}`",
            f"- MV review needed: `{report['external_acquisition']['youtube_mv']['review_needed']}`",
            f"- MV search attempted: `{report['external_acquisition'].get('youtube_mv_search', {}).get('attempted', 0)}`",
            f"- MV search resolved: `{report['external_acquisition'].get('youtube_mv_search', {}).get('resolved', 0)}`",
            f"- MV search review needed: `{report['external_acquisition'].get('youtube_mv_search', {}).get('review_needed', 0)}`",
            f"- MV search unresolved: `{report['external_acquisition'].get('youtube_mv_search', {}).get('unresolved', 0)}`",
            f"- MV search coverage lift: `+{report['external_acquisition'].get('youtube_mv_search', {}).get('coverage_lift', 0)}`",
            "",
            "## Title-Track Worst Cohorts",
            "",
            "| year band | release kind | resolved | total | ratio | target | status |",
            "| --- | --- | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for row in report["cohort_tables"]["title_track"][:10]:
        lines.append(
            f"| {row['year_band']} | {row['release_kind']} | {row['resolved_rows']} | {row['total_rows']} | "
            f"{format_percent(row['resolved_ratio'])} | {format_percent(row['threshold'])} | `{row['status']}` |"
        )

    lines.extend(
        [
            "",
            "## Canonical MV Worst Cohorts",
            "",
            "| year band | release kind | resolved | total | ratio | target | status |",
            "| --- | --- | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for row in report["cohort_tables"]["canonical_mv"][:10]:
        lines.append(
            f"| {row['year_band']} | {row['release_kind']} | {row['resolved_rows']} | {row['total_rows']} | "
            f"{format_percent(row['resolved_ratio'])} | {format_percent(row['threshold'])} | `{row['status']}` |"
        )

    return "\n".join(lines) + "\n"


def build_coverage_report(
    latest_snapshot_items: List[Dict],
    full_catalog_items: List[Dict],
    details_before: List[Dict],
    details_after: List[Dict],
    applied_overrides: int,
    relaxed_match_count: int,
    title_track_resolutions: List[Dict],
    title_track_review_rows: List[Dict],
    acquisition_traces: List[Dict],
    detail_review_rows: List[Dict],
    execution_scope: Optional[Dict],
) -> Dict:
    history_keys = {
        get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        for item in full_catalog_items
    }
    latest_snapshot_keys = {
        get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        for item in latest_snapshot_items
    }
    before_keys = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        for row in details_before
    }
    after_keys = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        for row in details_after
    }

    older_items = [item for item in full_catalog_items if item["release_date"] <= "2023-12-31"]
    missing_before = [item for item in full_catalog_items if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in before_keys]
    missing_after = [item for item in full_catalog_items if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in after_keys]
    missing_before_older = [
        item
        for item in older_items
        if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in before_keys
    ]
    missing_after_older = [
        item
        for item in older_items
        if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in after_keys
    ]

    seeded_rows = [
        row
        for row in details_after
        if row.get("notes") == build_placeholder_note(row)
    ]

    exact_preserved = len(
        [
            item
            for item in full_catalog_items
            if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) in before_keys
        ]
    )
    grouped_input_counts: Dict[str, int] = {}
    for item in full_catalog_items:
        grouped_input_counts[item["group"]] = grouped_input_counts.get(item["group"], 0) + 1
    sample_multi_release_entities = [
        {"group": group, "release_rows": count}
        for group, count in sorted(
            grouped_input_counts.items(),
            key=lambda entry: (-entry[1], entry[0].casefold()),
        )[:10]
    ]
    applied_override_rows = [
        row
        for row in details_after
        if "release_detail_overrides.json" in row.get("notes", "")
    ]
    override_sample_matches = [
        {
            "group": row["group"],
            "release_title": row["release_title"],
            "release_date": row["release_date"],
            "stream": row["stream"],
        }
        for row in applied_override_rows[:10]
    ]
    legacy_spot_check_groups = ["EXO", "BTS", "BLACKPINK", "TWICE", "WJSN", "YUJU"]
    legacy_spot_checks: List[Dict] = []
    for group in legacy_spot_check_groups:
        matches = [
            row
            for row in details_after
            if row["group"] == group and row["release_date"] <= "2023-12-31"
        ]
        sample = matches[0] if matches else None
        legacy_spot_checks.append(
            {
                "group": group,
                "detail_rows_pre_2024_after": len(matches),
                "sample_release_title": sample["release_title"] if sample else None,
                "sample_release_date": sample["release_date"] if sample else None,
                "sample_has_tracks": bool(sample.get("tracks")) if sample else False,
            }
        )

    rows_with_tracks_before = sum(1 for row in details_before if row.get("tracks"))
    rows_with_title_track_before = sum(
        1
        for row in details_before
        if any(track.get("is_title_track") for track in row.get("tracks", []))
    )
    rows_with_tracks_after = sum(1 for row in details_after if row.get("tracks"))
    rows_with_title_track_after = sum(
        1
        for row in details_after
        if any(track.get("is_title_track") for track in row.get("tracks", []))
    )
    details_by_key = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_after
    }
    title_track_status_counts: Dict[str, int] = {}
    for resolution in title_track_resolutions:
        detail = details_by_key.get(resolution["key"])
        if not detail or not detail.get("tracks"):
            continue
        title_track_status_counts[resolution["status"]] = title_track_status_counts.get(resolution["status"], 0) + 1
    title_track_spot_checks = build_title_track_spot_checks(details_after, title_track_resolutions)
    detail_status_counts = dict(
        Counter(optional_text(row.get("detail_status")) or DETAIL_STATUS_UNRESOLVED for row in details_after)
    )
    release_level_title_track_status_counts = dict(
        Counter(optional_text(row.get("title_track_status")) or DETAIL_STATUS_UNRESOLVED for row in details_after)
    )
    youtube_video_status_counts = dict(
        Counter(optional_text(row.get("youtube_video_status")) or YOUTUBE_VIDEO_STATUS_UNRESOLVED for row in details_after)
    )
    verification_state_samples = build_verification_state_samples(details_after)
    overall_metrics_before = build_slice_metrics(details_before)
    overall_metrics_after = build_slice_metrics(details_after)
    historical_rows_after = [row for row in details_after if row["release_date"] <= "2023-12-31"]
    historical_metrics_after = build_slice_metrics(historical_rows_after)
    breakdowns = {
        "by_year": build_breakdown(details_after, "year"),
        "by_release_kind": build_breakdown(details_after, "release_kind"),
    }
    title_track_cohorts = build_status_cohort_rows(
        details_after,
        "title_track_status",
        TITLE_TRACK_COMPLETE_STATUSES,
        {DETAIL_STATUS_REVIEW},
        TITLE_TRACK_COHORT_TARGETS,
    )
    canonical_mv_cohorts = build_status_cohort_rows(
        details_after,
        "youtube_video_status",
        MV_COMPLETE_STATUSES,
        {YOUTUBE_VIDEO_STATUS_REVIEW},
        CANONICAL_MV_COHORT_TARGETS,
    )
    top_gap_entities = {
        "all_time": build_top_gap_entities(details_after),
        "pre_2024": build_top_gap_entities(historical_rows_after),
    }
    gap_samples = {
        "detail_gap_rows": build_gap_samples(
            details_after,
            lambda row: (optional_text(row.get("detail_status")) or DETAIL_STATUS_UNRESOLVED) not in DETAIL_TRUSTED_STATUSES,
        ),
        "title_track_gap_rows": build_gap_samples(
            details_after,
            lambda row: (optional_text(row.get("title_track_status")) or DETAIL_STATUS_UNRESOLVED)
            not in TITLE_TRACK_COMPLETE_STATUSES,
        ),
        "mv_gap_rows": build_gap_samples(
            details_after,
            lambda row: (optional_text(row.get("youtube_video_status")) or YOUTUBE_VIDEO_STATUS_UNRESOLVED)
            not in MV_COMPLETE_STATUSES,
        ),
    }
    cutover_gates = build_cutover_gates(overall_metrics_after, historical_metrics_after)
    migration_priority_slice = build_migration_priority_slice_report(details_before, details_after)
    external_acquisition_summary = build_external_acquisition_summary(acquisition_traces, details_after, execution_scope)
    acquisition_method_counts = dict(
        Counter(
            attempt["method"]
            for trace in acquisition_traces
            for attempt in trace["attempts"]
        )
    )
    rows_with_min_attempts = sum(
        1 for trace in acquisition_traces if len({attempt["method"] for attempt in trace["attempts"]}) >= MIN_ACQUISITION_ATTEMPTS
    )
    summary_lines = build_coverage_summary_lines(
        overall_metrics_after,
        historical_metrics_after,
        cutover_gates,
        migration_priority_slice,
        title_track_review_rows,
        detail_review_rows,
        external_acquisition_summary,
        title_track_cohorts,
        canonical_mv_cohorts,
    )

    return {
        "generated_at": date.today().isoformat(),
        "execution_scope": execution_scope,
        "summary_lines": summary_lines,
        "latest_snapshot_input_rows": len(latest_snapshot_items),
        "latest_snapshot_unique_keys": len(latest_snapshot_keys),
        "full_catalog_input_rows": len(full_catalog_items),
        "full_catalog_unique_keys": len(history_keys),
        "historical_input_gain_rows": len(full_catalog_items) - len(latest_snapshot_items),
        "entities_with_multiple_releases_in_input": sum(1 for count in grouped_input_counts.values() if count > 1),
        "sample_multi_release_entities": sample_multi_release_entities,
        "history_flattened_rows": len(full_catalog_items),
        "detail_rows_before": len(details_before),
        "detail_rows_after": len(details_after),
        "history_keys": len(history_keys),
        "missing_detail_rows_before": len(missing_before),
        "missing_detail_rows_after": len(missing_after),
        "pre_2024_history_rows": len(older_items),
        "pre_2024_missing_before": len(missing_before_older),
        "pre_2024_missing_after": len(missing_after_older),
        "preserved_exact_key_rows": exact_preserved,
        "seeded_placeholder_rows": len(seeded_rows),
        "rows_with_tracks_before": rows_with_tracks_before,
        "rows_with_tracks_after": rows_with_tracks_after,
        "rows_with_title_track_before": rows_with_title_track_before,
        "rows_with_title_track_after": rows_with_title_track_after,
        "rows_without_title_track_before": rows_with_tracks_before - rows_with_title_track_before,
        "rows_without_title_track_after": rows_with_tracks_after - rows_with_title_track_after,
        "completeness": {
            "overall_before": overall_metrics_before,
            "overall": overall_metrics_after,
            "pre_2024": historical_metrics_after,
        },
        "breakdowns": breakdowns,
        "cohort_tables": {
            "title_track": title_track_cohorts,
            "canonical_mv": canonical_mv_cohorts,
        },
        "top_gap_entities": top_gap_entities,
        "gap_samples": gap_samples,
        "cutover_gates": cutover_gates,
        "migration_priority_slice": migration_priority_slice,
        "external_acquisition": external_acquisition_summary,
        "detail_status_counts": detail_status_counts,
        "title_track_status_counts": title_track_status_counts,
        "release_level_title_track_status_counts": release_level_title_track_status_counts,
        "youtube_video_status_counts": youtube_video_status_counts,
        "title_track_auto_resolved_rows": title_track_status_counts.get(TITLE_TRACK_STATUS_AUTO_SINGLE, 0)
        + title_track_status_counts.get(TITLE_TRACK_STATUS_AUTO_DOUBLE, 0),
        "title_track_auto_double_rows": title_track_status_counts.get(TITLE_TRACK_STATUS_AUTO_DOUBLE, 0),
        "title_track_review_queue_rows": len(title_track_review_rows),
        "title_track_review_queue_sample": title_track_review_rows[:10],
        "release_detail_review_queue_rows": len(detail_review_rows),
        "release_detail_review_queue_sample": detail_review_rows[:10],
        "rows_with_min_acquisition_attempts": rows_with_min_attempts,
        "rows_missing_min_acquisition_attempts": len(acquisition_traces) - rows_with_min_attempts,
        "acquisition_method_counts": acquisition_method_counts,
        "title_track_spot_checks": title_track_spot_checks,
        "verification_state_samples": verification_state_samples,
        "rows_with_youtube_music_after": sum(1 for row in details_after if optional_text(row.get("youtube_music_url"))),
        "rows_with_youtube_mv_after": sum(
            1
            for row in details_after
            if optional_text(row.get("youtube_video_url")) or optional_text(row.get("youtube_video_id"))
        ),
        "override_rows_total": len(load_detail_overrides()),
        "applied_overrides": applied_overrides,
        "override_sample_matches": override_sample_matches,
        "remaining_no_detail_rows": missing_after,
        "seed_only_rows": [
            {
                "group": row["group"],
                "release_title": row["release_title"],
                "release_date": row["release_date"],
                "stream": row["stream"],
                "release_kind": row["release_kind"],
            }
            for row in seeded_rows
        ],
        "legacy_spot_checks": legacy_spot_checks,
        "relaxed_existing_matches": relaxed_match_count,
        "preserved_existing_detail_rows_total": exact_preserved + relaxed_match_count,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--skip-acquisition",
        action="store_true",
        help="Reuse existing releaseDetails rows and manual seeds without calling external acquisition lookups.",
    )
    parser.add_argument(
        "--groups",
        help="Comma-separated groups to limit external acquisition attempts while still rebuilding the full release detail snapshot.",
    )
    parser.add_argument(
        "--cohorts",
        help="Comma-separated release cohorts to rebuild (latest,recent,historical). When set, only scoped rows are recomputed and merged back into the full snapshot.",
    )
    parser.add_argument(
        "--max-rows",
        type=parse_positive_int_arg,
        help="Limit the current scoped rebuild to the first N matching rows for safer targeted reruns.",
    )
    parser.add_argument(
        "--row-offset",
        type=parse_non_negative_int_arg,
        default=0,
        help="Skip the first N scoped rows before applying --max-rows for batch-based reruns.",
    )
    parser.add_argument(
        "--progress-every",
        type=parse_positive_int_arg,
        default=25,
        help="Emit stderr progress after every N processed rows during the current pass.",
    )
    args = parser.parse_args()
    scoped_groups = None
    if args.groups:
        scoped_groups = {value.strip() for value in args.groups.split(",") if value.strip()}
    scoped_cohorts = parse_scoped_cohorts(args.cohorts)
    execution_scope = build_execution_scope(scoped_groups, scoped_cohorts)
    reference_date = date.today()

    latest_snapshot_rows = load_rows(RELEASES_SNAPSHOT_PATH)
    history_rows = load_rows(RELEASE_HISTORY_PATH)
    detail_input_path = non_runtime_dataset_paths.resolve_input_path(RELEASE_DETAILS_DATASET)
    details_before = load_rows(detail_input_path) if detail_input_path.exists() else []
    latest_snapshot_items = iter_latest_snapshot_items(latest_snapshot_rows)
    items = iter_release_items(history_rows)
    scoped_items = [
        item
        for item in items
        if matches_execution_scope(item, scoped_groups, scoped_cohorts, reference_date)
    ]
    scoped_latest_snapshot_items = [
        item
        for item in latest_snapshot_items
        if matches_execution_scope(item, scoped_groups, scoped_cohorts, reference_date)
    ]
    total_scoped_rows = len(scoped_items)
    if args.row_offset:
        scoped_items = scoped_items[args.row_offset :]
    if args.max_rows is not None:
        scoped_items = scoped_items[: args.max_rows]
    scoped_keys = {
        get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        for item in scoped_items
    }
    scoped_latest_snapshot_items = [
        item
        for item in scoped_latest_snapshot_items
        if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) in scoped_keys
    ]
    execution_scope = enrich_execution_scope(
        execution_scope,
        total_scoped_rows=total_scoped_rows,
        selected_rows=len(scoped_items),
        max_rows=args.max_rows,
        progress_every=args.progress_every,
        row_offset=args.row_offset,
    )
    print(
        (
            "[build_release_details_musicbrainz] "
            f"processing {len(scoped_items)}/{total_scoped_rows} scoped rows "
            f"(row_offset={args.row_offset}, progress_every={args.progress_every})"
        ),
        file=sys.stderr,
        flush=True,
    )
    song_release_index = build_song_release_index(items)
    existing_details = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in details_before
    }
    relaxed_existing_details: Dict[str, List[Dict]] = {}
    for row in details_before:
        relaxed_existing_details.setdefault(
            get_relaxed_detail_key(row["group"], row["release_title"], row["stream"]),
            [],
        ).append(row)

    override_by_key = load_detail_overrides()
    acquisition_client = MusicBrainzReleaseDetailClient()

    details_after: List[Dict] = []
    title_track_resolutions: List[Dict] = []
    acquisition_traces: List[Dict] = []
    applied_overrides = 0
    relaxed_match_count = 0

    for current_index, item in enumerate(scoped_items, start=1):
        if should_emit_progress(current_index, len(scoped_items), args.progress_every):
            emit_progress("build_release_details_musicbrainz", current_index, len(scoped_items), item)
        attempts: List[Dict] = []
        used_relaxed_match = False
        existing = existing_details.get(
            get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        )
        attempts.append(
            build_attempt(
                "existing_exact_lookup",
                existing is not None,
                note="matched exact release key" if existing is not None else "no exact match",
            )
        )
        if existing is None:
            existing = select_relaxed_existing_detail(
                item,
                relaxed_existing_details.get(
                    get_relaxed_detail_key(item["group"], item["release_title"], item["stream"]),
                    [],
                ),
            )
            if existing is not None:
                relaxed_match_count += 1
                used_relaxed_match = True
        attempts.append(
            build_attempt(
                "existing_relaxed_lookup",
                used_relaxed_match,
                note="matched relaxed ±7 day window" if used_relaxed_match else "no relaxed match",
            )
        )
        attempts.append(
            build_attempt(
                "manual_override_lookup",
                get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) in override_by_key,
                note="override exists" if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) in override_by_key else "no override",
            )
        )
        detail = normalize_existing_detail(item, existing, used_relaxed_match) if existing else build_empty_detail(item)
        missing_fields_before = get_missing_release_detail_fields(detail)
        acquisition_in_scope = scoped_groups is None or item["group"] in scoped_groups
        if not args.skip_acquisition and acquisition_in_scope and get_actionable_release_detail_fields(detail):
            detail, acquisition_attempts = enrich_release_detail(acquisition_client, item, detail)
            attempts.extend(acquisition_attempts)
        elif not args.skip_acquisition and not acquisition_in_scope and get_actionable_release_detail_fields(detail):
            attempts.append(
                build_attempt(
                    "external_acquisition_out_of_scope",
                    False,
                    note="row kept out of the current targeted acquisition pass",
                )
            )
        elif args.skip_acquisition:
            attempts.append(
                build_attempt(
                    "external_acquisition_skipped",
                    False,
                    note="external acquisition skipped by --skip-acquisition",
                )
            )
        detail, was_overridden, title_track_resolution = apply_detail_override(
            detail,
            override_by_key,
            song_release_index,
        )
        attempts.append(
            build_attempt(
                "youtube_music_pipeline_lookup",
                optional_text(detail.get("youtube_music_url")) is not None,
                note=(
                    "canonical YouTube Music URL present"
                    if optional_text(detail.get("youtube_music_url")) is not None
                    else "no canonical YouTube Music URL after current pipeline pass"
                ),
            )
        )
        attempts.append(
            build_attempt(
                "youtube_mv_pipeline_lookup",
                has_resolved_youtube_video(detail),
                note=(
                    f"youtube_video_status={optional_text(detail.get('youtube_video_status')) or YOUTUBE_VIDEO_STATUS_UNRESOLVED}"
                ),
            )
        )
        attempts.append(
            build_attempt(
                "placeholder_seed_fallback",
                detail.get("detail_provenance") == "releaseHistory.placeholder_seed",
                note="placeholder retained" if detail.get("detail_provenance") == "releaseHistory.placeholder_seed" else "placeholder not needed",
            )
        )
        applied_overrides += int(was_overridden)
        details_after.append(detail)
        acquisition_traces.append(
            {
                "key": get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"]),
                "attempts": attempts,
                "missing_fields_before": missing_fields_before,
                "missing_fields_after": get_missing_release_detail_fields(detail),
            }
        )
        title_track_resolutions.append(
            {
                "key": get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"]),
                **title_track_resolution,
            }
        )

    if execution_scope is None:
        details_after = details_after
    else:
        scoped_keys = {
            get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
            for item in scoped_items
        }
        preserved_rows = [
            row
            for row in details_before
            if get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]) not in scoped_keys
        ]
        details_after = preserved_rows + details_after

    details_after.sort(
        key=lambda row: (
            row["group"].casefold(),
            row["release_date"],
            row["stream"],
            row["release_title"].casefold(),
        )
    )

    detail_io_paths = non_runtime_dataset_paths.write_json_dataset(RELEASE_DETAILS_DATASET, details_after)
    title_track_review_rows = build_title_track_review_rows(details_after, title_track_resolutions)
    write_title_track_review_queue(title_track_review_rows)
    detail_review_rows = build_release_detail_review_rows(details_after, acquisition_traces)
    write_release_detail_review_queue(detail_review_rows)

    report_keys = {
        get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        for item in scoped_items
    }
    report_details_before = [
        row
        for row in details_before
        if get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]) in report_keys
    ]
    report_details_after = [
        row
        for row in details_after
        if get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]) in report_keys
    ]

    report = build_coverage_report(
        scoped_latest_snapshot_items,
        scoped_items,
        report_details_before,
        report_details_after,
        applied_overrides,
        relaxed_match_count,
        title_track_resolutions,
        title_track_review_rows,
        acquisition_traces,
        detail_review_rows,
        execution_scope,
    )
    AUDIT_OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    AUDIT_MARKDOWN_OUTPUT_PATH.write_text(build_coverage_markdown(report), encoding="utf-8")

    report["release_snapshot_input_json"] = str(RELEASES_SNAPSHOT_PATH.relative_to(ROOT))
    report["release_history_input_json"] = str(RELEASE_HISTORY_PATH.relative_to(ROOT))
    report["release_detail_input_json"] = str(detail_input_path.relative_to(ROOT))
    report["release_detail_primary_json"] = detail_io_paths["primary_path"]
    report["release_detail_mirror_json"] = detail_io_paths["mirror_paths"]

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
