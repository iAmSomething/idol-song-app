#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import build_release_details_musicbrainz as release_detail_builder
import non_runtime_dataset_paths
import youtube_mv_candidate_scoring as mv_scoring
import youtube_channel_allowlists


ROOT = Path(__file__).resolve().parent
ARTIST_PROFILES_PATH = non_runtime_dataset_paths.resolve_input_path("artistProfiles.json")
DETAILS_PATH = non_runtime_dataset_paths.resolve_input_path("releaseDetails.json")
OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
REPORT_PATH = ROOT / "mv_coverage_report.json"
USER_AGENT = "Mozilla/5.0"
REQUEST_DELAY_SECONDS = 0.05
MAX_RESULTS_PER_QUERY = 12
MAX_QUERIES_PER_RELEASE = 12
MAX_TRACK_CANDIDATES_PER_RELEASE = 3
MAX_NAME_VARIANTS_PER_TRACK_SEARCH = 1
QUERY_SUFFIXES = ("official mv", "official music video", "mv", "")
HANGUL_PATTERN = re.compile(r"[가-힣]")
RELEASE_TITLE_FALLBACK_MIN_DATE = "2025-01-01"
TITLE_TRACK_EXCLUSION_PATTERN = re.compile(
    r"(?i)\b(intro|outro|interlude|inst\.?|instrumental|remix|ver\.?|version|preview|teaser|highlight|medley)\b"
)
CANDIDATE_TITLE_MARKER_PATTERN = re.compile(
    r"(?i)\b(official|music\s+video|m\/v|mv|performance\s+video|lyric\s+video|track\s+video|visualizer|teaser|shorts?)\b"
)
AUTO_ACCEPTED_YOUTUBE_PROVENANCE = "youtube search auto-accepted via allowlist/title/date/view scoring"
VIDEO_CHANNEL_URL_CACHE: dict[str, str] = {}


def parse_positive_int_arg(raw_value: str) -> int:
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def should_emit_progress(current_index: int, total_rows: int, progress_every: int) -> bool:
    if total_rows <= 0:
        return False
    return current_index == 1 or current_index == total_rows or current_index % progress_every == 0


def emit_progress(current_index: int, total_rows: int, detail: dict[str, Any]) -> None:
    print(
        (
            "[backfill_release_detail_mvs] "
            f"{current_index}/{total_rows} "
            f"{detail['group']} / {detail['release_title']} / {detail['release_date']} / {detail['stream']}"
        ),
        file=sys.stderr,
        flush=True,
    )


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, rows: Any) -> None:
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


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


def extract_text(node: dict[str, Any] | None) -> str:
    if not node:
        return ""
    if "simpleText" in node:
        return node["simpleText"]
    return "".join(run.get("text", "") for run in node.get("runs", []))


def parse_relative_published_at(text: str, reference: datetime) -> str:
    normalized = text.strip().lower()
    if not normalized:
        return ""
    if normalized in {"today", "just now"}:
        return reference.isoformat().replace("+00:00", "Z")
    if normalized == "yesterday":
        return (reference - timedelta(days=1)).isoformat().replace("+00:00", "Z")

    match = re.match(r"(\d+)\s+(hour|hours|day|days|week|weeks|month|months|year|years)\s+ago", normalized)
    if not match:
        return ""

    value = int(match.group(1))
    unit = match.group(2)
    if unit.startswith("hour"):
        delta = timedelta(hours=value)
    elif unit.startswith("day"):
        delta = timedelta(days=value)
    elif unit.startswith("week"):
        delta = timedelta(weeks=value)
    elif unit.startswith("month"):
        delta = timedelta(days=30 * value)
    else:
        delta = timedelta(days=365 * value)

    return (reference - delta).isoformat().replace("+00:00", "Z")


def resolve_channel_url_from_endpoint(endpoint: dict[str, Any]) -> str:
    url = endpoint.get("commandMetadata", {}).get("webCommandMetadata", {}).get("url", "")
    if not url:
        browse_id = endpoint.get("browseEndpoint", {}).get("browseId")
        canonical_base = endpoint.get("browseEndpoint", {}).get("canonicalBaseUrl")
        if canonical_base:
            return f"https://www.youtube.com{canonical_base}"
        if browse_id and browse_id.startswith("UC"):
            return f"https://www.youtube.com/channel/{browse_id}"
        return ""
    return f"https://www.youtube.com{url}"


def build_candidate_channel_url(video: dict[str, Any]) -> str:
    run_sets = [
        video.get("ownerText", {}).get("runs", []),
        video.get("longBylineText", {}).get("runs", []),
        video.get("shortBylineText", {}).get("runs", []),
    ]
    for runs in run_sets:
        for run in runs:
            endpoint = run.get("navigationEndpoint", {})
            channel_url = resolve_channel_url_from_endpoint(endpoint)
            if channel_url:
                return channel_url
    return ""


def candidate_channel_matches_url(candidate: dict[str, Any], channel_url: str) -> bool:
    if not channel_url:
        return False
    candidate_keys = {
        str(value).casefold()
        for value in youtube_channel_allowlists.extract_youtube_channel_match_keys(candidate.get("channel_url", ""))
        if value
    }
    channel_keys = {
        str(value).casefold()
        for value in youtube_channel_allowlists.extract_youtube_channel_match_keys(channel_url)
        if value
    }
    return bool(candidate_keys & channel_keys)


def resolve_video_channel_url(video_id: str) -> str:
    cached = VIDEO_CHANNEL_URL_CACHE.get(video_id)
    if cached is not None:
        return cached

    watch_url = f"https://www.youtube.com/watch?v={video_id}"
    request = urllib.request.Request(watch_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            html = response.read().decode("utf-8", "ignore")
    except Exception:  # noqa: BLE001
        VIDEO_CHANNEL_URL_CACHE[video_id] = ""
        return ""

    alias_urls = youtube_channel_allowlists.extract_youtube_channel_alias_urls(html)
    resolved = alias_urls[0] if alias_urls else ""
    VIDEO_CHANNEL_URL_CACHE[video_id] = resolved
    return resolved


def fetch_query_candidates(query: str, reference: datetime) -> list[dict[str, Any]]:
    search_url = "https://www.youtube.com/results?hl=en&search_query=" + urllib.parse.quote_plus(query)
    request = urllib.request.Request(search_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        html = response.read().decode("utf-8", "ignore")

    match = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not match:
        return []

    data = json.loads(match.group(1))
    sections = data["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"]["sectionListRenderer"]["contents"]
    candidates: list[dict[str, Any]] = []
    for section in sections:
        items = section.get("itemSectionRenderer", {}).get("contents", [])
        for item in items:
            video = item.get("videoRenderer")
            if not video:
                continue
            candidate = {
                "video_id": video.get("videoId"),
                "title": extract_text(video.get("title")),
                "channel_url": build_candidate_channel_url(video),
                "view_count": int(re.sub(r"[^0-9]", "", extract_text(video.get("viewCountText"))) or "0"),
                "published_at": parse_relative_published_at(extract_text(video.get("publishedTimeText")), reference),
                "query": query,
            }
            if candidate["video_id"] and candidate["title"]:
                if not candidate["channel_url"]:
                    candidate["channel_url"] = resolve_video_channel_url(candidate["video_id"])
                candidates.append(candidate)
            if len(candidates) >= MAX_RESULTS_PER_QUERY:
                return candidates
    return candidates


def contains_hangul(value: str) -> bool:
    return bool(HANGUL_PATTERN.search(value))


def append_unique(values: list[str], seen: set[str], value: str | None) -> None:
    if not value:
        return
    normalized = " ".join(str(value).split()).strip()
    if not normalized:
        return
    key = normalized.casefold()
    if key in seen:
        return
    seen.add(key)
    values.append(normalized)


def pick_name_variants(detail: dict[str, Any], profile: dict[str, Any] | None) -> list[str]:
    raw_candidates = [
        detail.get("group", ""),
        profile.get("display_name") if profile else "",
        *((profile.get("aliases") or []) if profile else []),
        *((profile.get("search_aliases") or []) if profile else []),
    ]

    primary = detail.get("group", "")
    romanized_alt = ""
    korean_alt = ""
    for candidate in raw_candidates:
        normalized = " ".join(str(candidate).split()).strip()
        if not normalized or normalized.casefold() == primary.casefold():
            continue
        if contains_hangul(normalized):
            if not korean_alt:
                korean_alt = normalized
        elif not romanized_alt:
            romanized_alt = normalized
        if romanized_alt and korean_alt:
            break

    variants: list[str] = []
    seen: set[str] = set()
    append_unique(variants, seen, primary)
    append_unique(variants, seen, korean_alt)
    append_unique(variants, seen, romanized_alt)
    return variants


def pick_title_variants(detail: dict[str, Any]) -> list[str]:
    title_tracks = [track["title"] for track in detail.get("tracks", []) if track.get("is_title_track") and track.get("title")]

    variants: list[str] = []
    seen: set[str] = set()
    for title_track in title_tracks[:2]:
        append_unique(variants, seen, title_track)
    if not variants:
        append_unique(variants, seen, detail.get("release_title"))
    release_title = detail.get("release_title", "")
    primary_title = variants[0] if variants else ""
    if release_title and release_title.casefold() != primary_title.casefold():
        append_unique(variants, seen, release_title)
    return variants


def build_queries(detail: dict[str, Any], profile: dict[str, Any] | None) -> list[str]:
    names = pick_name_variants(detail, profile)
    titles = pick_title_variants(detail)
    if not names or not titles:
        return []

    queries: list[str] = []
    seen: set[str] = set()

    query_plan: list[tuple[str, str, str]] = []

    for title_index, title in enumerate(titles):
        name_variants = names if title_index == 0 else names[:1]
        for name in name_variants:
            query_plan.extend((name, title, suffix) for suffix in QUERY_SUFFIXES)

    for name, title, suffix in query_plan:
        query = " ".join(part for part in [name, title, suffix] if part).strip()
        key = query.casefold()
        if key in seen:
            continue
        seen.add(key)
        queries.append(query)
        if len(queries) >= MAX_QUERIES_PER_RELEASE:
            break
    return queries


def should_attempt_release_title_fallback(detail: dict[str, Any], title_tracks: list[str]) -> bool:
    if title_tracks:
        return True
    if detail.get("release_date", "") < RELEASE_TITLE_FALLBACK_MIN_DATE:
        return False
    return detail.get("stream") == "song" or detail.get("release_kind") == "single"


def pick_track_search_candidates(detail: dict[str, Any]) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()
    for track in detail.get("tracks", []):
        title = " ".join(str(track.get("title") or "").split()).strip()
        if not title or TITLE_TRACK_EXCLUSION_PATTERN.search(title):
            continue

        base_title = release_detail_builder.normalize_base_title(title)
        if len(base_title) < 3:
            continue

        key = title.casefold()
        if key in seen:
            continue
        seen.add(key)
        candidates.append(title)
        if len(candidates) >= MAX_TRACK_CANDIDATES_PER_RELEASE:
            break
    return candidates


def build_track_queries(detail: dict[str, Any], profile: dict[str, Any] | None, track_title: str) -> list[str]:
    names = pick_name_variants(detail, profile)[:MAX_NAME_VARIANTS_PER_TRACK_SEARCH]
    queries: list[str] = []
    seen: set[str] = set()
    for name in names:
        for suffix in QUERY_SUFFIXES:
            query = " ".join(part for part in [name, track_title, suffix] if part).strip()
            key = query.casefold()
            if key in seen:
                continue
            seen.add(key)
            queries.append(query)
    return queries


def clean_candidate_title(candidate_title: str, group: str) -> str:
    cleaned = candidate_title
    cleaned = re.sub(r"\[[^\]]*\]", " ", cleaned)
    cleaned = re.sub(re.escape(group), " ", cleaned, flags=re.IGNORECASE)
    cleaned = CANDIDATE_TITLE_MARKER_PATTERN.sub(" ", cleaned)
    cleaned = re.sub(r"[-–—|:/]+", " ", cleaned)
    return " ".join(cleaned.split()).strip()


def infer_title_tracks_from_candidate_title(detail: dict[str, Any], candidate_title: str) -> list[str]:
    if any(track.get("is_title_track") for track in detail.get("tracks", [])):
        return []

    candidate_base_title = release_detail_builder.normalize_base_title(
        clean_candidate_title(candidate_title, detail.get("group", ""))
    )
    if len(candidate_base_title) < 3:
        return []

    matches: list[str] = []
    seen: set[str] = set()
    for track in detail.get("tracks", []):
        title = str(track.get("title") or "").strip()
        if not title or TITLE_TRACK_EXCLUSION_PATTERN.search(title):
            continue

        track_base_title = release_detail_builder.normalize_base_title(title)
        if len(track_base_title) < 3:
            continue

        is_match = candidate_base_title == track_base_title
        if not is_match and len(candidate_base_title) >= 5 and len(track_base_title) >= 5:
            is_match = candidate_base_title in track_base_title or track_base_title in candidate_base_title
        if not is_match:
            continue

        key = title.casefold()
        if key in seen:
            continue
        seen.add(key)
        matches.append(title)

    return matches if len(matches) == 1 else []


def choose_track_search_resolution(
    detail: dict[str, Any],
    profile: dict[str, Any] | None,
    allowlist: dict[str, Any],
    reference: datetime,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    track_outcomes: list[dict[str, Any]] = []
    for track_title in pick_track_search_candidates(detail):
        candidates_by_video_id: dict[str, dict[str, Any]] = {}
        outcome: dict[str, Any] = {"status": "no_match", "accepted_video_id": None, "candidates": []}
        for query in build_track_queries(detail, profile, track_title):
            time.sleep(REQUEST_DELAY_SECONDS)
            for candidate in fetch_query_candidates(query, reference):
                existing = candidates_by_video_id.get(candidate["video_id"])
                if existing is None or candidate["view_count"] > existing["view_count"]:
                    candidates_by_video_id[candidate["video_id"]] = candidate
            if not candidates_by_video_id:
                continue

            outcome = mv_scoring.score_candidates(
                {
                    "group": detail["group"],
                    "release_title": detail["release_title"],
                    "title_tracks": [track_title],
                    "release_date": detail["release_date"],
                    "mv_allowlist_match_keys": allowlist.get("mv_allowlist_match_keys", []),
                },
                list(candidates_by_video_id.values()),
            )
            if outcome["status"] == "accepted":
                break

        if not candidates_by_video_id:
            continue

        top_candidate = outcome["candidates"][0] if outcome["candidates"] else None
        track_outcomes.append(
            {
                "track_title": track_title,
                "outcome": outcome,
                "top_candidate": top_candidate,
            }
        )

    accepted_tracks = [row for row in track_outcomes if row["outcome"]["status"] == "accepted"]
    if len(accepted_tracks) == 1:
        accepted_track = accepted_tracks[0]
        accepted_candidate = next(
            candidate
            for candidate in accepted_track["outcome"]["candidates"]
            if candidate.get("video_id") == accepted_track["outcome"]["accepted_video_id"]
        )
        matched_channel = next(
            (
                channel
                for channel in (allowlist.get("mv_source_channels") or allowlist.get("channels") or [])
                if candidate_channel_matches_url(accepted_candidate, channel.get("channel_url", ""))
            ),
            None,
        )
        return (
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "release_kind": detail["release_kind"],
                "youtube_video_id": accepted_candidate["video_id"],
                "youtube_video_url": release_detail_builder.build_youtube_video_url(accepted_candidate["video_id"]),
                "youtube_video_provenance": AUTO_ACCEPTED_YOUTUBE_PROVENANCE,
                "selected_query": accepted_candidate.get("query", ""),
                "selected_title": accepted_candidate.get("title", ""),
                "selected_channel_url": accepted_candidate.get("channel_url", ""),
                "selected_channel_owner_type": matched_channel.get("owner_type", "unknown") if matched_channel else "unknown",
                "selected_score": accepted_candidate.get("score", 0),
                "title_track_basis": "track_search",
                "inferred_title_tracks": [accepted_track["track_title"]],
            },
            None,
        )

    review_tracks = [row for row in track_outcomes if row["outcome"]["status"] == "needs_review" and row["top_candidate"]]
    if review_tracks:
        review_track = max(
            review_tracks,
            key=lambda row: row["top_candidate"].get("score", 0),
        )
        top_candidate = review_track["top_candidate"]
        return (
            None,
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "top_candidate_title": top_candidate.get("title", ""),
                "top_candidate_channel_url": top_candidate.get("channel_url", ""),
                "top_candidate_score": top_candidate.get("score", 0),
                "review_reason": (
                    "Track-aware search found a likely official MV candidate, but the evidence still requires manual verification."
                ),
                "title_track_basis": "track_search",
                "track_search_candidate": review_track["track_title"],
            },
        )

    return None, None


def choose_resolutions(
    details: list[dict[str, Any]],
    profiles_by_group: dict[str, dict[str, Any]],
    allowlists_by_group: dict[str, dict[str, Any]],
    progress_every: int | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    reference = now_utc()
    resolutions: list[dict[str, Any]] = []
    review_rows: list[dict[str, Any]] = []

    total_rows = len(details)
    for current_index, detail in enumerate(details, start=1):
        if progress_every is not None and should_emit_progress(current_index, total_rows, progress_every):
            emit_progress(current_index, total_rows, detail)
        current_status = detail.get("youtube_video_status") or release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED
        auto_accepted_override = detail.get("youtube_video_provenance") == AUTO_ACCEPTED_YOUTUBE_PROVENANCE
        if current_status not in {
            release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED,
            release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW,
        } and not auto_accepted_override:
            continue

        title_tracks = [track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")]
        release_title_search_enabled = should_attempt_release_title_fallback(detail, title_tracks)
        track_search_enabled = not title_tracks and bool(pick_track_search_candidates(detail))
        if not release_title_search_enabled and not track_search_enabled:
            continue

        allowlist = allowlists_by_group.get(detail["group"], {})
        if not allowlist.get("mv_allowlist_match_keys"):
            continue
        mv_source_channels = allowlist.get("mv_source_channels") or allowlist.get("channels") or []

        candidates_by_video_id: dict[str, dict[str, Any]] = {}
        outcome: dict[str, Any] = {"status": "no_match", "accepted_video_id": None, "candidates": []}
        if release_title_search_enabled:
            for query in build_queries(detail, profiles_by_group.get(detail["group"])):
                time.sleep(REQUEST_DELAY_SECONDS)
                for candidate in fetch_query_candidates(query, reference):
                    existing = candidates_by_video_id.get(candidate["video_id"])
                    if existing is None or candidate["view_count"] > existing["view_count"]:
                        candidates_by_video_id[candidate["video_id"]] = candidate
                if not candidates_by_video_id:
                    continue

                outcome = mv_scoring.score_candidates(
                    {
                        "group": detail["group"],
                        "release_title": detail["release_title"],
                        "title_tracks": title_tracks,
                        "release_date": detail["release_date"],
                        "mv_allowlist_match_keys": allowlist.get("mv_allowlist_match_keys", []),
                    },
                    list(candidates_by_video_id.values()),
                )
                if outcome["status"] == "accepted":
                    break

        if candidates_by_video_id and outcome["status"] == "accepted" and outcome["accepted_video_id"]:
            accepted = next(
                candidate for candidate in outcome["candidates"] if candidate.get("video_id") == outcome["accepted_video_id"]
            )
            matched_channel = next(
                (
                    channel
                    for channel in mv_source_channels
                    if candidate_channel_matches_url(accepted, channel.get("channel_url", ""))
                ),
                None,
            )
            inferred_title_tracks = infer_title_tracks_from_candidate_title(detail, accepted.get("title", ""))
            resolutions.append(
                {
                    "group": detail["group"],
                    "release_title": detail["release_title"],
                    "release_date": detail["release_date"],
                    "stream": detail["stream"],
                    "release_kind": detail["release_kind"],
                    "youtube_video_id": accepted["video_id"],
                    "youtube_video_url": release_detail_builder.build_youtube_video_url(accepted["video_id"]),
                    "youtube_video_provenance": "youtube search auto-accepted via allowlist/title/date/view scoring",
                    "selected_query": accepted.get("query", ""),
                    "selected_title": accepted.get("title", ""),
                    "selected_channel_url": accepted.get("channel_url", ""),
                    "selected_channel_owner_type": matched_channel.get("owner_type", "unknown") if matched_channel else "unknown",
                    "selected_score": accepted.get("score", 0),
                    "title_track_basis": "release_title_fallback" if not title_tracks else "title_track",
                    "inferred_title_tracks": inferred_title_tracks,
                }
            )
            continue

        if not title_tracks:
            track_resolution, track_review_row = choose_track_search_resolution(
                detail,
                profiles_by_group.get(detail["group"]),
                allowlist,
                reference,
            )
            if track_resolution:
                resolutions.append(track_resolution)
                continue
            if track_review_row:
                review_rows.append(track_review_row)
                continue

        if candidates_by_video_id and outcome["status"] == "needs_review" and outcome["candidates"]:
            top = outcome["candidates"][0]
            review_rows.append(
                {
                    "group": detail["group"],
                    "release_title": detail["release_title"],
                    "release_date": detail["release_date"],
                    "stream": detail["stream"],
                    "top_candidate_title": top.get("title", ""),
                    "top_candidate_channel_url": top.get("channel_url", ""),
                    "top_candidate_score": top.get("score", 0),
                    "review_reason": "Top candidate needs manual verification before accepting a canonical MV target.",
                    "title_track_basis": "release_title_fallback" if not title_tracks else "title_track",
                }
            )
            continue

        review_rows.append(
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "top_candidate_title": "",
                "top_candidate_channel_url": "",
                "top_candidate_score": 0,
                "review_reason": "No allowlisted official MV candidate was found from the generated historical search queries.",
                "title_track_basis": "release_title_fallback" if not title_tracks else "title_track",
            }
        )

    return resolutions, review_rows


def merge_override_rows(
    existing_rows: list[dict[str, Any]],
    resolutions: list[dict[str, Any]],
    reevaluated_keys: set[str] | None = None,
) -> list[dict[str, Any]]:
    by_key = {
        release_detail_builder.get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): dict(row)
        for row in existing_rows
    }
    resolution_keys = {
        release_detail_builder.get_detail_key(
            row["group"],
            row["release_title"],
            row["release_date"],
            row["stream"],
        )
        for row in resolutions
    }

    if reevaluated_keys:
        for key in reevaluated_keys:
            if key in resolution_keys:
                continue
            row = by_key.get(key)
            if not row or row.get("youtube_video_provenance") != AUTO_ACCEPTED_YOUTUBE_PROVENANCE:
                continue
            row.pop("youtube_video_id", None)
            row.pop("youtube_video_url", None)
            row.pop("youtube_video_provenance", None)

    for resolution in resolutions:
        key = release_detail_builder.get_detail_key(
            resolution["group"],
            resolution["release_title"],
            resolution["release_date"],
            resolution["stream"],
        )
        row = by_key.get(
            key,
            {
                "group": resolution["group"],
                "release_title": resolution["release_title"],
                "release_date": resolution["release_date"],
                "stream": resolution["stream"],
            },
        )
        row["youtube_video_id"] = resolution["youtube_video_id"]
        row["youtube_video_url"] = resolution["youtube_video_url"]
        row["youtube_video_provenance"] = resolution["youtube_video_provenance"]
        row.pop("youtube_video_status", None)
        row.pop("youtube_video_review_reason", None)
        if resolution.get("inferred_title_tracks") and not row.get("title_tracks"):
            row["title_tracks"] = resolution["inferred_title_tracks"]
        by_key[key] = row

    return sorted(
        by_key.values(),
        key=lambda row: (
            row["group"].casefold(),
            row["release_date"],
            row["release_title"].casefold(),
            row["stream"],
        ),
    )


def apply_resolutions_to_details(details: list[dict[str, Any]], resolutions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    resolutions_by_key = {
        release_detail_builder.get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in resolutions
    }
    updated: list[dict[str, Any]] = []
    for detail in details:
        key = release_detail_builder.get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
        resolution = resolutions_by_key.get(key)
        if not resolution:
            updated.append(detail)
            continue

        updated.append(
            {
                **detail,
                "youtube_video_id": resolution["youtube_video_id"],
                "youtube_video_url": resolution["youtube_video_url"],
                "youtube_video_status": release_detail_builder.YOUTUBE_VIDEO_STATUS_MANUAL,
                "youtube_video_provenance": resolution["youtube_video_provenance"],
            }
        )
    return updated


def build_report(before_details: list[dict[str, Any]], after_details: list[dict[str, Any]], resolutions: list[dict[str, Any]], review_rows: list[dict[str, Any]]) -> dict[str, Any]:
    before_with_mv = sum(1 for row in before_details if row.get("youtube_video_id") or row.get("youtube_video_url"))
    after_with_mv = sum(1 for row in after_details if row.get("youtube_video_id") or row.get("youtube_video_url"))
    unresolved_after = [
        row
        for row in after_details
        if (row.get("youtube_video_status") or release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED)
        in {release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED, release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW}
    ]

    resolved_entity_samples = sorted({row["group"] for row in resolutions})[:10]
    label_channel_resolutions = [row for row in resolutions if row.get("selected_channel_owner_type") == "label"]
    team_channel_resolutions = [row for row in resolutions if row.get("selected_channel_owner_type") == "team"]
    title_track_inferred = [row for row in resolutions if row.get("inferred_title_tracks")]
    return {
        "baseline_rows": len(before_details),
        "baseline_with_mv": before_with_mv,
        "after_with_mv": after_with_mv,
        "coverage_lift": after_with_mv - before_with_mv,
        "attempted_rows": len(review_rows) + len(resolutions),
        "resolved_now": len(resolutions),
        "review_row_count": len(review_rows),
        "resolved_entities": len({row["group"] for row in resolutions}),
        "resolved_entity_samples": resolved_entity_samples,
        "label_channel_resolutions": len(label_channel_resolutions),
        "team_channel_resolutions": len(team_channel_resolutions),
        "title_track_inferred_now": len(title_track_inferred),
        "label_channel_samples": label_channel_resolutions[:10],
        "team_channel_samples": team_channel_resolutions[:10],
        "title_track_inference_samples": title_track_inferred[:10],
        "unresolved_remainder": len(unresolved_after),
        "review_candidates": review_rows[:20],
        "resolved_samples": resolutions[:20],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--groups",
        help="Comma-separated list of groups to limit the current resolution pass.",
    )
    parser.add_argument(
        "--cohorts",
        help="Comma-separated release cohorts to scope the pass (latest,recent,historical).",
    )
    parser.add_argument(
        "--max-rows",
        type=parse_positive_int_arg,
        help="Limit the current scoped pass to the first N matching release-detail rows.",
    )
    parser.add_argument(
        "--progress-every",
        type=parse_positive_int_arg,
        default=25,
        help="Emit stderr progress after every N inspected rows during the current pass.",
    )
    args = parser.parse_args()

    details = load_json(DETAILS_PATH)
    existing_overrides = load_json(OVERRIDES_PATH)
    profiles = load_json(ARTIST_PROFILES_PATH)
    profiles_by_group = {row["group"]: row for row in profiles}
    allowlists_by_group = youtube_channel_allowlists.load_allowlists_by_group()

    scoped_groups = None
    if args.groups:
        scoped_groups = {value.strip() for value in args.groups.split(",") if value.strip()}
        details = [detail for detail in details if detail["group"] in scoped_groups]

    scoped_cohorts = None
    if args.cohorts:
        scoped_cohorts = {value.strip() for value in args.cohorts.split(",") if value.strip()}
        reference_date = now_utc().date()
        details = [
            detail
            for detail in details
            if infer_release_cohort(detail.get("release_date", ""), reference_date) in scoped_cohorts
        ]
    total_scoped_rows = len(details)
    if args.max_rows is not None:
        details = details[: args.max_rows]
    print(
        (
            "[backfill_release_detail_mvs] "
            f"processing {len(details)}/{total_scoped_rows} scoped rows "
            f"(progress_every={args.progress_every})"
        ),
        file=sys.stderr,
        flush=True,
    )

    resolutions, review_rows = choose_resolutions(
        details,
        profiles_by_group,
        allowlists_by_group,
        progress_every=args.progress_every,
    )
    reevaluated_keys = {
        release_detail_builder.get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
        for detail in details
        if (
            (detail.get("youtube_video_status") or release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED)
            in {
                release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED,
                release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW,
            }
            or detail.get("youtube_video_provenance") == AUTO_ACCEPTED_YOUTUBE_PROVENANCE
        )
    }

    full_details = load_json(DETAILS_PATH)
    merged_overrides = merge_override_rows(existing_overrides, resolutions, reevaluated_keys)
    updated_details = apply_resolutions_to_details(full_details, resolutions)
    report = build_report(full_details, updated_details, resolutions, review_rows)
    if scoped_groups is not None:
        report["execution_scope"] = {
            "groups": sorted(scoped_groups),
        }
    if report.get("execution_scope") is None:
        report["execution_scope"] = {}
    if scoped_cohorts is not None:
        report["execution_scope"]["cohorts"] = sorted(scoped_cohorts)
    report["execution_scope"]["scoped_rows_total"] = total_scoped_rows
    report["execution_scope"]["selected_rows"] = len(details)
    report["execution_scope"]["progress_every"] = args.progress_every
    if args.max_rows is not None:
        report["execution_scope"]["max_rows"] = args.max_rows

    write_json(OVERRIDES_PATH, merged_overrides)
    write_json(DETAILS_PATH, updated_details)
    write_json(REPORT_PATH, report)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
