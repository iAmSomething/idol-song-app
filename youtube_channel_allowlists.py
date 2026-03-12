#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
PROFILES_PATH = ROOT / "web/src/data/artistProfiles.json"
OUTPUT_PATH = ROOT / "web/src/data/youtubeChannelAllowlists.json"
USER_AGENT = "Mozilla/5.0"
REQUEST_TIMEOUT_SECONDS = 15
YOUTUBE_CHANNEL_ID_PATTERNS = (
    re.compile(r'"channelId":"(UC[\w-]{20,})"'),
    re.compile(r'"externalId":"(UC[\w-]{20,})"'),
    re.compile(r'"browseId":"(UC[\w-]{20,})"'),
)
YOUTUBE_CANONICAL_BASE_PATTERN = re.compile(r'"canonicalBaseUrl":"([^"]+)"')

AGENCY_MV_CHANNELS: dict[str, dict[str, str]] = {
    "HYBE Labels": {
        "channel_url": "https://www.youtube.com/@HYBELABELS",
        "channel_label": "HYBE LABELS",
    },
    "SM Entertainment": {
        "channel_url": "https://www.youtube.com/@SMTOWN",
        "channel_label": "SMTOWN",
    },
    "JYP Entertainment": {
        "channel_url": "https://www.youtube.com/@JYPEntertainment",
        "channel_label": "JYP Entertainment",
    },
    "YG Entertainment": {
        "channel_url": "https://www.youtube.com/@YGEntertainment",
        "channel_label": "YG ENTERTAINMENT",
    },
    "Starship Entertainment": {
        "channel_url": "https://www.youtube.com/@officialstarship",
        "channel_label": "STARSHIP",
    },
}

GROUP_CHANNEL_OVERRIDES: dict[str, list[dict[str, Any]]] = {
    "SEVENTEEN": [
        {
            "channel_url": "https://www.youtube.com/channel/UCfkXDY7vwkcJ8ddFGz8KusA",
            "channel_label": "PLEDIS",
            "owner_type": "label",
            "allow_mv_uploads": True,
            "display_in_team_links": False,
            "provenance": "manual_override_legacy_label_channel",
        }
    ],
    "AtHeart": [
        {
            "channel_url": "https://www.youtube.com/@AtHeart_TITAN",
            "channel_label": "AtHeart",
            "owner_type": "team",
            "allow_mv_uploads": True,
            "display_in_team_links": True,
            "provenance": "manual_override_uploader",
        }
    ],
    "BADVILLAIN": [
        {
            "channel_url": "https://www.youtube.com/@BPMEntertainment-official",
            "channel_label": "BPM Entertainment",
            "owner_type": "label",
            "allow_mv_uploads": True,
            "display_in_team_links": False,
            "provenance": "manual_override_uploader",
        }
    ],
    "SAY MY NAME": [
        {
            "channel_url": "https://www.youtube.com/@inkodeofficial",
            "channel_label": "iNKODE Official",
            "owner_type": "label",
            "allow_mv_uploads": True,
            "display_in_team_links": False,
            "provenance": "manual_override_uploader",
        }
    ],
    "TIOT": [
        {
            "channel_url": "https://www.youtube.com/@TIOT_NOW",
            "channel_label": "TIOT",
            "owner_type": "team",
            "allow_mv_uploads": True,
            "display_in_team_links": True,
            "provenance": "manual_override_uploader",
        }
    ],
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, rows: Any) -> bool:
    serialized = json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    previous = path.read_text(encoding="utf-8") if path.exists() else None
    if previous == serialized:
        return False
    path.write_text(serialized, encoding="utf-8")
    return True


def extract_youtube_channel_match_keys(channel_url: str) -> list[str]:
    parsed = urlparse(channel_url)
    path = parsed.path.strip("/")
    if not path:
        return []

    keys: list[str] = []
    segments = [segment for segment in path.split("/") if segment]
    if not segments:
        return []

    first = segments[0]
    if first.startswith("@"):
        keys.append(first.casefold())
    elif first == "channel" and len(segments) > 1:
        keys.append(f"channel:{segments[1].casefold()}")
    else:
        keys.append("/".join(segment.casefold() for segment in segments))

    keys.append(channel_url.rstrip("/").casefold())

    deduped: list[str] = []
    seen: set[str] = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        deduped.append(key)
    return deduped


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8", "ignore")


def extract_youtube_channel_alias_urls(html: str) -> list[str]:
    aliases: list[str] = []

    for pattern in YOUTUBE_CHANNEL_ID_PATTERNS:
        channel_id_match = pattern.search(html)
        if channel_id_match:
            aliases.append(f"https://www.youtube.com/channel/{channel_id_match.group(1)}")
            break

    canonical_match = YOUTUBE_CANONICAL_BASE_PATTERN.search(html)
    if canonical_match:
        canonical_path = canonical_match.group(1)
        if canonical_path.startswith(("/@", "/channel/")):
            aliases.append(f"https://www.youtube.com{canonical_path}")

    deduped: list[str] = []
    seen: set[str] = set()
    for alias in aliases:
        normalized = alias.rstrip("/")
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)
    return deduped


def resolve_youtube_channel_alias_urls(
    channel_url: str,
    fetcher: Any = fetch_text,
) -> list[str]:
    parsed = urlparse(channel_url)
    if "youtube.com" not in parsed.netloc.lower():
        return []

    path = parsed.path.strip("/")
    if not path or path.startswith("channel/"):
        return []

    try:
        html = fetcher(channel_url)
    except Exception:  # noqa: BLE001
        return []
    return extract_youtube_channel_alias_urls(html)


def build_source(
    channel_url: str,
    channel_label: str,
    owner_type: str,
    display_in_team_links: bool,
    provenance: str,
    fetcher: Any = fetch_text,
) -> dict[str, Any]:
    alias_urls = resolve_youtube_channel_alias_urls(channel_url, fetcher=fetcher)
    match_keys = dedupe_strings(
        extract_youtube_channel_match_keys(channel_url)
        + [
            match_key
            for alias_url in alias_urls
            for match_key in extract_youtube_channel_match_keys(alias_url)
        ]
    )
    return {
        "channel_url": channel_url,
        "channel_label": channel_label,
        "owner_type": owner_type,
        "allow_mv_uploads": True,
        "display_in_team_links": display_in_team_links,
        "provenance": provenance,
        "resolved_alias_urls": alias_urls,
        "match_keys": match_keys,
    }


def dedupe_sources(sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for source in sources:
        key = source["channel_url"].rstrip("/").casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(source)
    return deduped


def dedupe_strings(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        deduped.append(value)
    return deduped


def build_allowlist_row(profile: dict[str, Any]) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []

    primary_team_channel_url = profile.get("official_youtube_url")
    if primary_team_channel_url:
        sources.append(
            build_source(
                primary_team_channel_url,
                profile.get("display_name") or profile["group"],
                "team",
                True,
                "artistProfiles.official_youtube_url",
            )
        )

    agency_channel = AGENCY_MV_CHANNELS.get(profile.get("agency") or "")
    if agency_channel:
        sources.append(
            build_source(
                agency_channel["channel_url"],
                agency_channel["channel_label"],
                "label",
                False,
                "curated_agency_allowlist",
            )
        )

    sources.extend(GROUP_CHANNEL_OVERRIDES.get(profile["group"], []))
    sources = dedupe_sources(sources)
    mv_source_channels = [source for source in sources if source.get("allow_mv_uploads")]

    resolved_primary_team_url = next(
        (source["channel_url"] for source in sources if source.get("display_in_team_links")),
        None,
    )

    return {
        "group": profile["group"],
        "primary_team_channel_url": resolved_primary_team_url,
        "mv_source_channels": mv_source_channels,
        "mv_allowlist_urls": [source["channel_url"] for source in mv_source_channels],
        "mv_allowlist_match_keys": dedupe_strings(
            [
                match_key
                for source in mv_source_channels
                for match_key in source.get("match_keys", [])
            ]
        ),
        "channels": sources,
    }


def build_allowlists(profiles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [build_allowlist_row(profile) for profile in profiles]


def load_allowlists(path: Path = OUTPUT_PATH) -> list[dict[str, Any]]:
    return load_json(path)


def load_allowlists_by_group(path: Path = OUTPUT_PATH) -> dict[str, dict[str, Any]]:
    return {row["group"]: row for row in load_allowlists(path)}


def main() -> None:
    profiles = load_json(PROFILES_PATH)
    rows = build_allowlists(profiles)
    changed = write_json(OUTPUT_PATH, rows)

    groups_with_primary = sum(1 for row in rows if row["primary_team_channel_url"])
    groups_with_mv_allowlist = sum(1 for row in rows if row["mv_allowlist_urls"])
    groups_with_mv_sources = sum(1 for row in rows if row["mv_source_channels"])
    label_sources = sum(
        1 for row in rows for source in row["channels"] if source.get("owner_type") == "label"
    )

    print(
        json.dumps(
            {
                "rows": len(rows),
                "groups_with_primary_team_channel": groups_with_primary,
                "groups_with_mv_allowlist": groups_with_mv_allowlist,
                "groups_with_mv_source_channels": groups_with_mv_sources,
                "label_sources": label_sources,
                "output": str(OUTPUT_PATH.relative_to(ROOT)),
                "changed": changed,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
