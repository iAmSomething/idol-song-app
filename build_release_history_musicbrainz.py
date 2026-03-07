import csv
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests

from map_latest_releases_musicbrainz import (
    BANNED_PATTERN,
    BANNED_SECONDARY_TYPES,
    fetch_release_groups,
    search_best_artist,
)
from release_classification import classify_release

ROOT = Path(__file__).resolve().parent
WATCHLIST_PATH = ROOT / "tracking_watchlist.json"
LATEST_RELEASES_PATH = ROOT / "group_latest_release_since_2025-06-01_mb.json"
OUTPUT_JSON_PATH = ROOT / "verified_release_history_mb.json"
OUTPUT_CSV_PATH = ROOT / "verified_release_history_mb.csv"
UNRESOLVED_PATH = ROOT / "verified_release_history_mb_unresolved.json"
WEB_OUTPUT_PATH = ROOT / "web/src/data/releaseHistory.json"
REQUEST_DELAY_SECONDS = 0.35
TODAY = datetime.now(timezone.utc)
VALID_PRIMARY_TYPES = {
    "Single": ("song", "single"),
    "Album": ("album", "album"),
    "EP": ("album", "ep"),
}


def is_exact_date(value: str) -> bool:
    if len(value) != 10:
        return False
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def parse_exact_date(value: str) -> Optional[datetime]:
    if not is_exact_date(value):
        return None
    return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def load_json(path: Path) -> List[Dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_tracked_groups() -> List[str]:
    rows = load_json(WATCHLIST_PATH)
    return sorted({row["group"] for row in rows}, key=str.casefold)


def load_cached_artist_rows() -> Dict[str, Dict]:
    if not LATEST_RELEASES_PATH.exists():
        return {}

    rows = load_json(LATEST_RELEASES_PATH)
    return {row["group"]: row for row in rows}


def normalize_release_group(group: str, row: Dict) -> Optional[Dict]:
    primary_type = row.get("primary-type")
    release_bucket = VALID_PRIMARY_TYPES.get(primary_type)
    if release_bucket is None:
        return None

    title = (row.get("title") or "").strip()
    if not title or BANNED_PATTERN.search(title):
        return None

    title_lower = title.lower()
    if "(from" in title_lower or " feat." in title_lower or "(feat." in title_lower or " featuring " in title_lower:
        return None

    secondary_types = set(row.get("secondary-types") or [])
    if secondary_types & BANNED_SECONDARY_TYPES:
        return None

    date_value = row.get("first-release-date") or ""
    parsed_date = parse_exact_date(date_value)
    if not parsed_date or parsed_date > TODAY:
        return None

    stream, release_kind = release_bucket
    classification = classify_release(group, title, date_value, release_kind)

    return {
        "title": title,
        "date": date_value,
        "source": f"https://musicbrainz.org/release-group/{row.get('id')}",
        "release_kind": release_kind,
        "release_format": classification["release_format"],
        "context_tags": classification["context_tags"],
        "stream": stream,
    }


def build_group_history_rows(session: requests.Session) -> tuple[List[Dict], List[Dict]]:
    tracked_groups = build_tracked_groups()
    cached_artist_rows = load_cached_artist_rows()
    output_rows: List[Dict] = []
    unresolved_rows: List[Dict] = []

    for index, group in enumerate(tracked_groups, start=1):
        cached_artist = cached_artist_rows.get(group)
        artist_name_mb = cached_artist.get("artist_name_mb") if cached_artist else None
        artist_mbid = cached_artist.get("artist_mbid") if cached_artist else None
        artist_source = cached_artist.get("artist_source") if cached_artist else None

        if not artist_mbid:
            artist = search_best_artist(session, group)
            if not artist:
                unresolved_rows.append({"group": group, "reason": "artist_not_found"})
                continue
            artist_name_mb = artist.get("name") or group
            artist_mbid = artist.get("id")
            artist_source = f"https://musicbrainz.org/artist/{artist_mbid}"

        try:
            release_groups = fetch_release_groups(session, artist_mbid)
        except Exception as error:
            unresolved_rows.append({"group": group, "reason": type(error).__name__, "artist_mbid": artist_mbid})
            continue

        seen = set()
        normalized_releases = []
        for release_group in release_groups:
            normalized = normalize_release_group(group, release_group)
            if not normalized:
                continue

            dedupe_key = (normalized["stream"], normalized["title"].casefold(), normalized["date"])
            if dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            normalized_releases.append(normalized)

        if not normalized_releases:
            unresolved_rows.append({"group": group, "reason": "no_exact_release_history", "artist_mbid": artist_mbid})
            continue

        normalized_releases.sort(
            key=lambda row: (
                row["date"],
                0 if row["stream"] == "album" else 1,
                row["title"].casefold(),
            ),
            reverse=True,
        )

        output_rows.append(
            {
                "group": group,
                "artist_name_mb": artist_name_mb or group,
                "artist_mbid": artist_mbid,
                "artist_source": artist_source or f"https://musicbrainz.org/artist/{artist_mbid}",
                "releases": normalized_releases,
            }
        )

        if index % 10 == 0 or index == len(tracked_groups):
            print(f"processed {index}/{len(tracked_groups)}")

        time.sleep(REQUEST_DELAY_SECONDS)

    output_rows.sort(key=lambda row: row["group"].casefold())
    unresolved_rows.sort(key=lambda row: row["group"].casefold())
    return output_rows, unresolved_rows


def write_outputs(rows: List[Dict], unresolved_rows: List[Dict]) -> None:
    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    OUTPUT_JSON_PATH.write_text(payload, encoding="utf-8")
    WEB_OUTPUT_PATH.write_text(payload, encoding="utf-8")
    UNRESOLVED_PATH.write_text(json.dumps(unresolved_rows, ensure_ascii=False, indent=2), encoding="utf-8")

    with OUTPUT_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "artist_name_mb",
                "artist_mbid",
                "artist_source",
                "stream",
                "title",
                "date",
                "source",
                "release_kind",
                "release_format",
                "context_tags",
            ],
        )
        writer.writeheader()
        for row in rows:
            for release in row["releases"]:
                writer.writerow(
                    {
                        "group": row["group"],
                        "artist_name_mb": row["artist_name_mb"],
                        "artist_mbid": row["artist_mbid"],
                        "artist_source": row["artist_source"],
                        "stream": release["stream"],
                        "title": release["title"],
                        "date": release["date"],
                        "source": release["source"],
                        "release_kind": release["release_kind"],
                        "release_format": release["release_format"],
                        "context_tags": " ; ".join(release["context_tags"]),
                    }
                )


def main() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": "IdolSongAppReleaseHistory/1.0 (contact: local-tool)"})

    rows, unresolved_rows = build_group_history_rows(session)
    write_outputs(rows, unresolved_rows)

    release_count = sum(len(row["releases"]) for row in rows)
    print(
        json.dumps(
            {
                "groups_with_history": len(rows),
                "unresolved_groups": len(unresolved_rows),
                "verified_release_rows": release_count,
                "output_json": OUTPUT_JSON_PATH.name,
                "web_output_json": str(WEB_OUTPUT_PATH.relative_to(ROOT)),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
