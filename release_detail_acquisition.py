import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse

import requests

MUSICBRAINZ_USER_AGENT = "idol-song-app/1.0 (https://github.com/iAmSomething/idol-song-app)"
REQUEST_DELAY_SECONDS = 0.03
REQUEST_TIMEOUT_SECONDS = 8
MAX_REQUEST_RETRIES = 2

DETAIL_STATUS_VERIFIED = "verified"
YOUTUBE_VIDEO_STATUS_RELATION = "relation_match"


def optional_text(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None

    stripped = value.strip()
    return stripped or None


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


def get_missing_release_detail_fields(detail: Dict) -> List[str]:
    missing_fields: List[str] = []
    if not detail.get("tracks"):
        missing_fields.append("tracks")
    if optional_text(detail.get("spotify_url")) is None:
        missing_fields.append("spotify_url")
    if optional_text(detail.get("youtube_music_url")) is None:
        missing_fields.append("youtube_music_url")
    if optional_text(detail.get("youtube_video_url")) is None and optional_text(detail.get("youtube_video_id")) is None:
        missing_fields.append("youtube_video")
    return missing_fields


def get_actionable_release_detail_fields(detail: Dict) -> List[str]:
    return [
        field
        for field in get_missing_release_detail_fields(detail)
        if field in {"tracks", "spotify_url"}
    ]


def build_attempt(method: str, success: bool, filled_fields: Optional[List[str]] = None, note: Optional[str] = None) -> Dict:
    return {
        "method": method,
        "success": success,
        "filled_fields": filled_fields or [],
        "note": note,
    }


class MusicBrainzReleaseDetailClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers["User-Agent"] = MUSICBRAINZ_USER_AGENT
        self._json_cache: Dict[str, Dict] = {}

    def _cache_key(self, url: str, params: Dict[str, object]) -> str:
        return f"{url}?{urlencode(sorted(params.items()), doseq=True)}"

    def _get_json(self, url: str, params: Dict[str, object]) -> Dict:
        cache_key = self._cache_key(url, params)
        cached = self._json_cache.get(cache_key)
        if cached is not None:
            return cached

        request_params = {**params, "fmt": "json"}
        last_error: Optional[Exception] = None
        for attempt in range(MAX_REQUEST_RETRIES):
            try:
                response = self.session.get(url, params=request_params, timeout=REQUEST_TIMEOUT_SECONDS)
                response.raise_for_status()
                payload = response.json()
                self._json_cache[cache_key] = payload
                time.sleep(REQUEST_DELAY_SECONDS)
                return payload
            except Exception as error:  # noqa: BLE001
                last_error = error
                if attempt == MAX_REQUEST_RETRIES - 1:
                    break
                time.sleep((attempt + 1) * 1.0)

        if last_error is not None:
            raise last_error
        raise RuntimeError("MusicBrainz request failed without a captured error")

    def fetch_release_group(self, release_group_id: str) -> Dict:
        return self._get_json(
            f"https://musicbrainz.org/ws/2/release-group/{release_group_id}",
            {"inc": "releases+url-rels"},
        )

    def fetch_release(self, release_id: str) -> Dict:
        return self._get_json(
            f"https://musicbrainz.org/ws/2/release/{release_id}",
            {"inc": "recordings+url-rels"},
        )

    def search_releases(self, item: Dict) -> Dict:
        query = (
            f'release:"{item["release_title"]}" AND artist:"{item["group"]}" '
            f'AND date:{item["release_date"]}'
        )
        return self._get_json(
            "https://musicbrainz.org/ws/2/release",
            {"query": query, "limit": 5},
        )


def score_release(release: Dict, item: Dict) -> int:
    score = 0
    if release.get("title") == item["release_title"]:
        score += 40
    if release.get("date") == item["release_date"]:
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


def select_candidate_release(releases: List[Dict], item: Dict) -> Optional[Dict]:
    if not releases:
        return None

    return sorted(releases, key=lambda release: score_release(release, item), reverse=True)[0]


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


def extract_service_urls(relations: List[Dict]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    spotify_url = None
    youtube_music_url = None
    youtube_video_id = None
    youtube_video_url = None

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
            extracted_video_id = extract_youtube_video_id(resource)
            if extracted_video_id:
                youtube_video_id = extracted_video_id
                youtube_video_url = build_youtube_video_url(extracted_video_id)

    return spotify_url, youtube_music_url, youtube_video_id, youtube_video_url


def enrich_from_release_payload(
    detail: Dict,
    release_payload: Dict,
    source_label: str,
    release_group_payload: Optional[Dict] = None,
) -> Tuple[Dict, List[str]]:
    filled_fields: List[str] = []
    tracks = extract_tracks(release_payload)
    release_spotify_url, release_youtube_music_url, release_video_id, release_video_url = extract_service_urls(
        release_payload.get("relations", [])
    )
    group_spotify_url = None
    group_youtube_music_url = None
    group_video_id = None
    group_video_url = None
    if release_group_payload is not None:
        group_spotify_url, group_youtube_music_url, group_video_id, group_video_url = extract_service_urls(
            release_group_payload.get("relations", [])
        )

    spotify_url = release_spotify_url or group_spotify_url
    youtube_music_url = release_youtube_music_url or group_youtube_music_url
    youtube_video_id = release_video_id or group_video_id
    youtube_video_url = release_video_url or group_video_url

    if tracks and not detail.get("tracks"):
        detail["tracks"] = tracks
        filled_fields.append("tracks")
    if spotify_url and optional_text(detail.get("spotify_url")) is None:
        detail["spotify_url"] = spotify_url
        filled_fields.append("spotify_url")
    if youtube_music_url and optional_text(detail.get("youtube_music_url")) is None:
        detail["youtube_music_url"] = youtube_music_url
        filled_fields.append("youtube_music_url")
    if youtube_video_id and optional_text(detail.get("youtube_video_id")) is None:
        detail["youtube_video_id"] = youtube_video_id
        detail["youtube_video_url"] = youtube_video_url or build_youtube_video_url(youtube_video_id)
        detail["youtube_video_status"] = YOUTUBE_VIDEO_STATUS_RELATION
        detail["youtube_video_provenance"] = f"{source_label}.url_relation"
        filled_fields.append("youtube_video")

    if filled_fields:
        detail["detail_status"] = DETAIL_STATUS_VERIFIED
        detail["detail_provenance"] = source_label
        note = f" MusicBrainz acquisition enriched: {', '.join(filled_fields)} ({source_label})."
        if note not in detail["notes"]:
            detail["notes"] += note

    return detail, filled_fields


def enrich_release_detail(
    client: MusicBrainzReleaseDetailClient,
    item: Dict,
    detail: Dict,
) -> Tuple[Dict, List[Dict]]:
    attempts: List[Dict] = []
    if not get_missing_release_detail_fields(detail):
        return detail, attempts

    release_group_payload: Optional[Dict] = None
    if item.get("release_group_id"):
        try:
            release_group_payload = client.fetch_release_group(item["release_group_id"])
            attempts.append(
                build_attempt(
                    "musicbrainz_release_group_lookup",
                    True,
                    note=f"release_group_id={item['release_group_id']}",
                )
            )
        except Exception as error:  # noqa: BLE001
            attempts.append(
                build_attempt(
                    "musicbrainz_release_group_lookup",
                    False,
                    note=f"request_failed:{type(error).__name__}",
                )
            )
    else:
        attempts.append(build_attempt("musicbrainz_release_group_lookup", False, note="missing_release_group_id"))

    candidate_release = None
    if release_group_payload is not None:
        candidate_release = select_candidate_release(release_group_payload.get("releases", []), item)

    if candidate_release is not None:
        try:
            release_payload = client.fetch_release(candidate_release["id"])
            detail, filled_fields = enrich_from_release_payload(
                detail,
                release_payload,
                "musicbrainz.release_group_release",
                release_group_payload,
            )
            attempts.append(
                build_attempt(
                    "musicbrainz_release_group_release_lookup",
                    bool(filled_fields),
                    filled_fields,
                    note=f"release_id={candidate_release['id']}",
                )
            )
        except Exception as error:  # noqa: BLE001
            attempts.append(
                build_attempt(
                    "musicbrainz_release_group_release_lookup",
                    False,
                    note=f"request_failed:{type(error).__name__}",
                )
            )
    else:
        attempts.append(build_attempt("musicbrainz_release_group_release_lookup", False, note="no_candidate_release"))

    remaining_missing_fields = get_missing_release_detail_fields(detail)
    should_attempt_release_search = "tracks" in remaining_missing_fields

    if should_attempt_release_search:
        try:
            search_payload = client.search_releases(item)
            search_releases = search_payload.get("releases", [])
            attempts.append(
                build_attempt(
                    "musicbrainz_release_search_lookup",
                    bool(search_releases),
                    note=f"candidates={len(search_releases)}",
                )
            )
            search_candidate = select_candidate_release(search_releases, item)
            if search_candidate is not None:
                try:
                    release_payload = client.fetch_release(search_candidate["id"])
                    detail, filled_fields = enrich_from_release_payload(
                        detail,
                        release_payload,
                        "musicbrainz.release_search_release",
                        None,
                    )
                    attempts.append(
                        build_attempt(
                            "musicbrainz_release_search_release_lookup",
                            bool(filled_fields),
                            filled_fields,
                            note=f"release_id={search_candidate['id']}",
                        )
                    )
                except Exception as error:  # noqa: BLE001
                    attempts.append(
                        build_attempt(
                            "musicbrainz_release_search_release_lookup",
                            False,
                            note=f"request_failed:{type(error).__name__}",
                        )
                    )
            else:
                attempts.append(
                    build_attempt(
                        "musicbrainz_release_search_release_lookup",
                        False,
                        note="no_candidate_release",
                    )
                )
        except Exception as error:  # noqa: BLE001
            attempts.append(
                build_attempt(
                    "musicbrainz_release_search_lookup",
                    False,
                    note=f"request_failed:{type(error).__name__}",
                )
            )
            attempts.append(
                build_attempt(
                    "musicbrainz_release_search_release_lookup",
                    False,
                    note="search_unavailable",
                )
            )
    else:
        attempts.append(
            build_attempt(
                "musicbrainz_release_search_lookup",
                False,
                note="skipped_no_track_gap",
            )
        )
        attempts.append(
            build_attempt(
                "musicbrainz_release_search_release_lookup",
                False,
                note="skipped_no_track_gap",
            )
        )

    return detail, attempts
