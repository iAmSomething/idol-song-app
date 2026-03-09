#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
from pathlib import Path
from urllib.parse import quote_plus

import build_release_details_musicbrainz as release_detail_builder
import youtube_channel_allowlists


ROOT = Path(__file__).resolve().parent
DETAILS_PATH = ROOT / "web/src/data/releaseDetails.json"
PROFILES_PATH = ROOT / "web/src/data/artistProfiles.json"
OUTPUT_JSON = ROOT / "mv_manual_review_queue.json"
OUTPUT_CSV = ROOT / "mv_manual_review_queue.csv"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_lookup_key(row: dict) -> str:
    return release_detail_builder.get_detail_key(
        row["group"],
        row["release_title"],
        row["release_date"],
        row["stream"],
    )


def derive_title_tracks(detail: dict) -> list[str]:
    explicit = [track["title"] for track in detail.get("tracks", []) if track.get("is_title_track")]
    if explicit:
        return explicit
    tracks = detail.get("tracks", [])
    if detail.get("stream") == "song" and len(tracks) == 1:
        return [tracks[0]["title"]]
    return []


def build_search_query(detail: dict, title_tracks: list[str]) -> str:
    query_title = title_tracks[0] if title_tracks else detail["release_title"]
    return f"{detail['group']} {query_title} official mv"


def build_recommended_action(status: str, has_official_youtube_url: bool, has_mv_allowlist: bool) -> str:
    if status == release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW:
        if has_mv_allowlist:
            return "Review the suggested query against the allowlisted official channels and either add a manual override or keep the release in review."
        if has_official_youtube_url:
            return "Backfill label-owned MV sources if needed, then review the suggested query before adding an override."
        return "Backfill the team or label YouTube allowlist first, then review the suggested query before adding an override."
    if has_mv_allowlist:
        return "Search only the allowlisted official channels and add a manual override only when the MV match is explicit."
    if has_official_youtube_url:
        return "Backfill label-owned MV sources if needed, then search the official team channel before adding an override."
    return "Backfill the team or label YouTube allowlist first or leave the release unresolved for later follow-up."


def build_review_rows(details: list[dict], profiles: list[dict], overrides: dict[str, dict]) -> list[dict]:
    official_youtube_by_group = {
        row["group"]: row.get("official_youtube_url")
        for row in profiles
    }
    allowlists_by_group = youtube_channel_allowlists.load_allowlists_by_group()

    review_rows: list[dict] = []
    for detail in details:
        status = detail.get("youtube_video_status") or release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED
        if status not in {
            release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW,
            release_detail_builder.YOUTUBE_VIDEO_STATUS_UNRESOLVED,
        }:
            continue

        key = build_lookup_key(detail)
        override = overrides.get(key, {})
        official_youtube_url = official_youtube_by_group.get(detail["group"]) or ""
        allowlist = allowlists_by_group.get(detail["group"], {})
        mv_allowlist_urls = allowlist.get("mv_allowlist_urls", [])
        title_tracks = derive_title_tracks(detail)
        search_query = build_search_query(detail, title_tracks)
        review_reason = override.get("youtube_video_review_reason")
        if not review_reason:
            if not title_tracks:
                review_reason = "No dependable title-track metadata is attached yet, so MV verification falls back to the release title."
            elif not mv_allowlist_urls and not official_youtube_url:
                review_reason = "No official team or label YouTube source is registered yet for this release."
            elif status == release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW:
                review_reason = "Manual review is required before accepting any canonical MV target."
            else:
                review_reason = "No canonical MV target is attached yet."

        review_rows.append(
            {
                "group": detail["group"],
                "release_title": detail["release_title"],
                "release_date": detail["release_date"],
                "stream": detail["stream"],
                "release_kind": detail["release_kind"],
                "title_tracks": title_tracks,
                "title_track_basis": "title_track" if title_tracks else "release_title_fallback",
                "missing_title_track_metadata": not bool(title_tracks),
                "youtube_video_status": status,
                "official_youtube_url": official_youtube_url,
                "mv_allowlist_urls": mv_allowlist_urls,
                "missing_mv_allowlist": not bool(mv_allowlist_urls),
                "review_reason": review_reason,
                "recommended_action": build_recommended_action(
                    status,
                    bool(official_youtube_url),
                    bool(mv_allowlist_urls),
                ),
                "suggested_search_query": search_query,
                "suggested_search_url": f"https://www.youtube.com/results?search_query={quote_plus(search_query)}",
                "current_youtube_video_url": detail.get("youtube_video_url") or "",
                "current_youtube_video_provenance": detail.get("youtube_video_provenance") or "",
            }
        )

    review_rows.sort(
        key=lambda row: (
            0 if row["youtube_video_status"] == release_detail_builder.YOUTUBE_VIDEO_STATUS_REVIEW else 1,
            row["group"].lower(),
            row["release_date"],
            row["release_title"].lower(),
        )
    )
    return review_rows


def main() -> None:
    details = load_json(DETAILS_PATH)
    profiles = load_json(PROFILES_PATH)
    overrides = release_detail_builder.load_detail_overrides()

    review_rows = build_review_rows(details, profiles, overrides)
    OUTPUT_JSON.write_text(json.dumps(review_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "release_title",
                "release_date",
                "stream",
                "release_kind",
                "title_tracks",
                "title_track_basis",
                "missing_title_track_metadata",
                "youtube_video_status",
                "official_youtube_url",
                "mv_allowlist_urls",
                "missing_mv_allowlist",
                "review_reason",
                "recommended_action",
                "suggested_search_query",
                "suggested_search_url",
                "current_youtube_video_url",
                "current_youtube_video_provenance",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in review_rows:
            output = dict(row)
            output["title_tracks"] = " ; ".join(output["title_tracks"])
            output["mv_allowlist_urls"] = " ; ".join(output["mv_allowlist_urls"])
            writer.writerow(output)

    status_counts: dict[str, int] = {}
    for row in review_rows:
        status_counts[row["youtube_video_status"]] = status_counts.get(row["youtube_video_status"], 0) + 1

    print(
        json.dumps(
            {
                "queue_items": len(review_rows),
                "status_counts": status_counts,
                "output_json": OUTPUT_JSON.name,
                "output_csv": OUTPUT_CSV.name,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
