import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests

ROOT = Path(__file__).resolve().parent
RELEASES_PATH = ROOT / "web/src/data/releases.json"
OUTPUT_PATH = ROOT / "web/src/data/releaseDetails.json"
OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
USER_AGENT = "idol-song-app/1.0 (https://github.com/iAmSomething/idol-song-app)"
REQUEST_DELAY_SECONDS = 0.35
MAX_RETRIES = 4


def get_json(session: requests.Session, url: str, params: Dict[str, object]) -> Dict:
    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(url, params={**params, "fmt": "json"}, timeout=20)
            response.raise_for_status()
            time.sleep(REQUEST_DELAY_SECONDS)
            return response.json()
        except Exception:
            if attempt == MAX_RETRIES - 1:
                raise
            time.sleep((attempt + 1) * 1.2)
    raise RuntimeError("unreachable")


def iter_release_items(rows: List[Dict]) -> List[Dict]:
    items: List[Dict] = []
    for row in rows:
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


def get_detail_key(group: str, release_title: str, release_date: str, stream: str) -> str:
    return "::".join([group, release_title, release_date, stream]).lower()


def load_detail_overrides() -> Dict[str, Dict]:
    if not OVERRIDES_PATH.exists():
        return {}

    with OVERRIDES_PATH.open() as handle:
        rows = json.load(handle)

    return {
        get_detail_key(row["group"], row["release_title"], row["release_date"], row["stream"]): row
        for row in rows
    }


def score_release(release: Dict, title: str, release_date: str) -> int:
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


def select_candidate_releases(releases: List[Dict], title: str, release_date: str) -> List[Dict]:
    return sorted(
        releases,
        key=lambda release: score_release(release, title, release_date),
        reverse=True,
    )


def extract_tracks(release: Dict) -> List[Dict]:
    tracks: List[Dict] = []
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


def extract_urls(relations: List[Dict]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
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

    linked_services = []
    if spotify_url:
        linked_services.append("Spotify")
    if youtube_music_url:
        linked_services.append("YouTube Music")
    if linked_services:
        note += f" Canonical links: {', '.join(linked_services)}."

    return note


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
        "youtube_video_id": None,
        "notes": "Release detail seed unavailable in MusicBrainz; UI fallback applies.",
    }


def apply_detail_override(detail: Dict, override_by_key: Dict[str, Dict]) -> Tuple[Dict, bool]:
    override = override_by_key.get(
        get_detail_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
    )
    if not override:
        return detail, False

    youtube_music_url = override.get("youtube_music_url")
    if youtube_music_url:
        detail["youtube_music_url"] = youtube_music_url

    provenance = override.get("provenance")
    if provenance and provenance not in detail["notes"]:
        detail["notes"] += f" Canonical YouTube Music URL preserved from release_detail_overrides.json ({provenance})."

    return detail, True


def build_detail_row(session: requests.Session, item: Dict) -> Dict:
    release_group = get_json(
        session,
        f"https://musicbrainz.org/ws/2/release-group/{item['release_group_id']}",
        {"inc": "releases+url-rels"},
    )
    candidate_releases = select_candidate_releases(
        release_group.get("releases", []),
        item["release_title"],
        item["release_date"],
    )

    if not candidate_releases:
        return build_empty_detail(item)

    fallback_row = build_empty_detail(item)

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

    return fallback_row


def main() -> None:
    with RELEASES_PATH.open() as handle:
        release_rows = json.load(handle)

    items = iter_release_items(release_rows)
    details: List[Dict] = []
    override_by_key = load_detail_overrides()
    applied_overrides = 0

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    for index, item in enumerate(items, start=1):
        print(
            f"[{index}/{len(items)}] {item['group']} · {item['release_title']} · {item['stream']}",
            flush=True,
        )
        detail, was_overridden = apply_detail_override(build_detail_row(session, item), override_by_key)
        applied_overrides += int(was_overridden)
        details.append(detail)

    details.sort(
        key=lambda row: (
            row["group"].lower(),
            row["release_date"],
            row["stream"],
            row["release_title"].lower(),
        )
    )

    OUTPUT_PATH.write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n")

    with_tracks = sum(1 for row in details if row["tracks"])
    with_spotify = sum(1 for row in details if row["spotify_url"])
    with_youtube_music = sum(1 for row in details if row["youtube_music_url"])
    with_video = sum(1 for row in details if row["youtube_video_id"])

    print(
        json.dumps(
            {
                "count": len(details),
                "with_tracks": with_tracks,
                "with_spotify": with_spotify,
                "with_youtube_music": with_youtube_music,
                "with_video": with_video,
                "youtube_music_overrides": applied_overrides,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
