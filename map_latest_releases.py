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
    "(G)I-DLE": "(G)I-DLE",
    "TOMORROW X TOGETHER": "TOMORROW X TOGETHER",
    "THE BOYZ": "THE BOYZ",
    "fromis_9": "fromis_9",
    "woo!ah!": "woo!ah!",
    "CLASS:y": "CLASS:y",
    "ALL(H)OURS": "ALL(H)OURS",
    "&TEAM": "&TEAM",
    "The KingDom": "The KingDom kpop",
    "ifeye": "ifeye kpop",
    "AtHeart": "AtHeart kpop",
    "Hearts2Hearts": "Hearts2Hearts",
    "KiiiKiii": "KiiiKiii",
    "SAY MY NAME": "SAY MY NAME kpop",
    "IVE": "IVE kpop",
    "QWER": "QWER kpop",
    "CSR": "CSR kpop",
    "TNX": "TNX kpop",
    "WEi": "WEi kpop",
    "POW": "POW kpop",
    "NOMAD": "NOMAD kpop",
    "WHIB": "WHIB kpop",
    "TIOT": "TIOT kpop",
    "izna": "izna kpop",
    "AMPERS&ONE": "AMPERS&ONE",
}

BANNED_PATTERN = re.compile(
    r"\b(live|instrumental|remix|sped up|slowed|acoustic|karaoke|radio edit|commentary|demo|ver\.?|version|mixed)\b",
    re.IGNORECASE,
)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def parse_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def is_clean_track(track_name: str) -> bool:
    if not track_name:
        return False
    if "(feat." in track_name.lower():
        return False
    return BANNED_PATTERN.search(track_name) is None


def get_json(session: requests.Session, url: str, params: Dict[str, object], retries: int = 2) -> Dict:
    for attempt in range(retries):
        try:
            r = session.get(url, params=params, timeout=6)
            r.raise_for_status()
            return r.json()
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else None
            if code in (429, 403):
                time.sleep(1.2 + 0.6 * attempt)
            if attempt == retries - 1:
                raise
            time.sleep(0.6 * (attempt + 1))
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError("unreachable")


def build_name_set(group: str) -> set:
    names = [group] + ALIASES.get(group, [])
    return {norm(n) for n in names if n}


def search_best_artist(session: requests.Session, group: str) -> Optional[dict]:
    term = QUERY_OVERRIDE.get(group, group)
    d = get_json(
        session,
        "https://itunes.apple.com/search",
        {
            "term": term,
            "entity": "musicArtist",
            "attribute": "artistTerm",
            "limit": 25,
            "country": "us",
        },
    )
    results = d.get("results", [])
    if not results:
        return None

    name_set = build_name_set(group)
    g = norm(group)

    def score(a: dict) -> float:
        an = norm(a.get("artistName", ""))
        genre = (a.get("primaryGenreName") or "").lower()
        s = 0.0
        if an in name_set:
            s += 120
        if g and (g in an or an in g):
            s += 30
        if "k-pop" in genre or "kpop" in genre:
            s += 20
        if "korean" in genre:
            s += 10
        # slight boost for larger catalogs
        if a.get("artistId"):
            s += 1
        return s

    ranked = sorted(results, key=score, reverse=True)
    best = ranked[0]
    if score(best) < 60:
        return None
    return best


def lookup_songs(session: requests.Session, artist_id: int) -> List[dict]:
    d = get_json(
        session,
        "https://itunes.apple.com/lookup",
        {
            "id": artist_id,
            "entity": "song",
            "limit": 200,
            "country": "us",
        },
    )
    results = d.get("results", [])
    if not results:
        return []
    return [x for x in results if x.get("wrapperType") == "track" and x.get("kind") == "song"]


def pick_latest_and_comeback(songs: List[dict], artist_id: int) -> Tuple[Optional[dict], Optional[dict], int]:
    owned = [s for s in songs if s.get("artistId") == artist_id]
    clean = []
    for s in owned:
        dt = parse_date(s.get("releaseDate"))
        if not dt:
            continue
        if not is_clean_track(s.get("trackName", "")):
            continue
        clean.append((dt, s))

    past = [x for x in clean if x[0] <= TODAY]
    future = [x for x in clean if x[0] > TODAY]

    latest = sorted(past, key=lambda t: t[0], reverse=True)[0][1] if past else None
    comeback = sorted(future, key=lambda t: t[0])[0][1] if future else None
    return latest, comeback, len(owned)


def main() -> None:
    src = Path("artist_socials_structured_2026-03-04.json")
    if not src.exists():
        raise SystemExit("missing artist_socials_structured_2026-03-04.json")

    rows = json.loads(src.read_text(encoding="utf-8"))
    groups = [r["artist"] for r in rows if r.get("tier") in {"core", "longtail"}]

    out = []
    unresolved = []
    def process_group(group: str) -> Dict[str, object]:
        term = QUERY_OVERRIDE.get(group, group)
        query_url = (
            "https://itunes.apple.com/search"
            f"?term={requests.utils.quote(term)}&entity=musicArtist&attribute=artistTerm&limit=25&country=us"
        )
        session = requests.Session()
        session.headers.update({"User-Agent": "CodexReleaseMapper/1.1"})
        try:
            artist = search_best_artist(session, group)
            if not artist:
                return {"kind": "unresolved", "row": {"group": group, "reason": "artist_not_found", "query_url": query_url}}

            artist_id = artist.get("artistId")
            songs = lookup_songs(session, artist_id)
            latest, comeback, owned_count = pick_latest_and_comeback(songs, artist_id)

            if not latest:
                return {
                    "kind": "unresolved",
                    "row": {
                        "group": group,
                        "reason": "no_latest_clean_song",
                        "query_url": query_url,
                        "artist_id": artist_id,
                        "artist_name": artist.get("artistName"),
                    },
                }

            latest_dt = parse_date(latest.get("releaseDate"))
            if not latest_dt or latest_dt <= CUTOFF:
                return {"kind": "excluded", "row": {"group": group, "reason": "latest_before_cutoff", "query_url": query_url}}

            comeback_dt = parse_date(comeback.get("releaseDate")) if comeback else None
            return {
                "kind": "out",
                "row": {
                    "group": group,
                    "itunes_artist_name": artist.get("artistName"),
                    "itunes_artist_id": artist_id,
                    "latest_release_song": latest.get("trackName"),
                    "latest_release_date": latest_dt.date().isoformat(),
                    "latest_release_source": latest.get("trackViewUrl") or query_url,
                    "nearest_comeback_date": comeback_dt.date().isoformat() if comeback_dt else "",
                    "nearest_comeback_song": comeback.get("trackName") if comeback else "",
                    "nearest_comeback_source": comeback.get("trackViewUrl") if comeback else "",
                    "artist_source": artist.get("artistLinkUrl") or query_url,
                    "matched_song_count": owned_count,
                },
            }
        except Exception as e:
            return {"kind": "unresolved", "row": {"group": group, "reason": type(e).__name__, "query_url": query_url}}

    total = len(groups)
    for i, g in enumerate(groups, start=1):
        result = process_group(g)
        if result["kind"] == "out":
            out.append(result["row"])
        elif result["kind"] == "unresolved":
            unresolved.append(result["row"])

        if i % 15 == 0 or i == total:
            print(f"processed {i}/{total}")
        time.sleep(0.1)

    out.sort(key=lambda x: x["group"].lower())
    unresolved.sort(key=lambda x: x["group"].lower())

    Path("group_latest_release_since_2025-06-01.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    Path("group_latest_release_since_2025-06-01_unresolved.json").write_text(
        json.dumps(unresolved, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    with open("group_latest_release_since_2025-06-01.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "group",
                "itunes_artist_name",
                "itunes_artist_id",
                "latest_release_song",
                "latest_release_date",
                "latest_release_source",
                "nearest_comeback_date",
                "nearest_comeback_song",
                "nearest_comeback_source",
                "artist_source",
                "matched_song_count",
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
                "output_csv": "group_latest_release_since_2025-06-01.csv",
                "output_json": "group_latest_release_since_2025-06-01.json",
                "unresolved_json": "group_latest_release_since_2025-06-01_unresolved.json",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
