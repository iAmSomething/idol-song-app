#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import build_release_details_musicbrainz as release_detail_builder
import youtube_mv_candidate_scoring as mv_scoring
import youtube_channel_allowlists


ROOT = Path(__file__).resolve().parent
ARTIST_PROFILES_PATH = ROOT / "web/src/data/artistProfiles.json"
DETAILS_PATH = ROOT / "web/src/data/releaseDetails.json"
OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
REPORT_PATH = ROOT / "mv_coverage_report.json"
USER_AGENT = "Mozilla/5.0"
REQUEST_DELAY_SECONDS = 0.35
MAX_RESULTS_PER_QUERY = 8
MAX_QUERIES_PER_RELEASE = 8
QUERY_SUFFIXES = ("official mv", "mv")
HANGUL_PATTERN = re.compile(r"[가-힣]")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, rows: Any) -> None:
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


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


def build_candidate_channel_url(video: dict[str, Any]) -> str:
    runs = video.get("longBylineText", {}).get("runs", [])
    if not runs:
        return ""
    endpoint = runs[0].get("navigationEndpoint", {})
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
    append_unique(variants, seen, title_tracks[0] if title_tracks else detail.get("release_title"))
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

    primary_title = titles[0]
    fallback_title = titles[1] if len(titles) > 1 else ""
    query_plan: list[tuple[str, str, str]] = []

    for name in names:
        query_plan.extend((name, primary_title, suffix) for suffix in QUERY_SUFFIXES)
    if fallback_title:
        query_plan.extend((names[0], fallback_title, suffix) for suffix in QUERY_SUFFIXES)

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


def choose_resolutions(details: list[dict[str, Any]], profiles_by_group: dict[str, dict[str, Any]], allowlists_by_group: dict[str, dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    reference = now_utc()
    resolutions: list[dict[str, Any]] = []
    review_rows: list[dict[str, Any]] = []

    for detail in details:
        current_status = detail.get("youtube_video_status") or release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED
        if current_status not in {
            release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED,
            release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW,
        }:
            continue

        title_tracks = [track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")]
        if not title_tracks:
            continue

        allowlist = allowlists_by_group.get(detail["group"], {})
        if not allowlist.get("mv_allowlist_match_keys"):
            continue

        candidates_by_video_id: dict[str, dict[str, Any]] = {}
        outcome: dict[str, Any] = {"status": "no_match", "accepted_video_id": None, "candidates": []}
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

        if not candidates_by_video_id:
            continue

        if outcome["status"] == "accepted" and outcome["accepted_video_id"]:
            accepted = next(
                candidate for candidate in outcome["candidates"] if candidate.get("video_id") == outcome["accepted_video_id"]
            )
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
                    "selected_score": accepted.get("score", 0),
                }
            )
            continue

        if outcome["status"] == "needs_review" and outcome["candidates"]:
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
                }
            )

    return resolutions, review_rows


def merge_override_rows(existing_rows: list[dict[str, Any]], resolutions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key = {
        release_detail_builder.get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): dict(row)
        for row in existing_rows
    }

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

    return {
        "baseline_rows": len(before_details),
        "baseline_with_mv": before_with_mv,
        "after_with_mv": after_with_mv,
        "coverage_lift": after_with_mv - before_with_mv,
        "resolved_now": len(resolutions),
        "unresolved_remainder": len(unresolved_after),
        "review_candidates": review_rows[:20],
        "resolved_samples": resolutions[:20],
    }


def main() -> None:
    details = load_json(DETAILS_PATH)
    existing_overrides = load_json(OVERRIDES_PATH)
    profiles = load_json(ARTIST_PROFILES_PATH)
    profiles_by_group = {row["group"]: row for row in profiles}
    allowlists_by_group = youtube_channel_allowlists.load_allowlists_by_group()

    resolutions, review_rows = choose_resolutions(details, profiles_by_group, allowlists_by_group)
    merged_overrides = merge_override_rows(existing_overrides, resolutions)
    updated_details = apply_resolutions_to_details(details, resolutions)
    report = build_report(details, updated_details, resolutions, review_rows)

    write_json(OVERRIDES_PATH, merged_overrides)
    write_json(DETAILS_PATH, updated_details)
    write_json(REPORT_PATH, report)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
