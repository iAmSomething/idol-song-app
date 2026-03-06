import csv
import json
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import requests

CORE = [
    "BLACKPINK", "BTS", "TWICE", "SEVENTEEN", "Stray Kids", "ENHYPEN", "TOMORROW X TOGETHER", "aespa", "IVE",
    "LE SSERAFIM", "NewJeans", "(G)I-DLE", "ITZY", "NMIXX", "BABYMONSTER", "Red Velvet", "NCT 127", "NCT DREAM",
    "WayV", "NCT WISH", "RIIZE", "ZEROBASEONE", "BOYNEXTDOOR", "TWS", "ATEEZ", "TREASURE", "THE BOYZ", "MONSTA X",
    "EXO", "SHINee", "DAY6", "Xdinary Heroes", "KISS OF LIFE", "STAYC", "tripleS", "Kep1er", "VIVIZ", "Dreamcatcher",
    "fromis_9", "QWER", "MEOVV", "Hearts2Hearts", "KiiiKiii", "RESCENE", "ifeye", "AtHeart", "EVNNE", "xikers",
    "P1Harmony", "CRAVITY", "PLAVE", "KickFlip", "NEXZ", "UNIS", "FIFTY FIFTY", "&TEAM", "BTOB", "INFINITE",
    "MAMAMOO", "KARD"
]

LONGTAIL = [
    "H1-KEY", "Purple Kiss", "LIGHTSUM", "Weeekly", "ARTMS", "Loossemble", "YOUNG POSSE", "BADVILLAIN", "SAY MY NAME",
    "izna", "woo!ah!", "CSR", "CLASS:y", "cignature", "ONF", "ONEUS", "ONEWE", "EPEX", "TEMPEST", "CIX", "AB6IX",
    "WEi", "VERIVERY", "8TURN", "82MAJOR", "AMPERS&ONE", "ALL(H)OURS", "WHIB", "NOMAD", "TIOT", "LUN8", "TNX",
    "DKB", "YOUNITE", "JUST B", "ATBO", "BLITZERS", "DRIPPIN", "MCND", "TRENDZ", "POW", "DXMON", "BAE173", "GHOST9",
    "The KingDom"
]

SOLO = [
    "JENNIE", "ROSÉ", "JISOO", "LISA", "RM", "JIN", "SUGA", "j-hope", "JIMIN", "V", "JUNG KOOK", "G-DRAGON", "TAEYANG",
    "DAE SUNG", "TAEYEON", "HYO", "IU", "BIBI", "CHUNG HA", "SUNMI", "HWASA", "SOLAR", "MOONBYUL", "WHEEIN", "BAEKHYUN",
    "KAI", "D.O.", "SUHO", "CHEN", "XIUMIN", "CHANYEOL", "TAEMIN", "KEY", "ONEW", "MINHO", "WENDY", "SEULGI", "IRENE",
    "JOY", "NAYEON", "JIHYO", "MISAMO", "TAEYONG", "TEN", "MARK", "DOYOUNG", "ZICO"
]

QUERY_OVERRIDE = {
    "RM": "RM BTS",
    "JIN": "Jin BTS",
    "SUGA": "Suga BTS",
    "JIMIN": "Jimin BTS",
    "V": "V BTS",
    "JUNG KOOK": "Jungkook",
    "KEY": "Key SHINee",
    "MINHO": "Minho SHINee",
    "JOY": "Joy Red Velvet",
    "MARK": "Mark NCT",
    "TEN": "Ten NCT",
    "WENDY": "Wendy Red Velvet",
    "IRENE": "Irene Red Velvet",
    "SEULGI": "Seulgi Red Velvet",
    "TAEYEON": "Taeyeon Girls' Generation",
    "HYO": "Hyoyeon",
    "KAI": "Kai EXO",
    "SUHO": "Suho EXO",
    "CHEN": "Chen EXO",
    "XIUMIN": "Xiumin EXO",
    "CHANYEOL": "Chanyeol EXO",
    "ONEW": "Onew SHINee",
    "DAE SUNG": "Daesung BigBang",
    "G-DRAGON": "G-Dragon",
    "MISAMO": "MISAMO Twice",
    "D.O.": "D.O. EXO",
    "j-hope": "j-hope BTS",
    "CHUNG HA": "Chungha",
    "The KingDom": "The KingDom k-pop",
    "ifeye": "ifeye k-pop",
    "AtHeart": "AtHeart k-pop group",
    "KiiiKiii": "KiiiKiii kpop",
    "Hearts2Hearts": "Hearts2Hearts k-pop",
    "RESCENE": "RESCENE k-pop",
    "KickFlip": "KickFlip k-pop",
}

GOOD_DESC = [
    "south korean", "k-pop", "kpop", "boy band", "girl group", "music group", "singer", "rapper", "musician", "idol"
]
BAD_DESC = ["song", "single", "album", "ep", "television", "film", "character", "episode", "award"]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": "CodexSocialCollector/1.0"})
    return session


def search_entity(session: requests.Session, query: str) -> List[dict]:
    url = "https://www.wikidata.org/w/api.php"
    params = {
        "action": "wbsearchentities",
        "search": query,
        "language": "en",
        "format": "json",
        "limit": 10,
    }
    r = session.get(url, params=params, timeout=5)
    r.raise_for_status()
    return r.json().get("search", [])


def score_candidate(target_name: str, query: str, item: dict) -> float:
    label = item.get("label") or ""
    desc = (item.get("description") or "").lower()

    label_n = norm(label)
    target_n = norm(target_name)
    query_n = norm(query)

    score = 0.0
    if label_n == target_n:
        score += 4.0
    if label_n and target_n and (label_n in target_n or target_n in label_n):
        score += 2.0
    if label_n and query_n and label_n in query_n:
        score += 1.2

    for k in GOOD_DESC:
        if k in desc:
            score += 0.8
    for k in BAD_DESC:
        if k in desc:
            score -= 1.3

    return score


def pick_best(target_name: str, query: str, candidates: List[dict]) -> Optional[dict]:
    if not candidates:
        return None
    scored = sorted(((score_candidate(target_name, query, c), c) for c in candidates), key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    return best if best_score >= 1.8 else None


def get_entity(session: requests.Session, entity_id: str) -> dict:
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json"
    r = session.get(url, timeout=5)
    r.raise_for_status()
    return r.json().get("entities", {}).get(entity_id, {})


def claim_values(entity: dict, prop: str) -> List[str]:
    out = []
    for cl in entity.get("claims", {}).get(prop, []):
        try:
            v = cl["mainsnak"]["datavalue"]["value"]
            if isinstance(v, str) and v:
                out.append(v)
        except Exception:
            pass
    return out


def pick_primary_username(usernames: List[str]) -> Optional[str]:
    if not usernames:
        return None
    uniq = list(dict.fromkeys(usernames))

    def score(u: str) -> Tuple[int, int, int]:
        ul = u.lower()
        jp = 1 if ("jp" in ul or "japan" in ul or ul.endswith("_jp")) else 0
        official = 0 if ("official" in ul or "offcl" in ul) else 1
        return (jp, official, len(u))

    return sorted(uniq, key=score)[0]


def process_artist(name: str, tier: str) -> dict:
    session = make_session()
    query = QUERY_OVERRIDE.get(name, name)
    row = {
        "artist": name,
        "tier": tier,
        "query": query,
        "wikidata_id": None,
        "wikidata_label": None,
        "wikidata_description": None,
        "x_username": None,
        "x_url": None,
        "x_usernames_all": [],
        "instagram_username": None,
        "instagram_url": None,
        "instagram_usernames_all": [],
        "status": None,
        "source": None,
    }

    try:
        candidates = search_entity(session, query)
        best = pick_best(name, query, candidates)
        if not best:
            row["status"] = "not_found"
            return row

        entity_id = best.get("id")
        entity = get_entity(session, entity_id)

        x_all = claim_values(entity, "P2002")
        ig_all = claim_values(entity, "P2003")
        x_primary = pick_primary_username(x_all)
        ig_primary = pick_primary_username(ig_all)

        row.update(
            {
                "wikidata_id": entity_id,
                "wikidata_label": best.get("label"),
                "wikidata_description": best.get("description"),
                "x_username": x_primary,
                "x_url": f"https://x.com/{x_primary}" if x_primary else None,
                "x_usernames_all": x_all,
                "instagram_username": ig_primary,
                "instagram_url": f"https://www.instagram.com/{ig_primary}/" if ig_primary else None,
                "instagram_usernames_all": ig_all,
                "source": f"https://www.wikidata.org/wiki/{entity_id}",
            }
        )

        if x_primary and ig_primary:
            row["status"] = "ok_both"
        elif x_primary:
            row["status"] = "ok_x_only"
        elif ig_primary:
            row["status"] = "ok_ig_only"
        else:
            row["status"] = "no_social"
    except Exception as e:
        row["status"] = f"error:{type(e).__name__}"

    return row


def write_outputs(rows: List[dict]) -> None:
    with open("artist_socials_2026-03-04.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    with open("artist_socials_2026-03-04.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "artist", "tier", "query", "wikidata_id", "wikidata_label", "wikidata_description",
                "x_username", "x_url", "x_usernames_all", "instagram_username", "instagram_url",
                "instagram_usernames_all", "status", "source",
            ],
        )
        w.writeheader()
        for r in rows:
            rr = dict(r)
            rr["x_usernames_all"] = ";".join(rr.get("x_usernames_all", []))
            rr["instagram_usernames_all"] = ";".join(rr.get("instagram_usernames_all", []))
            w.writerow(rr)


def main() -> None:
    artists: List[Tuple[str, str]] = []
    artists += [(n, "core") for n in CORE]
    artists += [(n, "longtail") for n in LONGTAIL]
    artists += [(n, "solo") for n in SOLO]

    deduped = []
    seen = set()
    for name, tier in artists:
        k = name.lower()
        if k in seen:
            continue
        seen.add(k)
        deduped.append((name, tier))

    rows: List[dict] = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = {ex.submit(process_artist, name, tier): (name, tier) for name, tier in deduped}
        done = 0
        total = len(deduped)
        for fut in as_completed(futures):
            rows.append(fut.result())
            done += 1
            if done % 15 == 0 or done == total:
                print(f"processed {done}/{total}")

    rows.sort(key=lambda r: (r["tier"], r["artist"].lower()))
    write_outputs(rows)

    c = Counter(r["status"] for r in rows)
    print(json.dumps({
        "total": len(rows),
        "status_counts": c,
        "json": "artist_socials_2026-03-04.json",
        "csv": "artist_socials_2026-03-04.csv",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
