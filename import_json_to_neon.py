import argparse
import json
import os
import re
import unicodedata
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlsplit, urlunsplit

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError as error:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "psycopg is required. Run `python3 -m pip install -r backend/requirements-import.txt` first."
    ) from error


ROOT = Path(__file__).resolve().parent
BACKEND_REPORTS_DIR = ROOT / "backend" / "reports"
DEFAULT_SUMMARY_PATH = BACKEND_REPORTS_DIR / "json_to_neon_import_summary.json"
ARTIST_PROFILES_PATH = ROOT / "web" / "src" / "data" / "artistProfiles.json"
YOUTUBE_ALLOWLISTS_PATH = ROOT / "web" / "src" / "data" / "youtubeChannelAllowlists.json"
RELEASE_DETAILS_PATH = ROOT / "web" / "src" / "data" / "releaseDetails.json"
RELEASE_HISTORY_PATH = ROOT / "web" / "src" / "data" / "releaseHistory.json"
RELEASE_ARTWORK_PATH = ROOT / "web" / "src" / "data" / "releaseArtwork.json"
UPCOMING_CANDIDATES_PATH = ROOT / "web" / "src" / "data" / "upcomingCandidates.json"
WATCHLIST_PATH = ROOT / "web" / "src" / "data" / "watchlist.json"
RELEASE_DETAIL_OVERRIDES_PATH = ROOT / "release_detail_overrides.json"
MANUAL_REVIEW_QUEUE_PATH = ROOT / "manual_review_queue.json"
MV_MANUAL_REVIEW_QUEUE_PATH = ROOT / "mv_manual_review_queue.json"
RELEASES_ROLLUP_PATH = ROOT / "web" / "src" / "data" / "releases.json"

TARGET_TABLES = [
    "entities",
    "entity_aliases",
    "entity_official_links",
    "youtube_channels",
    "entity_youtube_channels",
    "releases",
    "release_artwork",
    "tracks",
    "release_service_links",
    "track_service_links",
    "upcoming_signals",
    "upcoming_signal_sources",
    "entity_tracking_state",
    "review_tasks",
    "release_link_overrides",
]
RELEASE_PIPELINE_TABLES = [
    "entities",
    "youtube_channels",
    "entity_youtube_channels",
    "releases",
    "release_artwork",
    "tracks",
    "release_service_links",
    "track_service_links",
    "entity_tracking_state",
    "review_tasks",
    "release_link_overrides",
]
RELEASE_PIPELINE_REVIEW_SOURCE_DATASETS = {"mv_manual_review_queue"}

NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "https://github.com/iAmSomething/idol-song-app/import-json-to-neon/v1")
SOLO_SLUGS = {
    "chung-ha",
    "chuu",
    "jeon-somi",
    "kwon-eunbi",
    "yena",
    "yuju",
    "yves",
}
UNIT_GROUPS = {"ARTMS", "NCT DREAM", "NCT WISH", "VIVIZ"}
PROJECT_SLUGS = {"allday-project"}
MUSICBRAINZ_ARTIST_PATTERN = re.compile(r"/artist/([0-9a-f-]{36})/?$", re.IGNORECASE)
MUSICBRAINZ_RELEASE_GROUP_PATTERN = re.compile(r"/release-group/([0-9a-f-]{36})/?$", re.IGNORECASE)


def load_json(path: Path) -> List[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_url(value: Any) -> Optional[str]:
    text = optional_text(value)
    if text is None:
        return None

    parsed = urlsplit(text)
    path = parsed.path.rstrip("/") or parsed.path
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))


def normalize_search_text(value: str) -> str:
    return (
        unicodedata.normalize("NFKC", value)
        .replace("×", "x")
        .replace("✕", "x")
        .replace("&", " and ")
        .lower()
        .replace("'", "")
        .replace("’", "")
        .replace("`", "")
    )


def collapse_normalized_text(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+", " ", value)
    collapsed = re.sub(r"\s+", " ", collapsed).strip()
    return collapsed


def normalize_text(value: str) -> str:
    return collapse_normalized_text(normalize_search_text(value))


def stable_uuid(kind: str, *parts: Any) -> uuid.UUID:
    normalized_parts = [kind]
    for part in parts:
        if isinstance(part, (dict, list)):
            normalized_parts.append(json.dumps(part, ensure_ascii=False, sort_keys=True))
        elif part is None:
            normalized_parts.append("")
        else:
            normalized_parts.append(str(part))
    return uuid.uuid5(NAMESPACE, "|".join(normalized_parts))


def parse_exact_date(value: Any) -> Optional[date]:
    text = optional_text(value)
    if text is None:
        return None
    try:
        return datetime.strptime(text, "%Y-%m-%d").date()
    except ValueError:
        return None


def parse_month_start(value: Any) -> Optional[date]:
    text = optional_text(value)
    if text is None:
        return None
    try:
        return datetime.strptime(text, "%Y-%m").date().replace(day=1)
    except ValueError:
        return None


def parse_timestamp(value: Any) -> Optional[datetime]:
    text = optional_text(value)
    if text is None:
        return None

    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}T.+", text):
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        else:
            parsed = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def extract_musicbrainz_artist_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    match = MUSICBRAINZ_ARTIST_PATTERN.search(url)
    return match.group(1) if match else None


def extract_musicbrainz_release_group_id(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    match = MUSICBRAINZ_RELEASE_GROUP_PATTERN.search(url)
    return match.group(1) if match else None


def stream_from_release_kind(value: Optional[str]) -> str:
    return "song" if value == "single" else "album"


def infer_entity_type(profile: Dict[str, Any]) -> str:
    slug = profile["slug"]
    group = profile["group"]
    if slug in SOLO_SLUGS:
        return "solo"
    if slug in PROJECT_SLUGS or "PROJECT" in group.upper():
        return "project"
    if group in UNIT_GROUPS:
        return "unit"
    return "group"


def classify_alias_type(alias: str, source: str) -> str:
    if source == "search_aliases":
        return "search_seed"
    if re.search(r"[\u3131-\u318e\uac00-\ud7a3]", alias):
        return "common_ko"
    return "legacy"


def release_key(group: str, release_title: str, release_date: str, stream: str) -> Tuple[str, str, str, str]:
    return (group, normalize_text(release_title), release_date, stream)


def pretty_release_key(group: str, release_title: str, release_date: str, stream: str) -> str:
    return f"{group} | {release_date} | {stream} | {release_title}"


def make_signal_dedupe_key(row: Dict[str, Any]) -> str:
    return "|".join(
        [
            row["group"],
            normalize_text(row["headline"]),
            optional_text(row.get("scheduled_date")) or "",
            optional_text(row.get("scheduled_month")) or "",
            row["date_precision"],
            normalize_url(row.get("source_url")) or "",
        ]
    )


def ensure_directory(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def record_drop(store: Dict[str, List[Dict[str, Any]]], table: str, payload: Dict[str, Any]) -> None:
    rows = store.setdefault(table, [])
    if len(rows) < 10:
        rows.append(payload)


def build_group_metadata(
    release_history_rows: Sequence[Dict[str, Any]],
    releases_rollup_rows: Sequence[Dict[str, Any]],
) -> Dict[str, Dict[str, Optional[str]]]:
    metadata: Dict[str, Dict[str, Optional[str]]] = {}
    for row in release_history_rows:
        metadata[row["group"]] = {
            "artist_mbid": optional_text(row.get("artist_mbid")),
            "artist_source": normalize_url(row.get("artist_source")),
        }

    for row in releases_rollup_rows:
        metadata.setdefault(
            row["group"],
            {
                "artist_mbid": optional_text(row.get("artist_mbid")),
                "artist_source": normalize_url(row.get("artist_source")),
            },
        )

    return metadata


def build_entity_rows(
    artist_profiles: Sequence[Dict[str, Any]],
    watchlist_by_group: Dict[str, Dict[str, Any]],
    group_metadata: Dict[str, Dict[str, Optional[str]]],
) -> Tuple[List[Dict[str, Any]], Dict[str, uuid.UUID]]:
    entity_rows: List[Dict[str, Any]] = []
    entity_ids: Dict[str, uuid.UUID] = {}

    for profile in sorted(artist_profiles, key=lambda row: row["group"].casefold()):
        entity_id = stable_uuid("entity", profile["slug"])
        watchlist_row = watchlist_by_group.get(profile["group"], {})
        metadata = group_metadata.get(profile["group"], {})

        entity_ids[profile["group"]] = entity_id
        entity_rows.append(
            {
                "id": entity_id,
                "slug": profile["slug"],
                "canonical_name": profile["group"],
                "display_name": profile.get("display_name") or profile["group"],
                "entity_type": infer_entity_type(profile),
                "agency_name": optional_text(profile.get("agency")),
                "debut_year": profile.get("debut_year"),
                "representative_image_url": normalize_url(profile.get("representative_image_url")),
                "representative_image_source": optional_text(profile.get("representative_image_source")),
                "x_url": normalize_url(profile.get("official_x_url") or watchlist_row.get("x_url")),
                "instagram_url": normalize_url(profile.get("official_instagram_url") or watchlist_row.get("instagram_url")),
                "youtube_url": normalize_url(profile.get("official_youtube_url")),
                "x_provenance": "artistProfiles.official_x_url"
                if normalize_url(profile.get("official_x_url"))
                else "watchlist.x_url"
                if normalize_url(watchlist_row.get("x_url"))
                else None,
                "instagram_provenance": "artistProfiles.official_instagram_url"
                if normalize_url(profile.get("official_instagram_url"))
                else "watchlist.instagram_url"
                if normalize_url(watchlist_row.get("instagram_url"))
                else None,
                "youtube_provenance": "artistProfiles.official_youtube_url" if normalize_url(profile.get("official_youtube_url")) else None,
                "artist_source_url": metadata.get("artist_source"),
            }
        )

    return entity_rows, entity_ids


def build_alias_rows(
    artist_profiles: Sequence[Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    seen_keys = set()
    alias_rows: List[Dict[str, Any]] = []

    for profile in sorted(artist_profiles, key=lambda row: row["group"].casefold()):
        entity_id = entity_ids[profile["group"]]
        alias_sources = [
            ("aliases", profile.get("aliases") or []),
            ("search_aliases", profile.get("search_aliases") or []),
        ]
        for source_name, aliases in alias_sources:
            for alias in aliases:
                alias_text = optional_text(alias)
                if alias_text is None:
                    continue
                dedupe_key = (entity_id, alias_text)
                if dedupe_key in seen_keys:
                    summary["source_duplicates"]["entity_aliases"] += 1
                    continue
                seen_keys.add(dedupe_key)
                alias_rows.append(
                    {
                        "id": stable_uuid("entity-alias", entity_id, alias_text),
                        "entity_id": entity_id,
                        "alias": alias_text,
                        "alias_type": classify_alias_type(alias_text, source_name),
                        "normalized_alias": normalize_text(alias_text),
                        "is_primary": False,
                    }
                )

    return alias_rows


def build_official_link_rows(
    entity_rows: Sequence[Dict[str, Any]],
    watchlist_by_group: Dict[str, Dict[str, Any]],
    youtube_allowlists_by_group: Dict[str, Dict[str, Any]],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    priority = {
        "artistProfiles.official_youtube_url": 0,
        "youtubeChannelAllowlists.primary_team_channel_url": 1,
        "artistProfiles.official_x_url": 0,
        "watchlist.x_url": 1,
        "artistProfiles.official_instagram_url": 0,
        "watchlist.instagram_url": 1,
        "releaseHistory.artist_source": 0,
    }
    seen_keys: Dict[Tuple[uuid.UUID, str, str], int] = {}
    official_link_rows: List[Dict[str, Any]] = []

    for entity in entity_rows:
        group = entity["canonical_name"]
        candidates = []
        if entity["youtube_url"]:
            candidates.append(("youtube", entity["youtube_url"], entity["youtube_provenance"] or "artistProfiles.official_youtube_url"))
        else:
            primary_channel = normalize_url((youtube_allowlists_by_group.get(group) or {}).get("primary_team_channel_url"))
            if primary_channel:
                candidates.append(("youtube", primary_channel, "youtubeChannelAllowlists.primary_team_channel_url"))

        if entity["x_url"]:
            candidates.append(("x", entity["x_url"], entity["x_provenance"] or "watchlist.x_url"))

        if entity["instagram_url"]:
            candidates.append(("instagram", entity["instagram_url"], entity["instagram_provenance"] or "watchlist.instagram_url"))

        if entity["artist_source_url"]:
            candidates.append(("artist_source", entity["artist_source_url"], "releaseHistory.artist_source"))

        for link_type, url, provenance in candidates:
            key = (entity["id"], link_type, url)
            row = {
                "id": stable_uuid("official-link", entity["id"], link_type, url),
                "entity_id": entity["id"],
                "link_type": link_type,
                "url": url,
                "is_primary": True,
                "provenance": provenance,
            }
            if key not in seen_keys:
                seen_keys[key] = len(official_link_rows)
                official_link_rows.append(row)
                continue

            current_index = seen_keys[key]
            current_row = official_link_rows[current_index]
            current_priority = priority.get(current_row["provenance"], 99)
            next_priority = priority.get(provenance, 99)
            if next_priority < current_priority:
                official_link_rows[current_index] = row
            summary["source_duplicates"]["entity_official_links"] += 1

    return official_link_rows


def build_youtube_channel_rows(
    youtube_allowlists: Sequence[Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
    summary: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    channel_rows_by_url: Dict[str, Dict[str, Any]] = {}
    entity_channel_links: List[Dict[str, Any]] = []
    seen_entity_channel_links = set()

    for row in sorted(youtube_allowlists, key=lambda item: item["group"].casefold()):
        entity_id = entity_ids[row["group"]]
        primary_channel_url = normalize_url(row.get("primary_team_channel_url"))
        allowlist_urls = {normalize_url(url) for url in row.get("mv_allowlist_urls") or []}
        allowlist_urls.discard(None)

        for channel in row.get("channels") or []:
            channel_url = normalize_url(channel.get("channel_url"))
            if channel_url is None:
                continue

            existing = channel_rows_by_url.get(channel_url)
            candidate = {
                "id": stable_uuid("youtube-channel", channel_url),
                "canonical_channel_url": channel_url,
                "channel_label": channel.get("channel_label") or row["group"],
                "owner_type": channel.get("owner_type") or "other_official",
                "display_in_team_links": bool(channel.get("display_in_team_links")),
                "allow_mv_uploads": bool(channel.get("allow_mv_uploads")),
                "provenance": optional_text(channel.get("provenance")) or "youtubeChannelAllowlists.channels",
            }
            if existing is None:
                channel_rows_by_url[channel_url] = candidate
            else:
                summary["source_duplicates"]["youtube_channels"] += 1
                existing["display_in_team_links"] = existing["display_in_team_links"] or candidate["display_in_team_links"]
                existing["allow_mv_uploads"] = existing["allow_mv_uploads"] or candidate["allow_mv_uploads"]

            is_primary = primary_channel_url == channel_url
            is_mv_allowlist = channel_url in allowlist_urls
            if not is_primary and not is_mv_allowlist:
                continue

            channel_role = "both" if is_primary and is_mv_allowlist else "primary_team_channel" if is_primary else "mv_allowlist"
            link_key = (entity_id, channel_rows_by_url[channel_url]["id"])
            if link_key in seen_entity_channel_links:
                summary["source_duplicates"]["entity_youtube_channels"] += 1
                continue
            seen_entity_channel_links.add(link_key)
            entity_channel_links.append(
                {
                    "entity_id": entity_id,
                    "youtube_channel_id": channel_rows_by_url[channel_url]["id"],
                    "channel_role": channel_role,
                }
            )

    channel_rows = sorted(channel_rows_by_url.values(), key=lambda row: row["canonical_channel_url"].casefold())
    entity_channel_links.sort(key=lambda row: (str(row["entity_id"]), str(row["youtube_channel_id"])))
    return channel_rows, entity_channel_links


def merge_release_candidates(
    release_history_rows: Sequence[Dict[str, Any]],
    release_detail_rows: Sequence[Dict[str, Any]],
    release_artwork_rows: Sequence[Dict[str, Any]],
    release_override_rows: Sequence[Dict[str, Any]],
    group_metadata: Dict[str, Dict[str, Optional[str]]],
    summary: Dict[str, Any],
) -> Dict[Tuple[str, str, str, str], Dict[str, Any]]:
    candidates: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}

    def ensure_candidate(group: str, release_title: str, release_date: str, stream: str) -> Dict[str, Any]:
        key = release_key(group, release_title, release_date, stream)
        if key not in candidates:
            metadata = group_metadata.get(group, {})
            candidates[key] = {
                "group": group,
                "release_title": release_title,
                "release_date": release_date,
                "stream": stream,
                "release_kind": None,
                "release_format": None,
                "source_url": None,
                "artist_source_url": metadata.get("artist_source"),
                "musicbrainz_artist_id": metadata.get("artist_mbid"),
                "musicbrainz_release_group_id": None,
                "notes": None,
            }
        return candidates[key]

    for group_row in release_history_rows:
        for release in group_row.get("releases") or []:
            release_date = optional_text(release.get("date"))
            release_title = optional_text(release.get("title"))
            stream = optional_text(release.get("stream"))
            if not release_date or not release_title or not stream:
                summary["dropped_records"]["releases"] += 1
                record_drop(
                    summary["dropped_missing_fk_samples"],
                    "releases",
                    {"reason": "invalid_release_history_row", "group": group_row["group"], "release": release},
                )
                continue

            candidate = ensure_candidate(group_row["group"], release_title, release_date, stream)
            candidate["release_kind"] = optional_text(release.get("release_kind")) or candidate["release_kind"]
            candidate["release_format"] = optional_text(release.get("release_format")) or candidate["release_format"]
            candidate["source_url"] = normalize_url(release.get("source")) or candidate["source_url"]
            candidate["artist_source_url"] = normalize_url(group_row.get("artist_source")) or candidate["artist_source_url"]
            candidate["musicbrainz_artist_id"] = optional_text(group_row.get("artist_mbid")) or candidate["musicbrainz_artist_id"]
            candidate["musicbrainz_release_group_id"] = (
                extract_musicbrainz_release_group_id(candidate["source_url"]) or candidate["musicbrainz_release_group_id"]
            )

    for row in release_detail_rows:
        release_date = optional_text(row.get("release_date"))
        release_title = optional_text(row.get("release_title"))
        stream = optional_text(row.get("stream"))
        if not release_date or not release_title or not stream:
            summary["dropped_records"]["releases"] += 1
            record_drop(
                summary["dropped_missing_fk_samples"],
                "releases",
                {"reason": "invalid_release_detail_row", "row": row},
            )
            continue

        candidate = ensure_candidate(row["group"], release_title, release_date, stream)
        candidate["release_kind"] = optional_text(row.get("release_kind")) or candidate["release_kind"]
        candidate["release_format"] = candidate["release_format"] or optional_text(row.get("release_kind"))
        candidate["notes"] = optional_text(row.get("notes")) or candidate["notes"]

    for row in release_artwork_rows:
        release_date = optional_text(row.get("release_date"))
        release_title = optional_text(row.get("release_title"))
        stream = optional_text(row.get("stream"))
        if not release_date or not release_title or not stream:
            continue
        ensure_candidate(row["group"], release_title, release_date, stream)

    for row in release_override_rows:
        release_date = optional_text(row.get("release_date"))
        release_title = optional_text(row.get("release_title"))
        stream = optional_text(row.get("stream"))
        if not release_date or not release_title or not stream:
            continue
        ensure_candidate(row["group"], release_title, release_date, stream)

    return candidates


def build_release_rows(
    release_candidates: Dict[Tuple[str, str, str, str], Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
) -> Tuple[List[Dict[str, Any]], Dict[Tuple[str, str, str, str], uuid.UUID]]:
    release_rows: List[Dict[str, Any]] = []
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID] = {}

    sorted_keys = sorted(
        release_candidates.keys(),
        key=lambda key: (
            release_candidates[key]["group"].casefold(),
            release_candidates[key]["release_date"],
            release_candidates[key]["stream"],
            release_candidates[key]["release_title"].casefold(),
        ),
    )

    for key in sorted_keys:
        candidate = release_candidates[key]
        entity_id = entity_ids[candidate["group"]]
        release_id = stable_uuid("release", entity_id, key[1], key[2], key[3])
        release_ids[key] = release_id
        release_rows.append(
            {
                "id": release_id,
                "entity_id": entity_id,
                "release_title": candidate["release_title"],
                "normalized_release_title": key[1],
                "release_date": parse_exact_date(candidate["release_date"]),
                "stream": candidate["stream"],
                "release_kind": candidate["release_kind"],
                "release_format": candidate["release_format"],
                "source_url": candidate["source_url"],
                "artist_source_url": candidate["artist_source_url"],
                "musicbrainz_artist_id": candidate["musicbrainz_artist_id"],
                "musicbrainz_release_group_id": candidate["musicbrainz_release_group_id"],
                "notes": candidate["notes"],
            }
        )

    return release_rows, release_ids


def build_release_artwork_rows(
    release_artwork_rows: Sequence[Dict[str, Any]],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    seen_release_ids = set()
    for artwork in sorted(
        release_artwork_rows,
        key=lambda row: (row["group"].casefold(), row["release_date"], row["stream"], row["release_title"].casefold()),
    ):
        key = release_key(artwork["group"], artwork["release_title"], artwork["release_date"], artwork["stream"])
        release_id = release_ids.get(key)
        if release_id is None:
            summary["dropped_records"]["release_artwork"] += 1
            record_drop(
                summary["dropped_missing_fk_samples"],
                "release_artwork",
                {"reason": "release_not_found", "release": pretty_release_key(*key)},
            )
            continue
        if release_id in seen_release_ids:
            summary["source_duplicates"]["release_artwork"] += 1
            continue
        seen_release_ids.add(release_id)
        rows.append(
            {
                "release_id": release_id,
                "cover_image_url": normalize_url(artwork.get("cover_image_url")),
                "thumbnail_image_url": normalize_url(artwork.get("thumbnail_image_url")),
                "artwork_source_type": optional_text(artwork.get("artwork_source_type")),
                "artwork_source_url": normalize_url(artwork.get("artwork_source_url")),
            }
        )
    return rows


def build_track_rows(
    release_detail_rows: Sequence[Dict[str, Any]],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], Dict[Tuple[uuid.UUID, int], uuid.UUID]]:
    rows: List[Dict[str, Any]] = []
    track_ids: Dict[Tuple[uuid.UUID, int], uuid.UUID] = {}
    seen_keys = set()
    for detail in sorted(
        release_detail_rows,
        key=lambda row: (row["group"].casefold(), row["release_date"], row["stream"], row["release_title"].casefold()),
    ):
        key = release_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
        release_id = release_ids.get(key)
        if release_id is None:
            summary["dropped_records"]["tracks"] += len(detail.get("tracks") or [])
            record_drop(
                summary["dropped_missing_fk_samples"],
                "tracks",
                {"reason": "release_not_found", "release": pretty_release_key(*key)},
            )
            continue

        for track in detail.get("tracks") or []:
            order = track.get("order")
            title = optional_text(track.get("title"))
            if not isinstance(order, int) or order <= 0 or title is None:
                summary["dropped_records"]["tracks"] += 1
                record_drop(
                    summary["dropped_missing_fk_samples"],
                    "tracks",
                    {"reason": "invalid_track_row", "release": pretty_release_key(*key), "track": track},
                )
                continue
            dedupe_key = (release_id, order)
            if dedupe_key in seen_keys:
                summary["source_duplicates"]["tracks"] += 1
                continue
            seen_keys.add(dedupe_key)
            track_id = stable_uuid("track", release_id, order)
            track_ids[dedupe_key] = track_id
            rows.append(
                {
                    "id": track_id,
                    "release_id": release_id,
                    "track_order": order,
                    "track_title": title,
                    "normalized_track_title": normalize_text(title),
                    "is_title_track": track.get("is_title_track"),
                }
            )

    return rows, track_ids


def build_release_service_rows(
    release_detail_rows: Sequence[Dict[str, Any]],
    release_override_rows: Sequence[Dict[str, Any]],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows_by_key: Dict[Tuple[uuid.UUID, str], Dict[str, Any]] = {}

    def add_row(release_id: uuid.UUID, service_type: str, url: Optional[str], status: str, provenance: Optional[str]) -> None:
        rows_by_key[(release_id, service_type)] = {
            "id": stable_uuid("release-service-link", release_id, service_type),
            "release_id": release_id,
            "service_type": service_type,
            "url": url,
            "status": status,
            "provenance": provenance,
        }

    for detail in release_detail_rows:
        key = release_key(detail["group"], detail["release_title"], detail["release_date"], detail["stream"])
        release_id = release_ids.get(key)
        if release_id is None:
            summary["dropped_records"]["release_service_links"] += 3
            record_drop(
                summary["dropped_missing_fk_samples"],
                "release_service_links",
                {"reason": "release_not_found", "release": pretty_release_key(*key)},
            )
            continue

        spotify_url = normalize_url(detail.get("spotify_url"))
        add_row(
            release_id,
            "spotify",
            spotify_url,
            "canonical" if spotify_url else "no_link",
            "releaseDetails.spotify_url" if spotify_url else None,
        )

        youtube_music_url = normalize_url(detail.get("youtube_music_url"))
        add_row(
            release_id,
            "youtube_music",
            youtube_music_url,
            "canonical" if youtube_music_url else "no_link",
            "releaseDetails.youtube_music_url" if youtube_music_url else None,
        )

        youtube_video_url = normalize_url(detail.get("youtube_video_url"))
        youtube_video_status = optional_text(detail.get("youtube_video_status")) or ("canonical" if youtube_video_url else "no_link")
        add_row(
            release_id,
            "youtube_mv",
            youtube_video_url,
            youtube_video_status,
            optional_text(detail.get("youtube_video_provenance")),
        )

    for override in release_override_rows:
        key = release_key(override["group"], override["release_title"], override["release_date"], override["stream"])
        release_id = release_ids.get(key)
        if release_id is None:
            continue

        youtube_music_url = normalize_url(override.get("youtube_music_url"))
        if youtube_music_url:
            add_row(
                release_id,
                "youtube_music",
                youtube_music_url,
                "manual_override",
                optional_text(override.get("provenance")),
            )

        youtube_video_url = normalize_url(override.get("youtube_video_url"))
        youtube_video_id = optional_text(override.get("youtube_video_id"))
        if youtube_video_url is None and youtube_video_id:
            youtube_video_url = f"https://www.youtube.com/watch?v={youtube_video_id}"
        if youtube_video_url or youtube_video_id:
            add_row(
                release_id,
                "youtube_mv",
                youtube_video_url,
                "manual_override",
                optional_text(override.get("youtube_video_provenance")) or optional_text(override.get("provenance")),
            )

    return sorted(rows_by_key.values(), key=lambda row: (str(row["release_id"]), row["service_type"]))


def build_upcoming_rows(
    upcoming_rows: Sequence[Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
    summary: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, uuid.UUID]]:
    signal_rows: List[Dict[str, Any]] = []
    source_rows: List[Dict[str, Any]] = []
    signal_ids_by_dedupe: Dict[str, uuid.UUID] = {}
    seen_dedupe_keys = set()

    for row in sorted(
        upcoming_rows,
        key=lambda item: (
            item["group"].casefold(),
            optional_text(item.get("scheduled_date")) or optional_text(item.get("scheduled_month")) or "",
            item["headline"].casefold(),
            normalize_url(item.get("source_url")) or "",
        ),
    ):
        entity_id = entity_ids.get(row["group"])
        if entity_id is None:
            summary["dropped_records"]["upcoming_signals"] += 1
            record_drop(
                summary["dropped_missing_fk_samples"],
                "upcoming_signals",
                {"reason": "entity_not_found", "group": row["group"], "headline": row["headline"]},
            )
            continue

        dedupe_key = make_signal_dedupe_key(row)
        if dedupe_key in seen_dedupe_keys:
            summary["source_duplicates"]["upcoming_signals"] += 1
            continue
        seen_dedupe_keys.add(dedupe_key)

        signal_id = stable_uuid("upcoming-signal", dedupe_key)
        signal_ids_by_dedupe[dedupe_key] = signal_id
        date_precision = row["date_precision"]
        scheduled_date = parse_exact_date(row.get("scheduled_date")) if date_precision == "exact" else None
        scheduled_month = parse_month_start(row.get("scheduled_month")) if date_precision == "month_only" else None
        published_at = parse_timestamp(row.get("published_at"))
        signal_rows.append(
            {
                "id": signal_id,
                "entity_id": entity_id,
                "headline": row["headline"],
                "normalized_headline": normalize_text(row["headline"]),
                "scheduled_date": scheduled_date,
                "scheduled_month": scheduled_month,
                "date_precision": date_precision,
                "date_status": row["date_status"],
                "release_format": optional_text(row.get("release_format")),
                "confidence_score": round(float(row["confidence"]), 2) if row.get("confidence") is not None else None,
                "tracking_status": optional_text(row.get("tracking_status")),
                "first_seen_at": published_at,
                "latest_seen_at": published_at,
                "is_active": True,
                "dedupe_key": dedupe_key,
            }
        )
        source_url = normalize_url(row.get("source_url"))
        if source_url is None:
            summary["dropped_records"]["upcoming_signal_sources"] += 1
            record_drop(
                summary["dropped_missing_fk_samples"],
                "upcoming_signal_sources",
                {"reason": "missing_source_url", "headline": row["headline"]},
            )
            continue

        source_rows.append(
            {
                "id": stable_uuid("upcoming-signal-source", signal_id, source_url),
                "upcoming_signal_id": signal_id,
                "source_type": row["source_type"],
                "source_url": source_url,
                "source_domain": optional_text(row.get("source_domain")),
                "published_at": published_at,
                "search_term": optional_text(row.get("search_term")),
                "evidence_summary": optional_text(row.get("evidence_summary")),
            }
        )

    return signal_rows, source_rows, signal_ids_by_dedupe


def build_tracking_state_rows(
    watchlist_rows: Sequence[Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for row in sorted(watchlist_rows, key=lambda item: item["group"].casefold()):
        entity_id = entity_ids[row["group"]]
        latest_release_id = None
        latest_release_title = optional_text(row.get("latest_release_title"))
        latest_release_date = optional_text(row.get("latest_release_date"))
        latest_release_kind = optional_text(row.get("latest_release_kind"))
        if latest_release_title and latest_release_date and latest_release_kind:
            stream = stream_from_release_kind(latest_release_kind)
            release_lookup_key = release_key(row["group"], latest_release_title, latest_release_date, stream)
            latest_release_id = release_ids.get(release_lookup_key)
            if latest_release_id is None:
                summary["unresolved_release_mappings"].append(
                    {
                        "dataset": "watchlist.latest_release",
                        "group": row["group"],
                        "release_title": latest_release_title,
                        "release_date": latest_release_date,
                        "stream": stream,
                    }
                )
        rows.append(
            {
                "entity_id": entity_id,
                "tier": row["tier"],
                "watch_reason": row["watch_reason"],
                "tracking_status": row["tracking_status"],
                "latest_verified_release_id": latest_release_id,
            }
        )

    return rows


def build_review_task_rows(
    manual_review_rows: Sequence[Dict[str, Any]],
    mv_review_rows: Sequence[Dict[str, Any]],
    entity_ids: Dict[str, uuid.UUID],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    signal_ids_by_dedupe: Dict[str, uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for row in sorted(
        manual_review_rows,
        key=lambda item: (
            item["group"].casefold(),
            optional_text(item.get("scheduled_date")) or optional_text(item.get("scheduled_month")) or "",
            item["headline"].casefold(),
        ),
    ):
        entity_id = entity_ids.get(row["group"])
        review_reason = row.get("review_reason") or []
        source_url = normalize_url(row.get("source_url"))
        review_type = (
            "entity_onboarding"
            if "unresolved_group" in review_reason or row.get("source_type") == "unresolved" or source_url is None
            else "upcoming_signal"
        )
        upcoming_signal_id = None
        if review_type == "upcoming_signal":
            dedupe_key = make_signal_dedupe_key(row)
            upcoming_signal_id = signal_ids_by_dedupe.get(dedupe_key)
            if upcoming_signal_id is None:
                summary["unresolved_review_links"].append(
                    {
                        "review_type": review_type,
                        "group": row["group"],
                        "headline": row["headline"],
                        "source_url": row.get("source_url"),
                    }
                )
        payload = dict(row)
        payload["source_dataset"] = "manual_review_queue"
        rows.append(
            {
                "id": stable_uuid("review-task", review_type, row["group"], row["headline"], row.get("source_url"), row.get("scheduled_date"), row.get("scheduled_month")),
                "review_type": review_type,
                "status": "open",
                "entity_id": entity_id,
                "release_id": None,
                "upcoming_signal_id": upcoming_signal_id,
                "review_reason": review_reason,
                "recommended_action": optional_text(row.get("recommended_action")),
                "payload": payload,
            }
        )

    for row in sorted(
        mv_review_rows,
        key=lambda item: (item["group"].casefold(), item["release_date"], item["stream"], item["release_title"].casefold()),
    ):
        entity_id = entity_ids.get(row["group"])
        release_lookup_key = release_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        release_id = release_ids.get(release_lookup_key)
        if release_id is None:
            summary["unresolved_review_links"].append(
                {
                    "review_type": "mv_candidate",
                    "group": row["group"],
                    "release_title": row["release_title"],
                    "release_date": row["release_date"],
                    "stream": row["stream"],
                }
            )
        payload = dict(row)
        payload["source_dataset"] = "mv_manual_review_queue"
        review_reason = row.get("review_reason")
        rows.append(
            {
                "id": stable_uuid("review-task", "mv_candidate", row["group"], row["release_title"], row["release_date"], row["stream"]),
                "review_type": "mv_candidate",
                "status": "open",
                "entity_id": entity_id,
                "release_id": release_id,
                "upcoming_signal_id": None,
                "review_reason": [review_reason] if isinstance(review_reason, str) else review_reason or [],
                "recommended_action": optional_text(row.get("recommended_action")),
                "payload": payload,
            }
        )

    return rows


def build_release_link_override_rows(
    release_override_rows: Sequence[Dict[str, Any]],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    seen_keys = set()
    for row in sorted(
        release_override_rows,
        key=lambda item: (item["group"].casefold(), item["release_date"], item["stream"], item["release_title"].casefold()),
    ):
        release_lookup_key = release_key(row["group"], row["release_title"], row["release_date"], row["stream"])
        release_id = release_ids.get(release_lookup_key)
        if release_id is None:
            summary["dropped_records"]["release_link_overrides"] += 1
            record_drop(
                summary["dropped_missing_fk_samples"],
                "release_link_overrides",
                {"reason": "release_not_found", "release": pretty_release_key(*release_lookup_key)},
            )
            continue

        youtube_music_url = normalize_url(row.get("youtube_music_url"))
        if youtube_music_url:
            dedupe_key = (release_id, "youtube_music")
            if dedupe_key not in seen_keys:
                seen_keys.add(dedupe_key)
                rows.append(
                    {
                        "id": stable_uuid("release-link-override", release_id, "youtube_music"),
                        "release_id": release_id,
                        "service_type": "youtube_music",
                        "override_url": youtube_music_url,
                        "override_video_id": None,
                        "provenance": optional_text(row.get("provenance")) or "release_detail_overrides",
                    }
                )

        youtube_video_id = optional_text(row.get("youtube_video_id"))
        youtube_video_url = normalize_url(row.get("youtube_video_url"))
        if youtube_video_url is None and youtube_video_id:
            youtube_video_url = f"https://www.youtube.com/watch?v={youtube_video_id}"
        if youtube_video_url or youtube_video_id:
            dedupe_key = (release_id, "youtube_mv")
            if dedupe_key not in seen_keys:
                seen_keys.add(dedupe_key)
                rows.append(
                    {
                        "id": stable_uuid("release-link-override", release_id, "youtube_mv"),
                        "release_id": release_id,
                        "service_type": "youtube_mv",
                        "override_url": youtube_video_url,
                        "override_video_id": youtube_video_id,
                        "provenance": optional_text(row.get("youtube_video_provenance"))
                        or optional_text(row.get("provenance"))
                        or "release_detail_overrides",
                    }
                )
    return rows


def compare_rollup_release_refs(
    releases_rollup_rows: Sequence[Dict[str, Any]],
    release_ids: Dict[Tuple[str, str, str, str], uuid.UUID],
    summary: Dict[str, Any],
) -> None:
    for row in releases_rollup_rows:
        for field_name, stream in [("latest_song", "song"), ("latest_album", "album")]:
            release = row.get(field_name)
            if not release:
                continue
            lookup_key = release_key(row["group"], release["title"], release["date"], stream)
            if lookup_key not in release_ids:
                summary["unresolved_release_mappings"].append(
                    {
                        "dataset": f"releases.json.{field_name}",
                        "group": row["group"],
                        "release_title": release["title"],
                        "release_date": release["date"],
                        "stream": stream,
                    }
                )


def build_import_payload() -> Dict[str, Any]:
    artist_profiles = load_json(ARTIST_PROFILES_PATH)
    youtube_allowlists = load_json(YOUTUBE_ALLOWLISTS_PATH)
    release_details = load_json(RELEASE_DETAILS_PATH)
    release_history = load_json(RELEASE_HISTORY_PATH)
    release_artwork = load_json(RELEASE_ARTWORK_PATH)
    upcoming_candidates = load_json(UPCOMING_CANDIDATES_PATH)
    watchlist = load_json(WATCHLIST_PATH)
    release_detail_overrides = load_json(RELEASE_DETAIL_OVERRIDES_PATH)
    manual_review_queue = load_json(MANUAL_REVIEW_QUEUE_PATH)
    mv_manual_review_queue = load_json(MV_MANUAL_REVIEW_QUEUE_PATH)
    releases_rollup = load_json(RELEASES_ROLLUP_PATH)

    watchlist_by_group = {row["group"]: row for row in watchlist}
    youtube_allowlists_by_group = {row["group"]: row for row in youtube_allowlists}
    group_metadata = build_group_metadata(release_history, releases_rollup)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_counts": {
            "artist_profiles": len(artist_profiles),
            "youtube_allowlists": len(youtube_allowlists),
            "release_details": len(release_details),
            "release_history_groups": len(release_history),
            "release_history_rows": sum(len(row.get("releases") or []) for row in release_history),
            "release_artwork": len(release_artwork),
            "upcoming_candidates": len(upcoming_candidates),
            "watchlist": len(watchlist),
            "release_detail_overrides": len(release_detail_overrides),
            "manual_review_queue": len(manual_review_queue),
            "mv_manual_review_queue": len(mv_manual_review_queue),
            "releases_rollup": len(releases_rollup),
        },
        "source_duplicates": Counter(),
        "dropped_records": Counter(),
        "dropped_missing_fk_samples": {},
        "unresolved_release_mappings": [],
        "unresolved_review_links": [],
    }

    entity_rows, entity_ids = build_entity_rows(artist_profiles, watchlist_by_group, group_metadata)
    alias_rows = build_alias_rows(artist_profiles, entity_ids, summary)
    official_link_rows = build_official_link_rows(entity_rows, watchlist_by_group, youtube_allowlists_by_group, summary)
    youtube_channel_rows, entity_channel_rows = build_youtube_channel_rows(youtube_allowlists, entity_ids, summary)
    release_candidates = merge_release_candidates(
        release_history,
        release_details,
        release_artwork,
        release_detail_overrides,
        group_metadata,
        summary,
    )
    release_rows, release_ids = build_release_rows(release_candidates, entity_ids)
    release_artwork_rows = build_release_artwork_rows(release_artwork, release_ids, summary)
    track_rows, _ = build_track_rows(release_details, release_ids, summary)
    release_service_rows = build_release_service_rows(release_details, release_detail_overrides, release_ids, summary)
    track_service_rows: List[Dict[str, Any]] = []
    signal_rows, signal_source_rows, signal_ids_by_dedupe = build_upcoming_rows(upcoming_candidates, entity_ids, summary)
    tracking_state_rows = build_tracking_state_rows(watchlist, entity_ids, release_ids, summary)
    review_task_rows = build_review_task_rows(
        manual_review_queue,
        mv_manual_review_queue,
        entity_ids,
        release_ids,
        signal_ids_by_dedupe,
        summary,
    )
    release_link_override_rows = build_release_link_override_rows(release_detail_overrides, release_ids, summary)
    compare_rollup_release_refs(releases_rollup, release_ids, summary)

    summary["entity_type_counts"] = Counter(row["entity_type"] for row in entity_rows)
    summary["samples"] = {
        "entities": [row["slug"] for row in entity_rows[:5]],
        "releases": [
            pretty_release_key(row["group"], row["release_title"], row["release_date"], row["stream"])
            for row in sorted(release_candidates.values(), key=lambda item: (item["group"].casefold(), item["release_date"]))[:5]
        ],
        "upcoming_signals": [row["headline"] for row in signal_rows[:5]],
        "review_tasks": [row["review_type"] for row in review_task_rows[:5]],
    }

    return {
        "summary": summary,
        "tables": {
            "entities": entity_rows,
            "entity_aliases": alias_rows,
            "entity_official_links": official_link_rows,
            "youtube_channels": youtube_channel_rows,
            "entity_youtube_channels": entity_channel_rows,
            "releases": release_rows,
            "release_artwork": release_artwork_rows,
            "tracks": track_rows,
            "release_service_links": release_service_rows,
            "track_service_links": track_service_rows,
            "upcoming_signals": signal_rows,
            "upcoming_signal_sources": signal_source_rows,
            "entity_tracking_state": tracking_state_rows,
            "review_tasks": review_task_rows,
            "release_link_overrides": release_link_override_rows,
        },
    }


def build_release_pipeline_payload() -> Dict[str, Any]:
    payload = build_import_payload()
    release_scope_tables = {
        table: payload["tables"][table]
        for table in RELEASE_PIPELINE_TABLES
    }
    release_scope_tables["review_tasks"] = [
        row
        for row in release_scope_tables["review_tasks"]
        if isinstance(row.get("payload"), dict)
        and row["payload"].get("source_dataset") in RELEASE_PIPELINE_REVIEW_SOURCE_DATASETS
    ]
    payload["summary"]["scope"] = "release_pipeline"
    payload["tables"] = release_scope_tables
    return payload


def fetch_existing_state(connection: "psycopg.Connection[Any]") -> Dict[str, Any]:
    existing: Dict[str, Any] = {}
    with connection.cursor() as cursor:
        for table in ["entities", "entity_aliases", "entity_official_links", "youtube_channels", "releases", "tracks", "release_service_links", "review_tasks", "release_link_overrides", "upcoming_signals", "upcoming_signal_sources"]:
            cursor.execute(f"select id::text from {table}")
            existing[table] = {row[0] for row in cursor.fetchall()}

        cursor.execute("select release_id::text from release_artwork")
        existing["release_artwork"] = {row[0] for row in cursor.fetchall()}

        cursor.execute("select entity_id::text, youtube_channel_id::text from entity_youtube_channels")
        existing["entity_youtube_channels"] = {(row[0], row[1]) for row in cursor.fetchall()}

        cursor.execute("select entity_id::text from entity_tracking_state")
        existing["entity_tracking_state"] = {row[0] for row in cursor.fetchall()}

        cursor.execute("select track_id::text, service_type from track_service_links")
        existing["track_service_links"] = {(row[0], row[1]) for row in cursor.fetchall()}

    return existing


def prune_stale_review_tasks(connection: "psycopg.Connection[Any]", review_task_rows: Sequence[Dict[str, Any]]) -> int:
    desired_ids = [row["id"] for row in review_task_rows]
    with connection.cursor() as cursor:
        if desired_ids:
            placeholders = ", ".join(["%s"] * len(desired_ids))
            cursor.execute(
                f"""
                delete from review_tasks
                where payload->>'source_dataset' in ('manual_review_queue', 'mv_manual_review_queue')
                  and id not in ({placeholders})
                """,
                desired_ids,
            )
        else:
            cursor.execute(
                """
                delete from review_tasks
                where payload->>'source_dataset' in ('manual_review_queue', 'mv_manual_review_queue')
                """
            )
        deleted = cursor.rowcount
    connection.commit()
    return deleted


def upsert_table_rows(connection: "psycopg.Connection[Any]", payload: Dict[str, Any], summary: Dict[str, Any]) -> None:
    summary["stale_pruned"] = {
        "review_tasks": prune_stale_review_tasks(connection, payload["tables"]["review_tasks"])
    }
    existing = fetch_existing_state(connection)
    operations = {table: Counter() for table in TARGET_TABLES}
    def count_operations(table: str, rows: Sequence[Dict[str, Any]], key_builder) -> None:
        current_keys = existing[table]
        for row in rows:
            key = key_builder(row)
            operations[table]["updated" if key in current_keys else "inserted"] += 1

    with connection.pipeline(), connection.cursor() as cursor:
        entity_rows = payload["tables"]["entities"]
        count_operations("entities", entity_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into entities (
              id, slug, canonical_name, display_name, entity_type, agency_name, debut_year,
              representative_image_url, representative_image_source
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              slug = excluded.slug,
              canonical_name = excluded.canonical_name,
              display_name = excluded.display_name,
              entity_type = excluded.entity_type,
              agency_name = excluded.agency_name,
              debut_year = excluded.debut_year,
              representative_image_url = excluded.representative_image_url,
              representative_image_source = excluded.representative_image_source,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["slug"],
                    row["canonical_name"],
                    row["display_name"],
                    row["entity_type"],
                    row["agency_name"],
                    row["debut_year"],
                    row["representative_image_url"],
                    row["representative_image_source"],
                )
                for row in entity_rows
            ],
        )

        alias_rows = payload["tables"]["entity_aliases"]
        count_operations("entity_aliases", alias_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into entity_aliases (
              id, entity_id, alias, alias_type, normalized_alias, is_primary
            )
            values (%s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              entity_id = excluded.entity_id,
              alias = excluded.alias,
              alias_type = excluded.alias_type,
              normalized_alias = excluded.normalized_alias,
              is_primary = excluded.is_primary
            """,
            [
                (
                    row["id"],
                    row["entity_id"],
                    row["alias"],
                    row["alias_type"],
                    row["normalized_alias"],
                    row["is_primary"],
                )
                for row in alias_rows
            ],
        )

        official_link_rows = payload["tables"]["entity_official_links"]
        count_operations("entity_official_links", official_link_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into entity_official_links (
              id, entity_id, link_type, url, is_primary, provenance
            )
            values (%s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              entity_id = excluded.entity_id,
              link_type = excluded.link_type,
              url = excluded.url,
              is_primary = excluded.is_primary,
              provenance = excluded.provenance
            """,
            [
                (
                    row["id"],
                    row["entity_id"],
                    row["link_type"],
                    row["url"],
                    row["is_primary"],
                    row["provenance"],
                )
                for row in official_link_rows
            ],
        )

        youtube_channel_rows = payload["tables"]["youtube_channels"]
        count_operations("youtube_channels", youtube_channel_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into youtube_channels (
              id, canonical_channel_url, channel_label, owner_type,
              display_in_team_links, allow_mv_uploads, provenance
            )
            values (%s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              canonical_channel_url = excluded.canonical_channel_url,
              channel_label = excluded.channel_label,
              owner_type = excluded.owner_type,
              display_in_team_links = excluded.display_in_team_links,
              allow_mv_uploads = excluded.allow_mv_uploads,
              provenance = excluded.provenance,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["canonical_channel_url"],
                    row["channel_label"],
                    row["owner_type"],
                    row["display_in_team_links"],
                    row["allow_mv_uploads"],
                    row["provenance"],
                )
                for row in youtube_channel_rows
            ],
        )

        entity_channel_rows = payload["tables"]["entity_youtube_channels"]
        count_operations(
            "entity_youtube_channels",
            entity_channel_rows,
            lambda row: (str(row["entity_id"]), str(row["youtube_channel_id"])),
        )
        cursor.executemany(
            """
            insert into entity_youtube_channels (
              entity_id, youtube_channel_id, channel_role
            )
            values (%s, %s, %s)
            on conflict (entity_id, youtube_channel_id) do update set
              channel_role = excluded.channel_role
            """,
            [(row["entity_id"], row["youtube_channel_id"], row["channel_role"]) for row in entity_channel_rows],
        )

        release_rows = payload["tables"]["releases"]
        count_operations("releases", release_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into releases (
              id, entity_id, release_title, normalized_release_title, release_date, stream, release_kind,
              release_format, source_url, artist_source_url, musicbrainz_artist_id,
              musicbrainz_release_group_id, notes
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              entity_id = excluded.entity_id,
              release_title = excluded.release_title,
              normalized_release_title = excluded.normalized_release_title,
              release_date = excluded.release_date,
              stream = excluded.stream,
              release_kind = excluded.release_kind,
              release_format = excluded.release_format,
              source_url = excluded.source_url,
              artist_source_url = excluded.artist_source_url,
              musicbrainz_artist_id = excluded.musicbrainz_artist_id,
              musicbrainz_release_group_id = excluded.musicbrainz_release_group_id,
              notes = excluded.notes,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["entity_id"],
                    row["release_title"],
                    row["normalized_release_title"],
                    row["release_date"],
                    row["stream"],
                    row["release_kind"],
                    row["release_format"],
                    row["source_url"],
                    row["artist_source_url"],
                    row["musicbrainz_artist_id"],
                    row["musicbrainz_release_group_id"],
                    row["notes"],
                )
                for row in release_rows
            ],
        )

        release_artwork_rows = payload["tables"]["release_artwork"]
        count_operations("release_artwork", release_artwork_rows, lambda row: str(row["release_id"]))
        cursor.executemany(
            """
            insert into release_artwork (
              release_id, cover_image_url, thumbnail_image_url, artwork_source_type, artwork_source_url
            )
            values (%s, %s, %s, %s, %s)
            on conflict (release_id) do update set
              cover_image_url = excluded.cover_image_url,
              thumbnail_image_url = excluded.thumbnail_image_url,
              artwork_source_type = excluded.artwork_source_type,
              artwork_source_url = excluded.artwork_source_url,
              updated_at = now()
            """,
            [
                (
                    row["release_id"],
                    row["cover_image_url"],
                    row["thumbnail_image_url"],
                    row["artwork_source_type"],
                    row["artwork_source_url"],
                )
                for row in release_artwork_rows
            ],
        )

        track_rows = payload["tables"]["tracks"]
        count_operations("tracks", track_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into tracks (
              id, release_id, track_order, track_title, normalized_track_title, is_title_track
            )
            values (%s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              release_id = excluded.release_id,
              track_order = excluded.track_order,
              track_title = excluded.track_title,
              normalized_track_title = excluded.normalized_track_title,
              is_title_track = excluded.is_title_track,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["release_id"],
                    row["track_order"],
                    row["track_title"],
                    row["normalized_track_title"],
                    row["is_title_track"],
                )
                for row in track_rows
            ],
        )

        release_service_rows = payload["tables"]["release_service_links"]
        count_operations("release_service_links", release_service_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into release_service_links (
              id, release_id, service_type, url, status, provenance
            )
            values (%s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              release_id = excluded.release_id,
              service_type = excluded.service_type,
              url = excluded.url,
              status = excluded.status,
              provenance = excluded.provenance,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["release_id"],
                    row["service_type"],
                    row["url"],
                    row["status"],
                    row["provenance"],
                )
                for row in release_service_rows
            ],
        )

        track_service_rows = payload["tables"]["track_service_links"]
        count_operations(
            "track_service_links",
            track_service_rows,
            lambda row: (str(row["track_id"]), row["service_type"]),
        )
        if track_service_rows:
            cursor.executemany(
                """
                insert into track_service_links (
                  id, track_id, service_type, url, status, provenance
                )
                values (%s, %s, %s, %s, %s, %s)
                on conflict (id) do update set
                  track_id = excluded.track_id,
                  service_type = excluded.service_type,
                  url = excluded.url,
                  status = excluded.status,
                  provenance = excluded.provenance,
                  updated_at = now()
                """,
                [
                    (
                        row["id"],
                        row["track_id"],
                        row["service_type"],
                        row["url"],
                        row["status"],
                        row["provenance"],
                    )
                    for row in track_service_rows
                ],
            )

        upcoming_signal_rows = payload["tables"]["upcoming_signals"]
        count_operations("upcoming_signals", upcoming_signal_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into upcoming_signals (
              id, entity_id, headline, normalized_headline, scheduled_date, scheduled_month, date_precision,
              date_status, release_format, confidence_score, tracking_status,
              first_seen_at, latest_seen_at, is_active, dedupe_key
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              entity_id = excluded.entity_id,
              headline = excluded.headline,
              normalized_headline = excluded.normalized_headline,
              scheduled_date = excluded.scheduled_date,
              scheduled_month = excluded.scheduled_month,
              date_precision = excluded.date_precision,
              date_status = excluded.date_status,
              release_format = excluded.release_format,
              confidence_score = excluded.confidence_score,
              tracking_status = excluded.tracking_status,
              first_seen_at = excluded.first_seen_at,
              latest_seen_at = excluded.latest_seen_at,
              is_active = excluded.is_active,
              dedupe_key = excluded.dedupe_key,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["entity_id"],
                    row["headline"],
                    row["normalized_headline"],
                    row["scheduled_date"],
                    row["scheduled_month"],
                    row["date_precision"],
                    row["date_status"],
                    row["release_format"],
                    row["confidence_score"],
                    row["tracking_status"],
                    row["first_seen_at"],
                    row["latest_seen_at"],
                    row["is_active"],
                    row["dedupe_key"],
                )
                for row in upcoming_signal_rows
            ],
        )

        upcoming_source_rows = payload["tables"]["upcoming_signal_sources"]
        count_operations("upcoming_signal_sources", upcoming_source_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into upcoming_signal_sources (
              id, upcoming_signal_id, source_type, source_url, source_domain, published_at, search_term, evidence_summary
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              upcoming_signal_id = excluded.upcoming_signal_id,
              source_type = excluded.source_type,
              source_url = excluded.source_url,
              source_domain = excluded.source_domain,
              published_at = excluded.published_at,
              search_term = excluded.search_term,
              evidence_summary = excluded.evidence_summary
            """,
            [
                (
                    row["id"],
                    row["upcoming_signal_id"],
                    row["source_type"],
                    row["source_url"],
                    row["source_domain"],
                    row["published_at"],
                    row["search_term"],
                    row["evidence_summary"],
                )
                for row in upcoming_source_rows
            ],
        )

        tracking_state_rows = payload["tables"]["entity_tracking_state"]
        count_operations("entity_tracking_state", tracking_state_rows, lambda row: str(row["entity_id"]))
        cursor.executemany(
            """
            insert into entity_tracking_state (
              entity_id, tier, watch_reason, tracking_status, latest_verified_release_id
            )
            values (%s, %s, %s, %s, %s)
            on conflict (entity_id) do update set
              tier = excluded.tier,
              watch_reason = excluded.watch_reason,
              tracking_status = excluded.tracking_status,
              latest_verified_release_id = excluded.latest_verified_release_id,
              updated_at = now()
            """,
            [
                (
                    row["entity_id"],
                    row["tier"],
                    row["watch_reason"],
                    row["tracking_status"],
                    row["latest_verified_release_id"],
                )
                for row in tracking_state_rows
            ],
        )

        review_task_rows = payload["tables"]["review_tasks"]
        count_operations("review_tasks", review_task_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into review_tasks (
              id, review_type, status, entity_id, release_id, upcoming_signal_id,
              review_reason, recommended_action, payload
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              review_type = excluded.review_type,
              status = excluded.status,
              entity_id = excluded.entity_id,
              release_id = excluded.release_id,
              upcoming_signal_id = excluded.upcoming_signal_id,
              review_reason = excluded.review_reason,
              recommended_action = excluded.recommended_action,
              payload = excluded.payload
            """,
            [
                (
                    row["id"],
                    row["review_type"],
                    row["status"],
                    row["entity_id"],
                    row["release_id"],
                    row["upcoming_signal_id"],
                    row["review_reason"],
                    row["recommended_action"],
                    Jsonb(row["payload"]),
                )
                for row in review_task_rows
            ],
        )

        release_override_rows = payload["tables"]["release_link_overrides"]
        count_operations("release_link_overrides", release_override_rows, lambda row: str(row["id"]))
        cursor.executemany(
            """
            insert into release_link_overrides (
              id, release_id, service_type, override_url, override_video_id, provenance
            )
            values (%s, %s, %s, %s, %s, %s)
            on conflict (id) do update set
              release_id = excluded.release_id,
              service_type = excluded.service_type,
              override_url = excluded.override_url,
              override_video_id = excluded.override_video_id,
              provenance = excluded.provenance,
              updated_at = now()
            """,
            [
                (
                    row["id"],
                    row["release_id"],
                    row["service_type"],
                    row["override_url"],
                    row["override_video_id"],
                    row["provenance"],
                )
                for row in release_override_rows
            ],
        )

    connection.commit()
    summary["operation_counts"] = {table: dict(counter) for table, counter in operations.items()}


def fetch_table_counts(connection: "psycopg.Connection[Any]") -> Dict[str, int]:
    counts: Dict[str, int] = {}
    with connection.cursor() as cursor:
        for table in TARGET_TABLES:
            cursor.execute(f"select count(*) from {table}")
            counts[table] = cursor.fetchone()[0]
    return counts


def fetch_critical_counts(connection: "psycopg.Connection[Any]") -> Dict[str, Any]:
    critical = {}
    with connection.cursor() as cursor:
        cursor.execute("select entity_type, count(*) from entities group by entity_type order by entity_type")
        critical["entity_type_counts"] = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("select date_precision, count(*) from upcoming_signals group by date_precision order by date_precision")
        critical["upcoming_date_precision_counts"] = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute(
            "select status, count(*) from release_service_links where service_type = 'youtube_mv' group by status order by status"
        )
        critical["youtube_mv_status_counts"] = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.execute("select count(*) from tracks where is_title_track is true")
        critical["title_track_rows"] = cursor.fetchone()[0]

        cursor.execute(
            "select count(*) from entity_aliases where alias ~ '[가-힣ㄱ-ㅎㅏ-ㅣ]'"
        )
        critical["hangul_alias_rows"] = cursor.fetchone()[0]

    return critical


def sanitize_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = dict(summary)
    sanitized["source_duplicates"] = dict(summary["source_duplicates"])
    sanitized["dropped_records"] = dict(summary["dropped_records"])
    sanitized["unresolved_release_mappings"] = summary["unresolved_release_mappings"][:25]
    sanitized["unresolved_review_links"] = summary["unresolved_review_links"][:25]
    return sanitized


def write_summary(path: Path, payload: Dict[str, Any]) -> None:
    ensure_directory(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def display_path(path: Path) -> str:
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT))
    except ValueError:
        return str(resolved)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import current JSON datasets into Neon canonical backend tables.")
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Path to write the machine-readable import summary JSON.",
    )
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable name that contains the direct Neon connection string.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        raise SystemExit(f"{args.database_url_env} is required. Source ~/.config/idol-song-app/neon.env first.")

    payload = build_import_payload()
    summary = payload["summary"]

    with psycopg.connect(database_url) as connection:
        upsert_table_rows(connection, payload, summary)
        summary["db_row_counts"] = fetch_table_counts(connection)
        summary["critical_checks"] = fetch_critical_counts(connection)

    summary["summary_path"] = display_path(Path(args.summary_path))
    summary["table_source_counts"] = {table: len(rows) for table, rows in payload["tables"].items()}
    write_summary(Path(args.summary_path), sanitize_summary(summary))

    print(
        json.dumps(
            {
                "summary_path": summary["summary_path"],
                "entity_rows": summary["db_row_counts"]["entities"],
                "release_rows": summary["db_row_counts"]["releases"],
                "upcoming_signal_rows": summary["db_row_counts"]["upcoming_signals"],
                "review_task_rows": summary["db_row_counts"]["review_tasks"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
