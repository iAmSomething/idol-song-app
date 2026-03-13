#!/usr/bin/env python3

from __future__ import annotations

import html
import json
import re
import urllib.request
from pathlib import Path
from typing import Any, Callable

import non_runtime_dataset_paths
from youtube_channel_allowlists import AGENCY_MV_CHANNELS, load_allowlists_by_group, resolve_youtube_channel_alias_urls


ROOT = Path(__file__).resolve().parent
PROFILES_PATH = non_runtime_dataset_paths.resolve_input_path("artistProfiles.json")
BADGES_PATH = non_runtime_dataset_paths.resolve_input_path("teamBadgeAssets.json")
OUTPUT_PATH = non_runtime_dataset_paths.primary_path("teamBadgeAssets.json")
OG_IMAGE_PATTERN = re.compile(r'<meta property="og:image" content="([^"]+)"')
AVATAR_PATTERN = re.compile(r'"avatar":\{"thumbnails":\[(.*?)\]\}')
URL_PATTERN = re.compile(r'"url":"([^"]+)"')
USER_AGENT = "Mozilla/5.0"
REQUEST_TIMEOUT_SECONDS = 5
AGENCY_CHANNEL_URLS = {
    channel["channel_url"].rstrip("/").casefold() for channel in AGENCY_MV_CHANNELS.values()
}

FetchText = Callable[[str], str]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_url(url: str | None) -> str | None:
    if not url:
        return None
    return url.rstrip("/")


def is_agency_channel(channel_url: str | None) -> bool:
    normalized = normalize_url(channel_url)
    if not normalized:
        return False
    return normalized.casefold() in AGENCY_CHANNEL_URLS


def decode_html_url(value: str) -> str:
    return html.unescape(value.replace("\\/", "/"))


def extract_avatar_image_url(page_html: str) -> str | None:
    normalized_html = page_html.replace("\\/", "/")

    og_image_match = OG_IMAGE_PATTERN.search(normalized_html)
    if og_image_match:
        return decode_html_url(og_image_match.group(1))

    avatar_match = AVATAR_PATTERN.search(normalized_html)
    if not avatar_match:
        return None

    urls = [decode_html_url(match) for match in URL_PATTERN.findall(avatar_match.group(1))]
    if not urls:
        return None
    return urls[-1]


def select_team_channel_url(
    profile: dict[str, Any],
    allowlist_row: dict[str, Any] | None,
) -> str | None:
    channels = allowlist_row.get("channels") if allowlist_row else []
    for channel in channels or []:
        channel_url = channel.get("channel_url")
        if not channel_url or is_agency_channel(channel_url):
            continue
        if channel.get("owner_type") == "team" and channel.get("display_in_team_links"):
            return channel_url

    primary_team_channel_url = allowlist_row.get("primary_team_channel_url") if allowlist_row else None
    if primary_team_channel_url and not is_agency_channel(primary_team_channel_url):
        return primary_team_channel_url

    official_youtube_url = profile.get("official_youtube_url")
    if official_youtube_url and not is_agency_channel(official_youtube_url):
        return official_youtube_url
    return None


def resolve_badge_source_url(channel_url: str, fetcher: FetchText) -> str:
    alias_urls = resolve_youtube_channel_alias_urls(channel_url, fetcher=fetcher)
    for alias_url in alias_urls:
        if "/channel/" in alias_url:
            return alias_url
    if alias_urls:
        return alias_urls[0]
    return channel_url


def build_badge_row(group: str, channel_url: str, fetcher: FetchText) -> dict[str, str] | None:
    try:
        page_html = fetcher(channel_url)
    except Exception:  # noqa: BLE001
        return None

    badge_image_url = extract_avatar_image_url(page_html)
    if not badge_image_url:
        return None

    return {
        "group": group,
        "badge_image_url": badge_image_url,
        "badge_source_url": resolve_badge_source_url(channel_url, fetcher),
        "badge_source_label": "Official YouTube channel avatar",
        "badge_kind": "official_channel_avatar",
    }


def build_badge_rows(
    profiles: list[dict[str, Any]],
    existing_rows: list[dict[str, Any]],
    allowlists_by_group: dict[str, dict[str, Any]],
    fetcher: FetchText,
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    rows_by_group = {row["group"]: row for row in existing_rows}
    summary = {
        "added": 0,
        "skipped_existing": 0,
        "skipped_agency_only": 0,
        "skipped_fetch_failed": 0,
    }

    for profile in profiles:
        group = profile["group"]
        if rows_by_group.get(group, {}).get("badge_image_url"):
            summary["skipped_existing"] += 1
            continue

        channel_url = select_team_channel_url(profile, allowlists_by_group.get(group))
        if not channel_url:
            summary["skipped_agency_only"] += 1
            continue

        badge_row = build_badge_row(group, channel_url, fetcher)
        if not badge_row:
            summary["skipped_fetch_failed"] += 1
            continue

        rows_by_group[group] = badge_row
        summary["added"] += 1

    sorted_rows = sorted(rows_by_group.values(), key=lambda row: row["group"].casefold())
    return sorted_rows, summary


def write_json(rows: list[dict[str, Any]]) -> dict[str, list[str] | str]:
    return non_runtime_dataset_paths.write_json_dataset("teamBadgeAssets.json", rows)


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", "ignore")


def main() -> None:
    profiles = load_json(PROFILES_PATH)
    existing_rows = load_json(BADGES_PATH)
    allowlists_by_group = load_allowlists_by_group()
    rows, summary = build_badge_rows(profiles, existing_rows, allowlists_by_group, fetch_text)
    io_paths = write_json(rows)
    print(
        json.dumps(
            {
                "rows": len(rows),
                "input_profiles": str(PROFILES_PATH.relative_to(ROOT)),
                "input_badges": str(BADGES_PATH.relative_to(ROOT)),
                **summary,
                **io_paths,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
