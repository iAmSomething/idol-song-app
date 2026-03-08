import json
import unicodedata
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
RELEASE_HISTORY_PATH = ROOT / "web/src/data/releaseHistory.json"
OUTPUT_PATH = ROOT / "web/src/data/releaseDetails.json"
OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
AUDIT_OUTPUT_PATH = ROOT / "backend/reports/historical_release_detail_coverage_report.json"

YOUTUBE_VIDEO_STATUS_RELATION = "relation_match"
YOUTUBE_VIDEO_STATUS_MANUAL = "manual_override"
YOUTUBE_VIDEO_STATUS_REVIEW = "needs_review"
YOUTUBE_VIDEO_STATUS_NO_MV = "no_mv"
YOUTUBE_VIDEO_STATUS_UNRESOLVED = "unresolved"


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


def load_detail_overrides() -> Dict[str, Dict]:
    if not OVERRIDES_PATH.exists():
        return {}

    return {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in load_rows(OVERRIDES_PATH)
    }


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


def build_placeholder_note(item: Dict) -> str:
    return (
        "Historical release-detail seed generated from releaseHistory.json. "
        "Detailed track and service metadata remain unresolved."
    )


def build_empty_detail(item: Dict) -> Dict:
    return {
        "group": item["group"],
        "release_title": item["release_title"],
        "release_date": item["release_date"],
        "stream": item["stream"],
        "release_kind": item["release_kind"],
        "tracks": [],
        "spotify_url": None,
        "youtube_music_url": None,
        "youtube_video_url": None,
        "youtube_video_id": None,
        "youtube_video_status": YOUTUBE_VIDEO_STATUS_UNRESOLVED,
        "youtube_video_provenance": None,
        "notes": build_placeholder_note(item),
    }


def parse_iso_date(value: str) -> Optional[date]:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


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


def normalize_existing_detail(item: Dict, existing: Dict) -> Dict:
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

    return {
        "group": item["group"],
        "release_title": item["release_title"],
        "release_date": item["release_date"],
        "stream": item["stream"],
        "release_kind": item["release_kind"],
        "tracks": normalize_tracks(existing.get("tracks")),
        "spotify_url": optional_text(existing.get("spotify_url")),
        "youtube_music_url": optional_text(existing.get("youtube_music_url")),
        "youtube_video_url": youtube_video_url,
        "youtube_video_id": youtube_video_id,
        "youtube_video_status": youtube_video_status,
        "youtube_video_provenance": optional_text(existing.get("youtube_video_provenance")),
        "notes": optional_text(existing.get("notes")) or build_placeholder_note(item),
    }


def infer_title_track_titles(detail: Dict) -> List[str]:
    tracks = detail.get("tracks", [])
    if not tracks:
        return []
    if len(tracks) == 1:
        return [tracks[0]["title"]]

    normalized_release_title = normalize_title(detail.get("release_title", ""))
    if not normalized_release_title:
        return []

    exact_matches = [
        track["title"]
        for track in tracks
        if normalize_title(track.get("title", "")) == normalized_release_title
    ]
    if len(exact_matches) == 1:
        return exact_matches
    return []


def mark_title_tracks(tracks: List[Dict], title_track_titles: List[str]) -> List[Dict]:
    if not tracks:
        return tracks

    normalized_titles = {normalize_title(title) for title in title_track_titles if title}
    if not normalized_titles:
        return tracks

    matched_titles = {
        normalize_title(track.get("title", ""))
        for track in tracks
        if normalize_title(track.get("title", "")) in normalized_titles
    }
    if not matched_titles:
        return tracks

    return [
        {
            **track,
            "is_title_track": normalize_title(track.get("title", "")) in matched_titles,
        }
        for track in tracks
    ]


def apply_detail_override(detail: Dict, override_by_key: Dict[str, Dict]) -> Tuple[Dict, bool]:
    override = override_by_key.get(
        get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
    )
    if override:
        youtube_music_url = optional_text(override.get("youtube_music_url"))
        if youtube_music_url:
            detail["youtube_music_url"] = youtube_music_url

        provenance = optional_text(override.get("provenance"))
        if provenance and provenance not in detail["notes"]:
            detail["notes"] += f" Canonical YouTube Music URL preserved from release_detail_overrides.json ({provenance})."

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
    if not title_track_titles:
        title_track_titles = infer_title_track_titles(detail)
    detail["tracks"] = mark_title_tracks(detail.get("tracks", []), title_track_titles)

    return detail, bool(override)


def build_coverage_report(items: List[Dict], details_before: List[Dict], details_after: List[Dict]) -> Dict:
    history_keys = {
        get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
        for item in items
    }
    before_keys = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        for row in details_before
    }
    after_keys = {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        for row in details_after
    }

    older_items = [item for item in items if item["release_date"] <= "2023-12-31"]
    missing_before = [item for item in items if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in before_keys]
    missing_after = [item for item in items if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) not in after_keys]
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
            for item in items
            if get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"]) in before_keys
        ]
    )
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

    return {
        "history_flattened_rows": len(items),
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
        "rows_with_tracks_after": sum(1 for row in details_after if row.get("tracks")),
        "rows_with_title_track_after": sum(
            1
            for row in details_after
            if any(track.get("is_title_track") for track in row.get("tracks", []))
        ),
        "rows_with_youtube_music_after": sum(1 for row in details_after if optional_text(row.get("youtube_music_url"))),
        "rows_with_youtube_mv_after": sum(
            1
            for row in details_after
            if optional_text(row.get("youtube_video_url")) or optional_text(row.get("youtube_video_id"))
        ),
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
    }


def main() -> None:
    history_rows = load_rows(RELEASE_HISTORY_PATH)
    details_before = load_rows(OUTPUT_PATH) if OUTPUT_PATH.exists() else []
    items = iter_release_items(history_rows)
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

    details_after: List[Dict] = []
    applied_overrides = 0
    relaxed_match_count = 0

    for item in items:
        existing = existing_details.get(
            get_detail_key(item["group"], item["release_title"], item["release_date"], item["stream"])
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
        detail = normalize_existing_detail(item, existing) if existing else build_empty_detail(item)
        detail, was_overridden = apply_detail_override(detail, override_by_key)
        applied_overrides += int(was_overridden)
        details_after.append(detail)

    details_after.sort(
        key=lambda row: (
            row["group"].casefold(),
            row["release_date"],
            row["stream"],
            row["release_title"].casefold(),
        )
    )

    OUTPUT_PATH.write_text(json.dumps(details_after, ensure_ascii=False, indent=2) + "\n")

    report = build_coverage_report(items, details_before, details_after)
    report["applied_overrides"] = applied_overrides
    report["relaxed_existing_matches"] = relaxed_match_count
    report["preserved_existing_detail_rows_total"] = (
        report["preserved_exact_key_rows"] + report["relaxed_existing_matches"]
    )
    AUDIT_OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
