import argparse
import json
import os
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    import psycopg
except ImportError as error:  # pragma: no cover - runtime dependency guard
    raise SystemExit(
        "psycopg is required. Run `python3 -m pip install -r backend/requirements-import.txt` first."
    ) from error

from import_json_to_neon import (
    ARTIST_PROFILES_PATH,
    BACKEND_REPORTS_DIR,
    MANUAL_REVIEW_QUEUE_PATH,
    MV_MANUAL_REVIEW_QUEUE_PATH,
    RELEASES_ROLLUP_PATH,
    RELEASE_DETAILS_PATH,
    RELEASE_DETAIL_OVERRIDES_PATH,
    RELEASE_HISTORY_PATH,
    UPCOMING_CANDIDATES_PATH,
    WATCHLIST_PATH,
    YOUTUBE_ALLOWLISTS_PATH,
    build_upcoming_rows,
    load_json,
    normalize_text,
    normalize_url,
    optional_text,
    parse_exact_date,
    stable_uuid,
)


ROOT = Path(__file__).resolve().parent
DEFAULT_REPORT_PATH = BACKEND_REPORTS_DIR / "backend_json_parity_report.json"
TODAY = date.today()


def build_slug_maps() -> Tuple[Dict[str, str], Dict[str, Dict[str, Any]]]:
    profiles = load_json(ARTIST_PROFILES_PATH)
    return {row["group"]: row["slug"] for row in profiles}, {row["slug"]: row for row in profiles}


def release_key(slug: str, title: str, release_date: str, stream: str) -> str:
    return f"{slug}|{normalize_text(title)}|{release_date}|{stream}"


def limit_examples(rows: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    return rows[:limit]


def build_source_alias_map(group_to_slug: Dict[str, str]) -> Dict[str, set[str]]:
    rows = load_json(ARTIST_PROFILES_PATH)
    result: Dict[str, set[str]] = defaultdict(set)
    for row in rows:
        slug = group_to_slug[row["group"]]
        for value in (row.get("aliases") or []) + (row.get("search_aliases") or []):
            text = optional_text(value)
            if text:
                result[slug].add(normalize_text(text))
    return result


def build_source_official_links_and_channels(
    group_to_slug: Dict[str, str]
) -> Tuple[Dict[str, Dict[str, set[str]]], Dict[str, Dict[str, str]], Dict[str, Dict[str, Dict[str, Any]]]]:
    profiles = load_json(ARTIST_PROFILES_PATH)
    watchlist = {row["group"]: row for row in load_json(WATCHLIST_PATH)}
    history = {row["group"]: row for row in load_json(RELEASE_HISTORY_PATH)}
    rollup = {row["group"]: row for row in load_json(RELEASES_ROLLUP_PATH)}
    allowlists = {row["group"]: row for row in load_json(YOUTUBE_ALLOWLISTS_PATH)}

    official_links: Dict[str, Dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    channel_roles: Dict[str, Dict[str, str]] = defaultdict(dict)
    channel_metadata: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    for row in profiles:
        group = row["group"]
        slug = group_to_slug[group]
        watch = watchlist.get(group, {})
        allowlist_row = allowlists.get(group, {})

        youtube_url = normalize_url(row.get("official_youtube_url") or allowlist_row.get("primary_team_channel_url"))
        if youtube_url:
            official_links[slug]["youtube"].add(youtube_url)

        x_url = normalize_url(row.get("official_x_url") or watch.get("x_url"))
        if x_url:
            official_links[slug]["x"].add(x_url)

        instagram_url = normalize_url(row.get("official_instagram_url") or watch.get("instagram_url"))
        if instagram_url:
            official_links[slug]["instagram"].add(instagram_url)

        artist_source_url = normalize_url((history.get(group) or {}).get("artist_source") or (rollup.get(group) or {}).get("artist_source"))
        if artist_source_url:
            official_links[slug]["artist_source"].add(artist_source_url)

    for row in allowlists.values():
        slug = group_to_slug[row["group"]]
        primary_channel_url = normalize_url(row.get("primary_team_channel_url"))
        mv_allowlist_urls = {normalize_url(url) for url in row.get("mv_allowlist_urls") or []}
        mv_allowlist_urls.discard(None)

        for channel in row.get("channels") or []:
            channel_url = normalize_url(channel.get("channel_url"))
            if not channel_url:
                continue
            is_primary = channel_url == primary_channel_url
            is_mv = channel_url in mv_allowlist_urls
            if is_primary or is_mv:
                role = "both" if is_primary and is_mv else "primary_team_channel" if is_primary else "mv_allowlist"
                channel_roles[slug][channel_url] = role

            channel_metadata[slug][channel_url] = {
                "owner_type": channel.get("owner_type"),
                "display_in_team_links": bool(channel.get("display_in_team_links")),
                "allow_mv_uploads": bool(channel.get("allow_mv_uploads")),
            }

    return official_links, channel_roles, channel_metadata


def build_source_latest_release_maps(group_to_slug: Dict[str, str]) -> Tuple[Dict[str, Optional[str]], Dict[str, Dict[str, Optional[str]]]]:
    watchlist = load_json(WATCHLIST_PATH)
    releases_rollup = load_json(RELEASES_ROLLUP_PATH)

    tracking_latest: Dict[str, Optional[str]] = {}
    for row in watchlist:
        slug = group_to_slug[row["group"]]
        title = optional_text(row.get("latest_release_title"))
        release_date = optional_text(row.get("latest_release_date"))
        kind = optional_text(row.get("latest_release_kind"))
        if title and release_date and kind:
            stream = "song" if kind == "single" else "album"
            tracking_latest[slug] = release_key(slug, title, release_date, stream)
        else:
            tracking_latest[slug] = None

    stream_latest: Dict[str, Dict[str, Optional[str]]] = defaultdict(dict)
    for row in releases_rollup:
        slug = group_to_slug[row["group"]]
        for field_name, stream in (("latest_song", "song"), ("latest_album", "album")):
            release = row.get(field_name)
            if release:
                stream_latest[slug][stream] = release_key(slug, release["title"], release["date"], stream)
            else:
                stream_latest[slug][stream] = None

    return tracking_latest, stream_latest


def build_source_upcoming_summary(group_to_slug: Dict[str, str]) -> Dict[str, Any]:
    rows = load_json(UPCOMING_CANDIDATES_PATH)
    entity_ids = {group: stable_uuid("entity", slug) for group, slug in group_to_slug.items()}
    entity_id_to_slug = {entity_id: slug for group, slug in group_to_slug.items() for entity_id in [entity_ids[group]]}
    import_summary = {
        "source_duplicates": Counter(),
        "dropped_records": Counter(),
        "dropped_missing_fk_samples": {},
        "unresolved_release_mappings": [],
        "unresolved_review_links": [],
    }
    signal_rows, _, _ = build_upcoming_rows(rows, entity_ids, import_summary)
    precision_counts = Counter()
    future_exact = []
    month_buckets = {"exact": Counter(), "month_only": Counter()}

    for row in signal_rows:
        precision = row["date_precision"]
        precision_counts[precision] += 1
        scheduled_date = row.get("scheduled_date").isoformat() if row.get("scheduled_date") is not None else None
        scheduled_month = row.get("scheduled_month").isoformat()[:7] if row.get("scheduled_month") is not None else None

        if precision == "exact" and scheduled_date:
            month_buckets["exact"][scheduled_date[:7]] += 1
            parsed = parse_exact_date(scheduled_date)
            if parsed and parsed >= TODAY:
                future_exact.append(
                    {
                        "slug": entity_id_to_slug.get(row["entity_id"]),
                        "scheduled_date": scheduled_date,
                        "headline": row["headline"],
                        "confidence": row.get("confidence_score") or 0,
                    }
                )
        elif precision == "month_only" and scheduled_month:
            month_buckets["month_only"][scheduled_month] += 1

    future_exact = [item for item in future_exact if item["slug"] is not None]
    future_exact.sort(key=lambda item: (item["scheduled_date"], -item["confidence"], item["slug"]))
    nearest = future_exact[0] if future_exact else None

    return {
        "total": len(signal_rows),
        "precision_counts": dict(precision_counts),
        "future_exact_count": len(future_exact),
        "nearest_exact": nearest,
        "month_buckets": {
            "exact": dict(sorted(month_buckets["exact"].items())),
            "month_only": dict(sorted(month_buckets["month_only"].items())),
        },
    }


def build_source_title_track_map(group_to_slug: Dict[str, str]) -> Dict[str, List[str]]:
    rows = load_json(RELEASE_DETAILS_PATH)
    result = {}
    for row in rows:
        slug = group_to_slug[row["group"]]
        key = release_key(slug, row["release_title"], row["release_date"], row["stream"])
        titles = sorted(track["title"] for track in row.get("tracks") or [] if track.get("is_title_track") is True)
        result[key] = titles
    return result


def build_source_service_link_map(group_to_slug: Dict[str, str]) -> Dict[str, Dict[str, Dict[str, Optional[str]]]]:
    details = load_json(RELEASE_DETAILS_PATH)
    overrides = {
        release_key(group_to_slug[row["group"]], row["release_title"], row["release_date"], row["stream"]): row
        for row in load_json(RELEASE_DETAIL_OVERRIDES_PATH)
    }
    result: Dict[str, Dict[str, Dict[str, Optional[str]]]] = {}

    for row in details:
        slug = group_to_slug[row["group"]]
        key = release_key(slug, row["release_title"], row["release_date"], row["stream"])
        override = overrides.get(key, {})
        service_rows = {}

        spotify_url = normalize_url(row.get("spotify_url"))
        service_rows["spotify"] = {
            "url": spotify_url,
            "status": "canonical" if spotify_url else "no_link",
            "provenance": "releaseDetails.spotify_url" if spotify_url else None,
        }

        youtube_music_url = normalize_url(override.get("youtube_music_url") or row.get("youtube_music_url"))
        youtube_music_status = "manual_override" if normalize_url(override.get("youtube_music_url")) else "canonical" if normalize_url(row.get("youtube_music_url")) else "no_link"
        youtube_music_provenance = optional_text(override.get("provenance")) if normalize_url(override.get("youtube_music_url")) else "releaseDetails.youtube_music_url" if normalize_url(row.get("youtube_music_url")) else None
        service_rows["youtube_music"] = {
            "url": youtube_music_url,
            "status": youtube_music_status,
            "provenance": youtube_music_provenance,
        }

        youtube_mv_url = normalize_url(override.get("youtube_video_url") or row.get("youtube_video_url"))
        if youtube_mv_url is None and optional_text(override.get("youtube_video_id")):
            youtube_mv_url = f"https://www.youtube.com/watch?v={override['youtube_video_id']}"
        youtube_mv_status = (
            "manual_override"
            if normalize_url(override.get("youtube_video_url")) or optional_text(override.get("youtube_video_id"))
            else optional_text(row.get("youtube_video_status")) or ("canonical" if normalize_url(row.get("youtube_video_url")) else "no_link")
        )
        youtube_mv_provenance = (
            optional_text(override.get("youtube_video_provenance"))
            or optional_text(override.get("provenance"))
            or optional_text(row.get("youtube_video_provenance"))
        )
        service_rows["youtube_mv"] = {
            "url": youtube_mv_url,
            "status": youtube_mv_status,
            "provenance": youtube_mv_provenance,
        }

        result[key] = service_rows

    return result


def build_source_review_summary() -> Dict[str, Any]:
    manual_review_rows = load_json(MANUAL_REVIEW_QUEUE_PATH)
    mv_review_rows = load_json(MV_MANUAL_REVIEW_QUEUE_PATH)

    review_type_counts = Counter()
    for row in manual_review_rows:
        reasons = row.get("review_reason") or []
        if "unresolved_group" in reasons or row.get("source_type") == "unresolved" or normalize_url(row.get("source_url")) is None:
            review_type_counts["entity_onboarding"] += 1
        else:
            review_type_counts["upcoming_signal"] += 1
    review_type_counts["mv_candidate"] = len(mv_review_rows)

    mv_status_counts = Counter()
    for row in load_json(RELEASE_DETAILS_PATH):
        status = optional_text(row.get("youtube_video_status")) or ("canonical" if normalize_url(row.get("youtube_video_url")) else "no_link")
        mv_status_counts[status] += 1

    return {
        "review_type_counts": dict(review_type_counts),
        "youtube_mv_status_counts": dict(mv_status_counts),
    }


def fetch_db_snapshot() -> Dict[str, Any]:
    database_url = os.environ["DATABASE_URL"]
    snapshot: Dict[str, Any] = {}
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select slug, canonical_name from entities order by slug")
            entities = cur.fetchall()
            snapshot["entity_slugs"] = {row[0] for row in entities}

            cur.execute(
                """
                select e.slug, ea.normalized_alias
                from entity_aliases ea
                join entities e on e.id = ea.entity_id
                order by e.slug, ea.normalized_alias
                """
            )
            aliases = defaultdict(set)
            for slug, normalized_alias in cur.fetchall():
                aliases[slug].add(normalized_alias)
            snapshot["aliases"] = aliases

            cur.execute(
                """
                select e.slug, eol.link_type, eol.url
                from entity_official_links eol
                join entities e on e.id = eol.entity_id
                order by e.slug, eol.link_type, eol.url
                """
            )
            official_links: Dict[str, Dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
            for slug, link_type, url in cur.fetchall():
                official_links[slug][link_type].add(normalize_url(url))
            snapshot["official_links"] = official_links

            cur.execute(
                """
                select e.slug, yc.canonical_channel_url, eyc.channel_role, yc.owner_type, yc.display_in_team_links, yc.allow_mv_uploads
                from entity_youtube_channels eyc
                join entities e on e.id = eyc.entity_id
                join youtube_channels yc on yc.id = eyc.youtube_channel_id
                order by e.slug, yc.canonical_channel_url
                """
            )
            channel_roles: Dict[str, Dict[str, str]] = defaultdict(dict)
            channel_metadata: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
            for slug, channel_url, role, owner_type, display_in_team_links, allow_mv_uploads in cur.fetchall():
                url = normalize_url(channel_url)
                channel_roles[slug][url] = role
                channel_metadata[slug][url] = {
                    "owner_type": owner_type,
                    "display_in_team_links": display_in_team_links,
                    "allow_mv_uploads": allow_mv_uploads,
                }
            snapshot["channel_roles"] = channel_roles
            snapshot["channel_metadata"] = channel_metadata

            cur.execute(
                """
                select e.slug, r.release_title, r.release_date::text, r.stream
                from entity_tracking_state ets
                join entities e on e.id = ets.entity_id
                left join releases r on r.id = ets.latest_verified_release_id
                order by e.slug
                """
            )
            tracking_latest = {}
            for slug, title, release_date, stream in cur.fetchall():
                tracking_latest[slug] = release_key(slug, title, release_date, stream) if title and release_date and stream else None
            snapshot["tracking_latest"] = tracking_latest

            cur.execute(
                """
                select e.slug, r.release_title, r.release_date::text, r.stream
                from releases r
                join entities e on e.id = r.entity_id
                order by e.slug, r.stream, r.release_date desc, r.release_title asc
                """
            )
            latest_by_stream: Dict[str, Dict[str, Optional[str]]] = defaultdict(dict)
            seen_streams = set()
            for slug, title, release_date, stream in cur.fetchall():
                key = (slug, stream)
                if key in seen_streams:
                    continue
                seen_streams.add(key)
                latest_by_stream[slug][stream] = release_key(slug, title, release_date, stream)
            snapshot["latest_by_stream"] = latest_by_stream

            cur.execute(
                """
                select e.slug, us.headline, us.scheduled_date::text, us.scheduled_month::text, us.date_precision, us.confidence_score
                from upcoming_signals us
                join entities e on e.id = us.entity_id
                where us.is_active = true
                order by e.slug, us.headline
                """
            )
            upcoming_rows = cur.fetchall()
            precision_counts = Counter()
            future_exact = []
            month_buckets = {"exact": Counter(), "month_only": Counter()}
            for slug, headline, scheduled_date, scheduled_month, precision, confidence_score in upcoming_rows:
                precision_counts[precision] += 1
                if precision == "exact" and scheduled_date:
                    month_buckets["exact"][scheduled_date[:7]] += 1
                    parsed = parse_exact_date(scheduled_date)
                    if parsed and parsed >= TODAY:
                        future_exact.append(
                            {
                                "slug": slug,
                                "scheduled_date": scheduled_date,
                                "headline": headline,
                                "confidence": float(confidence_score or 0),
                            }
                        )
                elif precision == "month_only" and scheduled_month:
                    month_buckets["month_only"][scheduled_month[:7]] += 1
            future_exact.sort(key=lambda item: (item["scheduled_date"], -item["confidence"], item["slug"]))
            snapshot["upcoming"] = {
                "total": len(upcoming_rows),
                "precision_counts": dict(precision_counts),
                "future_exact_count": len(future_exact),
                "nearest_exact": future_exact[0] if future_exact else None,
                "month_buckets": {
                    "exact": dict(sorted(month_buckets["exact"].items())),
                    "month_only": dict(sorted(month_buckets["month_only"].items())),
                },
            }

            cur.execute(
                """
                select e.slug, r.release_title, r.release_date::text, r.stream, t.track_title
                from tracks t
                join releases r on r.id = t.release_id
                join entities e on e.id = r.entity_id
                where t.is_title_track is true
                order by e.slug, r.release_date, r.release_title, t.track_title
                """
            )
            title_tracks = defaultdict(list)
            for slug, release_title, release_date, stream, track_title in cur.fetchall():
                title_tracks[release_key(slug, release_title, release_date, stream)].append(track_title)
            snapshot["title_tracks"] = {key: sorted(value) for key, value in title_tracks.items()}

            cur.execute(
                """
                select e.slug, r.release_title, r.release_date::text, r.stream, rsl.service_type, rsl.url, rsl.status, rsl.provenance
                from release_service_links rsl
                join releases r on r.id = rsl.release_id
                join entities e on e.id = r.entity_id
                where rsl.service_type in ('spotify', 'youtube_music', 'youtube_mv')
                order by e.slug, r.release_date, r.release_title, rsl.service_type
                """
            )
            service_links = defaultdict(dict)
            mv_status_counts = Counter()
            for slug, release_title, release_date, stream, service_type, url, status, provenance in cur.fetchall():
                key = release_key(slug, release_title, release_date, stream)
                service_links[key][service_type] = {
                    "url": normalize_url(url),
                    "status": status,
                    "provenance": provenance,
                }
                if service_type == "youtube_mv":
                    mv_status_counts[status] += 1
            snapshot["service_links"] = service_links
            snapshot["youtube_mv_status_counts"] = dict(mv_status_counts)

            cur.execute("select review_type, count(*) from review_tasks where status = 'open' group by review_type order by review_type")
            snapshot["review_type_counts"] = {review_type: count for review_type, count in cur.fetchall()}

    return snapshot


def compare_aliases(source_aliases: Dict[str, set[str]], db_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    db_aliases = db_snapshot["aliases"]
    mismatches = []
    for slug in sorted(set(source_aliases) | set(db_aliases)):
        missing = sorted(source_aliases.get(slug, set()) - db_aliases.get(slug, set()))
        extra = sorted(db_aliases.get(slug, set()) - source_aliases.get(slug, set()))
        if missing or extra:
            mismatches.append({"entity_slug": slug, "missing_aliases": missing, "extra_aliases": extra})
    return {
        "source_entity_count": len(source_aliases),
        "db_entity_count": len(db_aliases),
        "mismatched_entities_count": len(mismatches),
        "mismatches": limit_examples(mismatches),
        "clean": len(mismatches) == 0,
    }


def compare_official_links(
    source_links: Dict[str, Dict[str, set[str]]],
    db_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    db_links = db_snapshot["official_links"]
    mismatches = []
    for slug in sorted(set(source_links) | set(db_links)):
        source_types = source_links.get(slug, {})
        db_types = db_links.get(slug, {})
        type_diffs = []
        for link_type in sorted(set(source_types) | set(db_types)):
            missing = sorted(source_types.get(link_type, set()) - db_types.get(link_type, set()))
            extra = sorted(db_types.get(link_type, set()) - source_types.get(link_type, set()))
            if missing or extra:
                type_diffs.append({"link_type": link_type, "missing_urls": missing, "extra_urls": extra})
        if type_diffs:
            mismatches.append({"entity_slug": slug, "diffs": type_diffs})
    return {
        "mismatched_entities_count": len(mismatches),
        "mismatches": limit_examples(mismatches),
        "clean": len(mismatches) == 0,
    }


def compare_youtube_channels(
    source_roles: Dict[str, Dict[str, str]],
    source_metadata: Dict[str, Dict[str, Dict[str, Any]]],
    db_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    db_roles = db_snapshot["channel_roles"]
    db_metadata = db_snapshot["channel_metadata"]
    mismatches = []
    metadata_mismatches = []

    for slug in sorted(set(source_roles) | set(db_roles)):
        source_map = source_roles.get(slug, {})
        db_map = db_roles.get(slug, {})
        missing = sorted((url, role) for url, role in source_map.items() if db_map.get(url) != role)
        extra = sorted((url, role) for url, role in db_map.items() if source_map.get(url) != role)
        if missing or extra:
            mismatches.append(
                {
                    "entity_slug": slug,
                    "missing_channel_roles": [{"url": url, "role": role} for url, role in missing],
                    "extra_channel_roles": [{"url": url, "role": role} for url, role in extra],
                }
            )

        for url in sorted(set(source_metadata.get(slug, {})) & set(db_metadata.get(slug, {}))):
            source_row = source_metadata[slug][url]
            db_row = db_metadata[slug][url]
            diffs = {}
            for field_name in ("owner_type", "display_in_team_links", "allow_mv_uploads"):
                if source_row.get(field_name) != db_row.get(field_name):
                    diffs[field_name] = {"source": source_row.get(field_name), "db": db_row.get(field_name)}
            if diffs:
                metadata_mismatches.append({"entity_slug": slug, "channel_url": url, "diffs": diffs})

    return {
        "role_mismatches_count": len(mismatches),
        "metadata_mismatches_count": len(metadata_mismatches),
        "role_mismatches": limit_examples(mismatches),
        "metadata_mismatches": limit_examples(metadata_mismatches),
        "clean": len(mismatches) == 0 and len(metadata_mismatches) == 0,
    }


def compare_latest_verified_release(
    source_tracking_latest: Dict[str, Optional[str]],
    source_latest_by_stream: Dict[str, Dict[str, Optional[str]]],
    db_snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    tracking_mismatches = []
    for slug in sorted(source_tracking_latest):
        if source_tracking_latest.get(slug) != db_snapshot["tracking_latest"].get(slug):
            tracking_mismatches.append(
                {"entity_slug": slug, "source": source_tracking_latest.get(slug), "db": db_snapshot["tracking_latest"].get(slug)}
            )

    stream_mismatches = []
    db_streams = db_snapshot["latest_by_stream"]
    for slug in sorted(source_latest_by_stream):
        for stream in ("song", "album"):
            source_value = source_latest_by_stream[slug].get(stream)
            if source_value is None:
                continue
            db_value = db_streams.get(slug, {}).get(stream)
            if source_value != db_value:
                stream_mismatches.append({"entity_slug": slug, "stream": stream, "source": source_value, "db": db_value})

    return {
        "tracking_mismatches_count": len(tracking_mismatches),
        "tracking_mismatches": limit_examples(tracking_mismatches),
        "stream_mismatches_count": len(stream_mismatches),
        "stream_mismatches": limit_examples(stream_mismatches),
        "clean": len(tracking_mismatches) == 0 and len(stream_mismatches) == 0,
    }


def compare_upcoming(source_summary: Dict[str, Any], db_summary: Dict[str, Any]) -> Dict[str, Any]:
    month_bucket_mismatches = []
    for bucket in ("exact", "month_only"):
        source_buckets = source_summary["month_buckets"][bucket]
        db_buckets = db_summary["month_buckets"][bucket]
        for month_key in sorted(set(source_buckets) | set(db_buckets)):
            if source_buckets.get(month_key, 0) != db_buckets.get(month_key, 0):
                month_bucket_mismatches.append(
                    {
                        "bucket": bucket,
                        "month": month_key,
                        "source": source_buckets.get(month_key, 0),
                        "db": db_buckets.get(month_key, 0),
                    }
                )

    return {
        "source": source_summary,
        "db": db_summary,
        "total_matches": source_summary["total"] == db_summary["total"],
        "precision_matches": source_summary["precision_counts"] == db_summary["precision_counts"],
        "future_exact_matches": source_summary["future_exact_count"] == db_summary["future_exact_count"],
        "nearest_exact_matches": source_summary["nearest_exact"] == db_summary["nearest_exact"],
        "month_bucket_mismatches_count": len(month_bucket_mismatches),
        "month_bucket_mismatches": limit_examples(month_bucket_mismatches),
        "clean": (
            source_summary["total"] == db_summary["total"]
            and source_summary["precision_counts"] == db_summary["precision_counts"]
            and source_summary["future_exact_count"] == db_summary["future_exact_count"]
            and source_summary["nearest_exact"] == db_summary["nearest_exact"]
            and len(month_bucket_mismatches) == 0
        ),
    }


def compare_title_tracks(source_title_tracks: Dict[str, List[str]], db_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    db_title_tracks = db_snapshot["title_tracks"]
    mismatches = []
    for key in sorted(set(source_title_tracks) | set(db_title_tracks)):
        source_titles = source_title_tracks.get(key, [])
        db_titles = db_title_tracks.get(key, [])
        if source_titles != db_titles:
            slug, _, release_date, stream = key.split("|", 3)
            mismatches.append(
                {
                    "entity_slug": slug,
                    "release_date": release_date,
                    "stream": stream,
                    "source_title_tracks": source_titles,
                    "db_title_tracks": db_titles,
                }
            )
    double_title_source = sum(1 for value in source_title_tracks.values() if len(value) > 1)
    double_title_db = sum(1 for value in db_title_tracks.values() if len(value) > 1)
    return {
        "mismatched_releases_count": len(mismatches),
        "source_double_title_releases": double_title_source,
        "db_double_title_releases": double_title_db,
        "mismatches": limit_examples(mismatches),
        "clean": len(mismatches) == 0 and double_title_source == double_title_db,
    }


def compare_service_links(source_services: Dict[str, Dict[str, Dict[str, Optional[str]]]], db_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    db_services = db_snapshot["service_links"]
    mismatches = []
    for key in sorted(set(source_services) | set(db_services)):
        source_map = source_services.get(key, {})
        db_map = db_services.get(key, {})
        for service_type in ("youtube_music", "youtube_mv"):
            source_row = source_map.get(service_type)
            db_row = db_map.get(service_type)
            if (source_row or {}).get("url") != (db_row or {}).get("url") or (source_row or {}).get("status") != (db_row or {}).get("status"):
                slug, _, release_date, stream = key.split("|", 3)
                mismatches.append(
                    {
                        "entity_slug": slug,
                        "release_date": release_date,
                        "stream": stream,
                        "service_type": service_type,
                        "source": source_row,
                        "db": db_row,
                    }
                )
    return {
        "mismatched_release_services_count": len(mismatches),
        "mismatches": limit_examples(mismatches),
        "clean": len(mismatches) == 0,
    }


def compare_review_required_counts(source_summary: Dict[str, Any], db_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "source_review_type_counts": source_summary["review_type_counts"],
        "db_review_type_counts": db_snapshot["review_type_counts"],
        "source_youtube_mv_status_counts": source_summary["youtube_mv_status_counts"],
        "db_youtube_mv_status_counts": db_snapshot["youtube_mv_status_counts"],
        "review_type_counts_match": source_summary["review_type_counts"] == db_snapshot["review_type_counts"],
        "youtube_mv_status_counts_match": source_summary["youtube_mv_status_counts"] == db_snapshot["youtube_mv_status_counts"],
        "clean": source_summary["review_type_counts"] == db_snapshot["review_type_counts"]
        and source_summary["youtube_mv_status_counts"] == db_snapshot["youtube_mv_status_counts"],
    }


def build_summary_lines(checks: Dict[str, Dict[str, Any]]) -> List[str]:
    lines = []

    alias_check = checks["entity_alias_search_coverage"]
    lines.append(
        f"entity alias/search coverage: {'clean' if alias_check['clean'] else 'drift'} "
        f"(mismatched entities={alias_check['mismatched_entities_count']})"
    )

    official_links_check = checks["official_links"]
    lines.append(
        f"official links: {'clean' if official_links_check['clean'] else 'drift'} "
        f"(mismatched entities={official_links_check['mismatched_entities_count']})"
    )

    youtube_check = checks["youtube_allowlists"]
    lines.append(
        f"YouTube allowlists: {'clean' if youtube_check['clean'] else 'drift'} "
        f"(role mismatches={youtube_check['role_mismatches_count']}, metadata mismatches={youtube_check['metadata_mismatches_count']})"
    )

    latest_check = checks["latest_verified_release_selection"]
    lines.append(
        f"latest verified release selection: {'clean' if latest_check['clean'] else 'drift'} "
        f"(tracking mismatches={latest_check['tracking_mismatches_count']}, stream mismatches={latest_check['stream_mismatches_count']})"
    )

    upcoming_check = checks["upcoming_counts_and_nearest"]
    lines.append(
        f"upcoming counts / nearest: {'clean' if upcoming_check['clean'] else 'drift'} "
        f"(month bucket mismatches={upcoming_check['month_bucket_mismatches_count']})"
    )

    title_track_check = checks["title_tracks_and_double_title"]
    lines.append(
        f"title-track / double-title: {'clean' if title_track_check['clean'] else 'drift'} "
        f"(mismatched releases={title_track_check['mismatched_releases_count']})"
    )

    service_check = checks["release_service_links"]
    lines.append(
        f"YouTube Music / MV service-link state: {'clean' if service_check['clean'] else 'drift'} "
        f"(mismatched releases={service_check['mismatched_release_services_count']})"
    )

    review_check = checks["review_required_counts"]
    lines.append(
        f"review-required counts: {'clean' if review_check['clean'] else 'drift'} "
        f"(review_type_counts_match={review_check['review_type_counts_match']}, youtube_mv_status_counts_match={review_check['youtube_mv_status_counts_match']})"
    )

    return lines


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare canonical backend state with current JSON baselines.")
    parser.add_argument(
        "--report-path",
        default=str(DEFAULT_REPORT_PATH),
        help="Path to write the machine-readable parity report JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    group_to_slug, _ = build_slug_maps()

    source_aliases = build_source_alias_map(group_to_slug)
    source_links, source_channel_roles, source_channel_metadata = build_source_official_links_and_channels(group_to_slug)
    source_tracking_latest, source_latest_by_stream = build_source_latest_release_maps(group_to_slug)
    source_upcoming_summary = build_source_upcoming_summary(group_to_slug)
    source_title_tracks = build_source_title_track_map(group_to_slug)
    source_service_links = build_source_service_link_map(group_to_slug)
    source_review_summary = build_source_review_summary()

    db_snapshot = fetch_db_snapshot()

    checks = {
        "entity_alias_search_coverage": compare_aliases(source_aliases, db_snapshot),
        "official_links": compare_official_links(source_links, db_snapshot),
        "youtube_allowlists": compare_youtube_channels(source_channel_roles, source_channel_metadata, db_snapshot),
        "latest_verified_release_selection": compare_latest_verified_release(
            source_tracking_latest, source_latest_by_stream, db_snapshot
        ),
        "upcoming_counts_and_nearest": compare_upcoming(source_upcoming_summary, db_snapshot["upcoming"]),
        "title_tracks_and_double_title": compare_title_tracks(source_title_tracks, db_snapshot),
        "release_service_links": compare_service_links(source_service_links, db_snapshot),
        "review_required_counts": compare_review_required_counts(source_review_summary, db_snapshot),
    }

    summary_lines = build_summary_lines(checks)
    clean = all(check["clean"] for check in checks.values())

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "clean": clean,
        "summary_lines": summary_lines,
        "source_snapshot_counts": {
            "artist_profiles": len(load_json(ARTIST_PROFILES_PATH)),
            "youtube_allowlists": len(load_json(YOUTUBE_ALLOWLISTS_PATH)),
            "release_details": len(load_json(RELEASE_DETAILS_PATH)),
            "upcoming_candidates": len(load_json(UPCOMING_CANDIDATES_PATH)),
            "watchlist": len(load_json(WATCHLIST_PATH)),
            "manual_review_queue": len(load_json(MANUAL_REVIEW_QUEUE_PATH)),
            "mv_manual_review_queue": len(load_json(MV_MANUAL_REVIEW_QUEUE_PATH)),
        },
        "checks": checks,
    }

    report_path = Path(args.report_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"clean": clean, "report_path": str(report_path.resolve())}, ensure_ascii=False))
    for line in summary_lines:
        print(line)


if __name__ == "__main__":
    main()
