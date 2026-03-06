import csv
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

CUTOFF = datetime(2025, 6, 1, tzinfo=timezone.utc)
TODAY = datetime(2026, 3, 4, tzinfo=timezone.utc)

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
            r = session.get(url, params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError("unreachable")


def build_name_set(group: str) -> set:
    names = [group] + ALIASES.get(group, [])
    return {norm(n) for n in names if n}


def search_best_artist(session: requests.Session, group: str) -> Optional[dict]:
    base_query = QUERY_OVERRIDE.get(group, f'artist:"{group}"')
    query = f"{base_query} AND country:KR"

    data = get_json(
        session,
        "https://musicbrainz.org/ws/2/artist/",
        {"query": query, "fmt": "json", "limit": 10},
    )
    artists = data.get("artists", [])

    # fallback without country filter
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
    g = norm(group)

    def score(a: dict) -> float:
        an = norm(a.get("name", ""))
        s = 0.0
        if an in name_set:
            s += 120
        if g and (g in an or an in g):
            s += 20
        if a.get("type") == "Group":
            s += 25
        if a.get("country") == "KR":
            s += 20
        try:
            s += float(a.get("score", 0)) * 0.2
        except Exception:
            pass
        return s

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
                "type": "single",
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
        if offset >= 300:
            break
    return all_rows


def pick_latest_and_comeback(rows: List[dict]) -> Tuple[Optional[dict], Optional[dict]]:
    clean = []
    for r in rows:
        title = r.get("title", "")
        tl = title.lower()
        if not title or BANNED_PATTERN.search(title):
            continue
        if "(from" in tl or " feat." in tl or "(feat." in tl or " featuring " in tl:
            continue
        dt = parse_mb_date(r.get("first-release-date"))
        if not dt:
            continue
        clean.append((dt, r))

    past = [x for x in clean if x[0] <= TODAY]
    future = [x for x in clean if x[0] > TODAY]
    latest = sorted(past, key=lambda t: t[0], reverse=True)[0][1] if past else None
    comeback = sorted(future, key=lambda t: t[0])[0][1] if future else None
    return latest, comeback


def main() -> None:
    src = Path("artist_socials_structured_2026-03-04.json")
    rows = json.loads(src.read_text(encoding="utf-8"))
    groups = [r["artist"] for r in rows if r.get("tier") in {"core", "longtail"}]

    session = requests.Session()
    session.headers.update({"User-Agent": "CodexReleaseMapper/2.0 (contact: local-tool)"})

    out = []
    unresolved = []

    for i, group in enumerate(groups, start=1):
        try:
            artist = search_best_artist(session, group)
            if not artist:
                unresolved.append({"group": group, "reason": "artist_not_found"})
                continue

            mbid = artist.get("id")
            rg = fetch_release_groups(session, mbid)
            latest, comeback = pick_latest_and_comeback(rg)

            if not latest:
                unresolved.append({"group": group, "reason": "no_latest_single", "artist_mbid": mbid})
                continue

            latest_dt = parse_mb_date(latest.get("first-release-date"))
            if not latest_dt or latest_dt <= CUTOFF:
                continue

            comeback_dt = parse_mb_date(comeback.get("first-release-date")) if comeback else None

            out.append(
                {
                    "group": group,
                    "artist_name_mb": artist.get("name"),
                    "artist_mbid": mbid,
                    "latest_release_song": latest.get("title"),
                    "latest_release_date": latest_dt.date().isoformat(),
                    "latest_release_source": f"https://musicbrainz.org/release-group/{latest.get('id')}",
                    "nearest_comeback_date": comeback_dt.date().isoformat() if comeback_dt else "",
                    "nearest_comeback_song": comeback.get("title") if comeback else "",
                    "nearest_comeback_source": f"https://musicbrainz.org/release-group/{comeback.get('id')}" if comeback else "",
                    "artist_source": f"https://musicbrainz.org/artist/{mbid}",
                }
            )
        except Exception as e:
            unresolved.append({"group": group, "reason": type(e).__name__})

        if i % 10 == 0 or i == len(groups):
            print(f"processed {i}/{len(groups)}")

        # polite delay for MusicBrainz rate limits
        time.sleep(0.8)

    out.sort(key=lambda x: x["group"].lower())
    unresolved.sort(key=lambda x: x["group"].lower())

    Path("group_latest_release_since_2025-06-01_mb.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    Path("group_latest_release_since_2025-06-01_mb_unresolved.json").write_text(
        json.dumps(unresolved, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    with open("group_latest_release_since_2025-06-01_mb.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "group",
                "artist_name_mb",
                "artist_mbid",
                "latest_release_song",
                "latest_release_date",
                "latest_release_source",
                "nearest_comeback_date",
                "nearest_comeback_song",
                "nearest_comeback_source",
                "artist_source",
            ],
        )
        w.writeheader()
        w.writerows(out)

    print(
        json.dumps(
            {
                "groups_input": len(groups),
                "groups_output": len(out),
                "unresolved": len(unresolved),
                "output_csv": "group_latest_release_since_2025-06-01_mb.csv",
                "output_json": "group_latest_release_since_2025-06-01_mb.json",
                "unresolved_json": "group_latest_release_since_2025-06-01_mb_unresolved.json",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
