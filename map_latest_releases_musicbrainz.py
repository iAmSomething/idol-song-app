import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

from release_classification import classify_release

CUTOFF = datetime(2025, 6, 1, tzinfo=timezone.utc)
TODAY = datetime.now(timezone.utc)

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
    "XLOV": ["XLOV", "엑스러브", "xluv"],
    "QWER": ["QWER"],
    "IVE": ["IVE"],
    "WJSN": ["WJSN", "Cosmic Girls", "우주소녀"],
}

QUERY_OVERRIDE = {
    "(G)I-DLE": 'artist:"i-dle"',
    "TOMORROW X TOGETHER": 'artist:"TOMORROW X TOGETHER"',
    "THE BOYZ": 'artist:"THE BOYZ"',
    "fromis_9": 'artist:"fromis_9"',
    "woo!ah!": 'artist:"wooah"',
    "The KingDom": 'artist:"The KingDom"',
    "SAY MY NAME": 'artist:"SAY MY NAME"',
    "XLOV": 'artist:"XLOV"',
    "IVE": 'artist:"IVE"',
    "WJSN": 'alias:"WJSN"',
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


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def parse_mb_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        if len(s) == 4:
            return datetime(int(s), 1, 1, tzinfo=timezone.utc)
        if len(s) == 7:
            y, m = s.split("-")
            return datetime(int(y), int(m), 1, tzinfo=timezone.utc)
        if len(s) == 10:
            y, m, d = s.split("-")
            return datetime(int(y), int(m), int(d), tzinfo=timezone.utc)
    except Exception:
        return None
    return None


def get_json(session: requests.Session, url: str, params: Dict[str, object], retries: int = 3) -> Dict:
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=15)
            response.raise_for_status()
            return response.json()
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError("unreachable")


def build_name_set(group: str) -> set:
    names = [group] + ALIASES.get(group, [])
    return {norm(name) for name in names if name}


def search_best_artist(session: requests.Session, group: str) -> Optional[dict]:
    base_query = QUERY_OVERRIDE.get(group, f'artist:"{group}"')
    query = f"{base_query} AND country:KR"

    data = get_json(
        session,
        "https://musicbrainz.org/ws/2/artist/",
        {"query": query, "fmt": "json", "limit": 10},
    )
    artists = data.get("artists", [])

    if not artists:
        data = get_json(
            session,
            "https://musicbrainz.org/ws/2/artist/",
            {"query": base_query, "fmt": "json", "limit": 10},
        )
        artists = data.get("artists", [])

    if not artists:
        return None

    name_set = build_name_set(group)
    group_name = norm(group)

    def score(artist: dict) -> float:
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


def fetch_release_groups(session: requests.Session, artist_mbid: str) -> List[dict]:
    all_rows = []
    limit = 100
    offset = 0
    while True:
        data = get_json(
            session,
            "https://musicbrainz.org/ws/2/release-group",
            {
                "artist": artist_mbid,
                "fmt": "json",
                "limit": limit,
                "offset": offset,
            },
        )
        rows = data.get("release-groups", [])
        all_rows.extend(rows)
        if len(rows) < limit:
            break
        offset += limit
        if offset >= 400:
            break
    return all_rows


def normalize_release(row: dict) -> Optional[dict]:
    primary_type = row.get("primary-type")
    release_bucket = RELEASE_KIND_BY_PRIMARY.get(primary_type)
    if release_bucket is None:
        return None

    title = row.get("title", "")
    title_lower = title.lower()
    if not title or BANNED_PATTERN.search(title):
        return None
    if "(from" in title_lower or " feat." in title_lower or "(feat." in title_lower or " featuring " in title_lower:
        return None

    secondary_types = set(row.get("secondary-types") or [])
    if secondary_types & BANNED_SECONDARY_TYPES:
        return None

    release_date = parse_mb_date(row.get("first-release-date"))
    if not release_date:
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


def pick_latest_pair(rows: List[dict]) -> Tuple[Optional[dict], Optional[dict]]:
    normalized = [entry for row in rows if (entry := normalize_release(row))]
    latest: Dict[str, Optional[dict]] = {"song": None, "album": None}

    for bucket in ("song", "album"):
        candidates = [entry for entry in normalized if entry["bucket"] == bucket and entry["date"] <= TODAY]
        if candidates:
            latest[bucket] = sorted(
                candidates,
                key=lambda entry: (-entry["date"].toordinal(), entry["title"].casefold()),
            )[0]

    return latest["song"], latest["album"]


def serialize_release(entry: Optional[dict]) -> Optional[dict]:
    if entry is None:
        return None
    classification = classify_release(
        group=entry["group"],
        title=entry["title"],
        date=entry["date"].date().isoformat(),
        release_kind=entry["release_kind"],
    )
    return {
        "title": entry["title"],
        "date": entry["date"].date().isoformat(),
        "source": entry["source"],
        "release_kind": entry["release_kind"],
        "release_format": classification["release_format"],
        "context_tags": classification["context_tags"],
    }


def release_after_cutoff(entry: Optional[dict]) -> Optional[dict]:
    if entry is None:
        return None
    if parse_mb_date(entry["date"]) <= CUTOFF:
        return None
    return entry


def newest_release(row: dict) -> Optional[dict]:
    releases = [release for release in [row.get("latest_song"), row.get("latest_album")] if release]
    if not releases:
        return None
    return sorted(releases, key=lambda release: release["date"], reverse=True)[0]


def main() -> None:
    src = Path("artist_socials_structured_2026-03-04.json")
    rows = json.loads(src.read_text(encoding="utf-8"))
    groups = [row["artist"] for row in rows if row.get("tier") in {"core", "longtail"}]

    session = requests.Session()
    session.headers.update({"User-Agent": "CodexReleaseMapper/3.0 (contact: local-tool)"})

    out = []
    unresolved = []

    for index, group in enumerate(groups, start=1):
        try:
            artist = search_best_artist(session, group)
            if not artist:
                unresolved.append({"group": group, "reason": "artist_not_found"})
                continue

            artist_mbid = artist.get("id")
            release_groups = fetch_release_groups(session, artist_mbid)
            for release_group in release_groups:
                release_group["group"] = group
            latest_song, latest_album = pick_latest_pair(release_groups)
            latest_song_row = serialize_release(latest_song)
            latest_album_row = serialize_release(latest_album)
            recent_song_row = release_after_cutoff(latest_song_row)
            recent_album_row = release_after_cutoff(latest_album_row)

            if not latest_song_row and not latest_album_row:
                unresolved.append({"group": group, "reason": "no_release_match", "artist_mbid": artist_mbid})
                continue
            if not recent_song_row and not recent_album_row:
                continue

            row = {
                "group": group,
                "artist_name_mb": artist.get("name"),
                "artist_mbid": artist_mbid,
                "latest_song": recent_song_row,
                "latest_album": recent_album_row,
                "artist_source": f"https://musicbrainz.org/artist/{artist_mbid}",
            }

            newest = newest_release(row)
            if not newest:
                continue

            out.append(row)
        except Exception as error:
            unresolved.append({"group": group, "reason": type(error).__name__})

        if index % 10 == 0 or index == len(groups):
            print(f"processed {index}/{len(groups)}")

        time.sleep(0.8)

    out.sort(key=lambda row: row["group"].lower())
    unresolved.sort(key=lambda row: row["group"].lower())

    Path("group_latest_release_since_2025-06-01_mb.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    Path("group_latest_release_since_2025-06-01_mb_unresolved.json").write_text(
        json.dumps(unresolved, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with Path("group_latest_release_since_2025-06-01_mb.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "artist_name_mb",
                "artist_mbid",
                "latest_song_title",
                "latest_song_date",
                "latest_song_source",
                "latest_song_kind",
                "latest_song_format",
                "latest_song_context_tags",
                "latest_album_title",
                "latest_album_date",
                "latest_album_source",
                "latest_album_kind",
                "latest_album_format",
                "latest_album_context_tags",
                "artist_source",
            ],
        )
        writer.writeheader()
        for row in out:
            writer.writerow(
                {
                    "group": row["group"],
                    "artist_name_mb": row["artist_name_mb"],
                    "artist_mbid": row["artist_mbid"],
                    "latest_song_title": row["latest_song"]["title"] if row["latest_song"] else "",
                    "latest_song_date": row["latest_song"]["date"] if row["latest_song"] else "",
                    "latest_song_source": row["latest_song"]["source"] if row["latest_song"] else "",
                    "latest_song_kind": row["latest_song"]["release_kind"] if row["latest_song"] else "",
                    "latest_song_format": row["latest_song"]["release_format"] if row["latest_song"] else "",
                    "latest_song_context_tags": " ; ".join(row["latest_song"]["context_tags"]) if row["latest_song"] else "",
                    "latest_album_title": row["latest_album"]["title"] if row["latest_album"] else "",
                    "latest_album_date": row["latest_album"]["date"] if row["latest_album"] else "",
                    "latest_album_source": row["latest_album"]["source"] if row["latest_album"] else "",
                    "latest_album_kind": row["latest_album"]["release_kind"] if row["latest_album"] else "",
                    "latest_album_format": row["latest_album"]["release_format"] if row["latest_album"] else "",
                    "latest_album_context_tags": " ; ".join(row["latest_album"]["context_tags"]) if row["latest_album"] else "",
                    "artist_source": row["artist_source"],
                }
            )

    print(
        json.dumps(
            {
                "groups_with_release_data": len(out),
                "groups_unresolved": len(unresolved),
                "output_json": "group_latest_release_since_2025-06-01_mb.json",
                "output_csv": "group_latest_release_since_2025-06-01_mb.csv",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
