#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import requests


ROOT = Path(__file__).resolve().parent
UPCOMING_PATH = ROOT / "web/src/data/upcomingCandidates.json"
RELEASES_PATH = ROOT / "web/src/data/releases.json"
ARTWORK_PATH = ROOT / "web/src/data/releaseArtwork.json"
DETAILS_PATH = ROOT / "web/src/data/releaseDetails.json"
WATCHLIST_PATH = ROOT / "web/src/data/watchlist.json"
CUTOFF_DATE = date(2025, 6, 1)
KST = ZoneInfo("Asia/Seoul")
USER_AGENT = "idol-song-app/1.0 (https://github.com/iAmSomething/idol-song-app)"
REQUEST_DELAY_SECONDS = 0.35
MAX_RETRIES = 4
WINDOW_PHASES = {
    -1: "d_minus_1",
    0: "d_day",
    1: "d_plus_1",
}
WINDOW_PHASE_ORDER = {"d_minus_1": 0, "d_day": 1, "d_plus_1": 2}

ALIASES = {
    "(G)I-DLE": ["(G)I-DLE", "GIDLE", "i-dle", "(여자)아이들"],
    "TOMORROW X TOGETHER": ["TOMORROW X TOGETHER", "TXT"],
    "THE BOYZ": ["THE BOYZ", "The Boyz"],
    "fromis_9": ["fromis_9", "fromis 9"],
    "woo!ah!": ["woo!ah!", "wooah"],
    "CLASS:y": ["CLASS:y", "CLASSY"],
    "ALL(H)OURS": ["ALL(H)OURS", "ALL HOURS"],
    "&TEAM": ["&TEAM", "andTEAM"],
    "The KingDom": ["The KingDom", "KINGDOM"],
    "KiiiKiii": ["KiiiKiii", "KIIIKIII"],
    "ifeye": ["ifeye", "if eye"],
    "AtHeart": ["AtHeart", "ATHEART"],
    "Hearts2Hearts": ["Hearts2Hearts", "Hearts 2 Hearts"],
    "SAY MY NAME": ["SAY MY NAME", "Say My Name"],
    "NCT 127": ["NCT 127"],
    "NCT DREAM": ["NCT DREAM"],
    "NCT WISH": ["NCT WISH"],
    "QWER": ["QWER"],
    "IVE": ["IVE"],
}

QUERY_OVERRIDE = {
    "(G)I-DLE": 'artist:"i-dle"',
    "TOMORROW X TOGETHER": 'artist:"TOMORROW X TOGETHER"',
    "THE BOYZ": 'artist:"THE BOYZ"',
    "fromis_9": 'artist:"fromis_9"',
    "woo!ah!": 'artist:"wooah"',
    "The KingDom": 'artist:"The KingDom"',
    "SAY MY NAME": 'artist:"SAY MY NAME"',
    "IVE": 'artist:"IVE"',
}

BANNED_PATTERN = re.compile(
    r"\b(live|instrumental|remix|remixes|sped up|slowed|acoustic|karaoke|radio edit|commentary|demo|ver\.?|version|mixed|ost|soundtrack|original soundtrack)\b",
    re.IGNORECASE,
)
BANNED_SECONDARY_TYPES = {"Compilation", "Live", "Remix", "Soundtrack"}
RELEASE_KIND_BY_PRIMARY = {
    "Single": ("song", "single"),
    "Album": ("album", "album"),
    "EP": ("album", "ep"),
}
TAG_ORDER = (
    "pre_release",
    "title_track",
    "ost",
    "collab",
    "japanese_release",
    "special_project",
)
MINI_ALBUM_PATTERN = re.compile(r"\b(mini[- ]album|extended play|\bep\b)\b", re.IGNORECASE)
ALBUM_PATTERN = re.compile(
    r"\b(full(?:[- ]length)? album|studio album|\d+(?:st|nd|rd|th)\s+album|\balbum\b)\b",
    re.IGNORECASE,
)
SINGLE_PATTERN = re.compile(
    r"\b(digital single|single|title track|pre[- ]release(?: track| single)?|lead single|track)\b",
    re.IGNORECASE,
)
PRE_RELEASE_PATTERN = re.compile(r"\b(pre[- ]release|pre release)\b", re.IGNORECASE)
TITLE_TRACK_PATTERN = re.compile(r"\btitle track\b", re.IGNORECASE)
OST_PATTERN = re.compile(r"\bost\b|original soundtrack|soundtrack", re.IGNORECASE)
COLLAB_PATTERN = re.compile(r"\bcollab(?:oration)?\b|\bfeat\.?\b|\bfeaturing\b", re.IGNORECASE)
JAPANESE_PATTERN = re.compile(r"\bjapanese\b|\bjapan\b|[ぁ-んァ-ヴー]", re.IGNORECASE)
SPECIAL_PROJECT_PATTERN = re.compile(
    r"\b(project|special single|special album|anniversary|tribute|season song|special track)\b",
    re.IGNORECASE,
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, rows: Any) -> bool:
    serialized = json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    previous = path.read_text(encoding="utf-8") if path.exists() else None
    if previous == serialized:
        return False
    path.write_text(serialized, encoding="utf-8")
    return True


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def parse_iso_date(value: str) -> Optional[date]:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_run_date(value: str) -> date:
    parsed = parse_iso_date(value)
    if parsed is None:
        raise argparse.ArgumentTypeError("run date must use YYYY-MM-DD")
    return parsed


def infer_release_format(text: str, fallback: str) -> str:
    if MINI_ALBUM_PATTERN.search(text):
        return "ep"
    if ALBUM_PATTERN.search(text):
        return "album"
    if SINGLE_PATTERN.search(text):
        return "single"
    return fallback


def infer_context_tags(text: str) -> list[str]:
    tags: list[str] = []
    if PRE_RELEASE_PATTERN.search(text):
        tags.append("pre_release")
    if TITLE_TRACK_PATTERN.search(text):
        tags.append("title_track")
    if OST_PATTERN.search(text):
        tags.append("ost")
    if COLLAB_PATTERN.search(text):
        tags.append("collab")
    if JAPANESE_PATTERN.search(text):
        tags.append("japanese_release")
    if SPECIAL_PROJECT_PATTERN.search(text):
        tags.append("special_project")
    return [tag for tag in TAG_ORDER if tag in tags]


def classify_release(group: str, title: str, release_date: str, release_kind: str) -> dict[str, Any]:
    del group, release_date
    return {
        "release_format": infer_release_format(title, release_kind),
        "context_tags": infer_context_tags(title),
    }


def parse_published_at(value: str) -> float:
    if not value:
        return -1
    for pattern in ("%Y-%m-%dT%H:%M:%S%z", "%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(value, pattern).timestamp()
        except ValueError:
            continue
    return -1


def source_rank(source_type: str) -> int:
    if source_type in {"agency_notice", "weverse_notice"}:
        return 0
    if source_type == "news_rss":
        return 1
    return 2


def status_rank(date_status: str) -> int:
    return {"confirmed": 0, "scheduled": 1}.get(date_status, 9)


def choose_representative_targets(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        group = row.get("group", "")
        scheduled_date = row.get("scheduled_date", "")
        date_status = row.get("date_status", "")
        if not group or parse_iso_date(scheduled_date) is None:
            continue
        if date_status not in {"scheduled", "confirmed"}:
            continue

        key = (group, scheduled_date)
        current = selected.get(key)
        candidate_rank = (
            source_rank(row.get("source_type", "")),
            status_rank(date_status),
            -(float(row.get("confidence", 0) or 0)),
            -parse_published_at(row.get("published_at", "")),
            row.get("headline", ""),
        )
        if current is None:
            selected[key] = row
            continue

        current_rank = (
            source_rank(current.get("source_type", "")),
            status_rank(current.get("date_status", "")),
            -(float(current.get("confidence", 0) or 0)),
            -parse_published_at(current.get("published_at", "")),
            current.get("headline", ""),
        )
        if candidate_rank < current_rank:
            selected[key] = row

    return sorted(
        selected.values(),
        key=lambda row: (row["scheduled_date"], row["group"].lower()),
    )


def derive_due_targets(rows: list[dict[str, Any]], run_date: date, group_filter: str) -> list[dict[str, Any]]:
    due_targets: list[dict[str, Any]] = []
    filter_name = group_filter.lower()
    for row in choose_representative_targets(rows):
        scheduled_date = parse_iso_date(row["scheduled_date"])
        if scheduled_date is None:
            continue
        if filter_name and row["group"].lower() != filter_name:
            continue

        offset = (run_date - scheduled_date).days
        phase = WINDOW_PHASES.get(offset)
        if phase is None:
            continue

        due_targets.append(
            {
                "group": row["group"],
                "scheduled_date": row["scheduled_date"],
                "date_status": row.get("date_status", ""),
                "headline": row.get("headline", ""),
                "source_type": row.get("source_type", ""),
                "source_url": row.get("source_url", ""),
                "confidence": float(row.get("confidence", 0) or 0),
                "phase": phase,
                "offset_days": offset,
            }
        )

    return sorted(
        due_targets,
        key=lambda row: (
            row["scheduled_date"],
            WINDOW_PHASE_ORDER[row["phase"]],
            row["group"].lower(),
        ),
    )


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def parse_mb_date(value: str) -> Optional[date]:
    if not value:
        return None
    try:
        if len(value) == 4:
            return date(int(value), 1, 1)
        if len(value) == 7:
            year, month = value.split("-")
            return date(int(year), int(month), 1)
        if len(value) == 10:
            year, month, day = value.split("-")
            return date(int(year), int(month), int(day))
    except ValueError:
        return None
    return None


def get_json(session: requests.Session, url: str, params: dict[str, object], retries: int = MAX_RETRIES) -> dict[str, Any]:
    for attempt in range(retries):
        try:
            response = session.get(url, params={**params, "fmt": "json"}, timeout=20)
            response.raise_for_status()
            time.sleep(REQUEST_DELAY_SECONDS)
            return response.json()
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep((attempt + 1) * 1.2)
    raise RuntimeError("unreachable")


def build_name_set(group: str) -> set[str]:
    names = [group] + ALIASES.get(group, [])
    return {norm(name) for name in names if name}


def search_best_artist(session: requests.Session, group: str) -> Optional[dict[str, Any]]:
    base_query = QUERY_OVERRIDE.get(group, f'artist:"{group}"')
    query = f"{base_query} AND country:KR"

    data = get_json(session, "https://musicbrainz.org/ws/2/artist/", {"query": query, "limit": 10})
    artists = data.get("artists", [])
    if not artists:
        data = get_json(session, "https://musicbrainz.org/ws/2/artist/", {"query": base_query, "limit": 10})
        artists = data.get("artists", [])
    if not artists:
        return None

    name_set = build_name_set(group)
    group_name = norm(group)

    def score(artist: dict[str, Any]) -> float:
        artist_name = norm(artist.get("name", ""))
        score_value = 0.0
        if artist_name in name_set:
            score_value += 120
        if group_name and (group_name in artist_name or artist_name in group_name):
            score_value += 20
        if artist.get("type") == "Group":
            score_value += 25
        if artist.get("country") == "KR":
            score_value += 20
        try:
            score_value += float(artist.get("score", 0)) * 0.2
        except Exception:
            pass
        return score_value

    ranked = sorted(artists, key=score, reverse=True)
    best = ranked[0]
    if score(best) < 60:
        return None
    return best


def fetch_release_groups(session: requests.Session, artist_mbid: str, group: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    limit = 100
    offset = 0
    while True:
        data = get_json(
            session,
            "https://musicbrainz.org/ws/2/release-group",
            {"artist": artist_mbid, "limit": limit, "offset": offset},
        )
        page = data.get("release-groups", [])
        for row in page:
            row["group"] = group
        rows.extend(page)
        if len(page) < limit or offset >= 400:
            break
        offset += limit
    return rows


def normalize_release(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    primary_type = row.get("primary-type")
    release_bucket = RELEASE_KIND_BY_PRIMARY.get(primary_type)
    if release_bucket is None:
        return None

    title = row.get("title", "")
    lowered = title.lower()
    if not title or BANNED_PATTERN.search(title):
        return None
    if "(from" in lowered or " feat." in lowered or "(feat." in lowered or " featuring " in lowered:
        return None

    secondary_types = set(row.get("secondary-types") or [])
    if secondary_types & BANNED_SECONDARY_TYPES:
        return None

    release_date = parse_mb_date(row.get("first-release-date"))
    if release_date is None:
        return None

    bucket, release_kind = release_bucket
    return {
        "bucket": bucket,
        "release_kind": release_kind,
        "group": row.get("group", ""),
        "title": title,
        "date": release_date,
        "source": f"https://musicbrainz.org/release-group/{row.get('id')}",
    }


def serialize_release(entry: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if entry is None:
        return None
    classification = classify_release(
        group=entry["group"],
        title=entry["title"],
        release_date=entry["date"].isoformat(),
        release_kind=entry["release_kind"],
    )
    return {
        "title": entry["title"],
        "date": entry["date"].isoformat(),
        "source": entry["source"],
        "release_kind": entry["release_kind"],
        "release_format": classification["release_format"],
        "context_tags": classification["context_tags"],
    }


def pick_latest_pair(release_groups: list[dict[str, Any]], run_date: date) -> tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
    normalized = [entry for row in release_groups if (entry := normalize_release(row))]
    latest: dict[str, Optional[dict[str, Any]]] = {"song": None, "album": None}
    for bucket in ("song", "album"):
        candidates = [entry for entry in normalized if entry["bucket"] == bucket and entry["date"] <= run_date]
        if candidates:
            latest[bucket] = sorted(candidates, key=lambda entry: entry["date"], reverse=True)[0]
    return latest["song"], latest["album"]


def filter_recent_release(entry: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if entry is None or entry["date"] <= CUTOFF_DATE:
        return None
    return entry


def newest_release(row: dict[str, Any]) -> Optional[dict[str, Any]]:
    releases = [release for release in [row.get("latest_song"), row.get("latest_album")] if release]
    if not releases:
        return None
    return sorted(releases, key=lambda release: release["date"], reverse=True)[0]


def extract_tracks(release: dict[str, Any]) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []
    order = 1
    for medium in release.get("media", []):
        for track in medium.get("tracks", []):
            title = track.get("title") or track.get("recording", {}).get("title")
            if not title:
                continue
            tracks.append({"order": order, "title": title})
            order += 1
    return tracks


def extract_youtube_video_id(resource: str) -> Optional[str]:
    parsed = urlparse(resource)
    host = parsed.netloc.lower()
    if "youtu.be" in host:
        return parsed.path.strip("/") or None
    if "youtube.com" in host:
        return parse_qs(parsed.query).get("v", [None])[0]
    return None


def extract_urls(relations: list[dict[str, Any]]) -> tuple[Optional[str], Optional[str], Optional[str]]:
    spotify_url = None
    youtube_music_url = None
    youtube_video_id = None
    for relation in relations:
        resource = relation.get("url", {}).get("resource")
        if not resource:
            continue
        lowered = resource.lower()
        if spotify_url is None and "open.spotify.com/" in lowered:
            spotify_url = resource
        if youtube_music_url is None and "music.youtube.com/" in lowered:
            youtube_music_url = resource
        if youtube_video_id is None:
            youtube_video_id = extract_youtube_video_id(resource)
    return spotify_url, youtube_music_url, youtube_video_id


def build_notes(track_count: int, release_kind: str, spotify_url: Optional[str], youtube_music_url: Optional[str]) -> str:
    kind_label = release_kind.upper()
    if track_count:
        note = f"Representative MusicBrainz {kind_label} seed with {track_count} track"
        if track_count != 1:
            note += "s"
        note += "."
    else:
        note = "Representative MusicBrainz seed without track rows."

    linked_services: list[str] = []
    if spotify_url:
        linked_services.append("Spotify")
    if youtube_music_url:
        linked_services.append("YouTube Music")
    if linked_services:
        note += f" Canonical links: {', '.join(linked_services)}."
    return note


def build_empty_detail(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "group": item["group"],
        "release_title": item["release_title"],
        "release_date": item["release_date"],
        "stream": item["stream"],
        "release_kind": item["release_kind"],
        "tracks": [],
        "spotify_url": None,
        "youtube_music_url": None,
        "youtube_video_id": None,
        "notes": "Release detail seed unavailable in MusicBrainz; UI fallback applies.",
    }


def score_release(release: dict[str, Any], title: str, release_date: str) -> int:
    score = 0
    if release.get("title") == title:
        score += 40
    if release.get("date") == release_date:
        score += 30
    if release.get("status") == "Official":
        score += 20
    if release.get("country") == "XW":
        score += 10
    elif release.get("country") == "KR":
        score += 6
    if release.get("packaging") == "None":
        score += 2
    return score


def build_detail_row(session: requests.Session, item: dict[str, Any]) -> dict[str, Any]:
    release_group_id = item["release_group_id"]
    release_group = get_json(
        session,
        f"https://musicbrainz.org/ws/2/release-group/{release_group_id}",
        {"inc": "releases+url-rels"},
    )
    candidate_releases = sorted(
        release_group.get("releases", []),
        key=lambda release: score_release(release, item["release_title"], item["release_date"]),
        reverse=True,
    )
    if not candidate_releases:
        return build_empty_detail(item)

    fallback = build_empty_detail(item)
    for candidate in candidate_releases[:4]:
        release = get_json(
            session,
            f"https://musicbrainz.org/ws/2/release/{candidate['id']}",
            {"inc": "recordings+url-rels"},
        )
        tracks = extract_tracks(release)
        spotify_url, youtube_music_url, youtube_video_id = extract_urls(release.get("relations", []))
        if not tracks and not spotify_url and not youtube_music_url and not youtube_video_id:
            continue

        return {
            "group": item["group"],
            "release_title": item["release_title"],
            "release_date": item["release_date"],
            "stream": item["stream"],
            "release_kind": item["release_kind"],
            "tracks": tracks,
            "spotify_url": spotify_url,
            "youtube_music_url": youtube_music_url,
            "youtube_video_id": youtube_video_id,
            "notes": build_notes(len(tracks), item["release_kind"], spotify_url, youtube_music_url),
        }
    return fallback


def build_release_items(row: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key, stream in (("latest_song", "song"), ("latest_album", "album")):
        release = row.get(key)
        if not release:
            continue
        items.append(
            {
                "group": row["group"],
                "release_title": release["title"],
                "release_date": release["date"],
                "stream": stream,
                "release_kind": release["release_kind"],
                "release_group_id": release["source"].rsplit("/", 1)[-1],
            }
        )
    return items


def build_artwork_row(group: str, release: dict[str, Any], stream: str) -> dict[str, Any]:
    release_group_id = release["source"].rsplit("/", 1)[-1]
    artwork_source_url = f"https://coverartarchive.org/release-group/{release_group_id}"
    return {
        "group": group,
        "release_title": release["title"],
        "release_date": release["date"],
        "stream": stream,
        "cover_image_url": f"{artwork_source_url}/front",
        "thumbnail_image_url": f"{artwork_source_url}/front-250",
        "artwork_source_type": "cover_art_archive",
        "artwork_source_url": artwork_source_url,
    }


def collect_window_candidates(release_groups: list[dict[str, Any]], scheduled_date: date) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for row in release_groups:
        entry = normalize_release(row)
        if entry is None:
            continue
        delta_days = (entry["date"] - scheduled_date).days
        if abs(delta_days) > 1:
            continue
        candidates.append(
            {
                "title": entry["title"],
                "date": entry["date"].isoformat(),
                "release_kind": entry["release_kind"],
                "stream": entry["bucket"],
                "delta_days": delta_days,
                "source": entry["source"],
            }
        )
    candidates.sort(key=lambda row: (abs(row["delta_days"]), row["date"], row["stream"], row["title"].lower()))
    return candidates[:3]


def hydrate_group(
    session: requests.Session,
    group: str,
    run_date: date,
    targets: list[dict[str, Any]],
) -> dict[str, Any]:
    artist = search_best_artist(session, group)
    if artist is None:
        raise RuntimeError("artist_not_found")

    artist_mbid = artist["id"]
    release_groups = fetch_release_groups(session, artist_mbid, group)
    preflight = []
    for target in targets:
        scheduled_date = parse_iso_date(target["scheduled_date"])
        if scheduled_date is None:
            continue
        preflight.append(
            {
                "phase": target["phase"],
                "scheduled_date": target["scheduled_date"],
                "headline": target["headline"],
                "candidate_releases": collect_window_candidates(release_groups, scheduled_date),
            }
        )

    needs_release_update = any(target["phase"] in {"d_day", "d_plus_1"} for target in targets)
    if not needs_release_update:
        return {
            "group": group,
            "targets": targets,
            "preflight": preflight,
            "release_row": None,
            "detail_rows": [],
            "artwork_rows": [],
            "watchlist_release": None,
            "updated": False,
            "reason": "preflight_only",
        }

    latest_song, latest_album = pick_latest_pair(release_groups, run_date)
    recent_song = filter_recent_release(latest_song)
    recent_album = filter_recent_release(latest_album)
    if recent_song is None and recent_album is None:
        return {
            "group": group,
            "targets": targets,
            "preflight": preflight,
            "release_row": None,
            "detail_rows": [],
            "artwork_rows": [],
            "watchlist_release": None,
            "updated": False,
            "reason": "no_recent_release_match",
        }

    release_row = {
        "group": group,
        "artist_name_mb": artist.get("name"),
        "artist_mbid": artist_mbid,
        "latest_song": serialize_release(recent_song),
        "latest_album": serialize_release(recent_album),
        "artist_source": f"https://musicbrainz.org/artist/{artist_mbid}",
    }

    detail_rows: list[dict[str, Any]] = []
    for item in build_release_items(release_row):
        try:
            detail_rows.append(build_detail_row(session, item))
        except Exception:
            detail_rows.append(build_empty_detail(item))

    artwork_rows: list[dict[str, Any]] = []
    if release_row["latest_song"]:
        artwork_rows.append(build_artwork_row(group, release_row["latest_song"], "song"))
    if release_row["latest_album"]:
        artwork_rows.append(build_artwork_row(group, release_row["latest_album"], "album"))

    return {
        "group": group,
        "targets": targets,
        "preflight": preflight,
        "release_row": release_row,
        "detail_rows": detail_rows,
        "artwork_rows": artwork_rows,
        "watchlist_release": newest_release(release_row),
        "updated": True,
        "reason": "hydrated",
    }


def merge_release_rows(rows: list[dict[str, Any]], hydrated_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_group = {row["group"]: row for row in rows}
    for row in hydrated_rows:
        by_group[row["group"]] = row
    return sorted(by_group.values(), key=lambda row: row["group"].lower())


def merge_rows_for_group(rows: list[dict[str, Any]], additions_by_group: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    merged = [row for row in rows if row.get("group") not in additions_by_group]
    for rows_for_group in additions_by_group.values():
        merged.extend(rows_for_group)
    return sorted(
        merged,
        key=lambda row: (
            row.get("group", "").lower(),
            row.get("release_date", ""),
            row.get("stream", ""),
            row.get("release_title", "").lower(),
        ),
    )


def merge_watchlist_rows(rows: list[dict[str, Any]], hydrated: list[dict[str, Any]]) -> list[dict[str, Any]]:
    updates = {row["group"]: row["watchlist_release"] for row in hydrated if row["watchlist_release"]}
    merged: list[dict[str, Any]] = []
    for row in rows:
        latest_release = updates.get(row.get("group"))
        if latest_release is None:
            merged.append(row)
            continue
        next_row = dict(row)
        next_row["latest_release_title"] = latest_release["title"]
        next_row["latest_release_date"] = latest_release["date"]
        next_row["latest_release_kind"] = latest_release["release_kind"]
        merged.append(next_row)
    return merged


def default_run_date() -> date:
    return datetime.now(KST).date()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--today", type=parse_run_date, default=default_run_date())
    parser.add_argument("--group", type=str, default="", help="hydrate a single group")
    parser.add_argument("--dry-run", action="store_true", help="report due hydration targets without writing files")
    parser.add_argument("--strict", action="store_true", help="exit non-zero when hydration errors occur")
    args = parser.parse_args()

    upcoming_rows = load_json(UPCOMING_PATH)
    due_targets = derive_due_targets(upcoming_rows, args.today, args.group)
    phase_counts = Counter(target["phase"] for target in due_targets)
    summary: dict[str, Any] = {
        "run_date": args.today.isoformat(),
        "dry_run": args.dry_run,
        "due_targets": len(due_targets),
        "phase_counts": {
            "d_minus_1": phase_counts.get("d_minus_1", 0),
            "d_day": phase_counts.get("d_day", 0),
            "d_plus_1": phase_counts.get("d_plus_1", 0),
        },
        "targets": due_targets,
        "hydrated_groups": [],
        "files_changed": [],
        "errors": [],
    }

    if not due_targets:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    targets_by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for target in due_targets:
        targets_by_group[target["group"]].append(target)

    hydrated_results: list[dict[str, Any]] = []
    for group in sorted(targets_by_group):
        try:
            result = hydrate_group(session, group, args.today, targets_by_group[group])
            hydrated_results.append(result)
        except Exception as error:
            summary["errors"].append({"group": group, "error": type(error).__name__})

    summary["hydrated_groups"] = [
        {
            "group": row["group"],
            "phases": [target["phase"] for target in row["targets"]],
            "updated": row["updated"],
            "reason": row["reason"],
            "preflight": row["preflight"],
            "release_title": row["watchlist_release"]["title"] if row["watchlist_release"] else None,
            "release_date": row["watchlist_release"]["date"] if row["watchlist_release"] else None,
        }
        for row in hydrated_results
    ]

    if args.dry_run:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if args.strict and summary["errors"]:
            raise SystemExit(f"Release hydration failed for {len(summary['errors'])} group(s).")
        return

    successful_updates = [row for row in hydrated_results if row["updated"] and row["release_row"]]
    if successful_updates:
        release_rows = load_json(RELEASES_PATH)
        artwork_rows = load_json(ARTWORK_PATH)
        detail_rows = load_json(DETAILS_PATH)
        watchlist_rows = load_json(WATCHLIST_PATH)

        merged_releases = merge_release_rows(release_rows, [row["release_row"] for row in successful_updates if row["release_row"]])
        merged_artwork = merge_rows_for_group(
            artwork_rows,
            {row["group"]: row["artwork_rows"] for row in successful_updates},
        )
        merged_details = merge_rows_for_group(
            detail_rows,
            {row["group"]: row["detail_rows"] for row in successful_updates},
        )
        merged_watchlist = merge_watchlist_rows(watchlist_rows, successful_updates)

        if write_json(RELEASES_PATH, merged_releases):
            summary["files_changed"].append(display_path(RELEASES_PATH))
        if write_json(ARTWORK_PATH, merged_artwork):
            summary["files_changed"].append(display_path(ARTWORK_PATH))
        if write_json(DETAILS_PATH, merged_details):
            summary["files_changed"].append(display_path(DETAILS_PATH))
        if write_json(WATCHLIST_PATH, merged_watchlist):
            summary["files_changed"].append(display_path(WATCHLIST_PATH))

    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.strict and summary["errors"]:
        raise SystemExit(f"Release hydration failed for {len(summary['errors'])} group(s).")


if __name__ == "__main__":
    main()
