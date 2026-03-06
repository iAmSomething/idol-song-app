import argparse
import csv
import html
import json
import re
import time
import urllib.parse
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from xml.etree import ElementTree

import requests


ROOT = Path(__file__).resolve().parent
KST = ZoneInfo("Asia/Seoul")
TODAY = datetime.now(KST).replace(hour=0, minute=0, second=0, microsecond=0)

DATE_ISO_PATTERN = re.compile(r"\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b")
MONTH_DAY_PATTERN = re.compile(
    r"\b("
    r"january|february|march|april|may|june|july|august|september|october|november|december"
    r")\s+(\d{1,2})(?:,\s*(20\d{2}))?\b",
    re.IGNORECASE,
)

KEYWORDS = (
    "comeback",
    "returns",
    "returning",
    "new single",
    "new album",
    "mini album",
    "ep",
    "release",
    "drops",
    "teaser",
    "schedule",
)

HIGH_SIGNAL_WORDS = ("confirms", "announces", "sets", "reveals", "shares", "drops")
OFFICIAL_DOMAINS = (
    "weverse.io",
    "ygfamily.com",
    "smentertainment.com",
    "jype.com",
    "starship-ent.com",
)


def strip_markup(text: str) -> str:
    text = html.unescape(text or "")
    return re.sub(r"<[^>]+>", " ", text).strip()


def load_watchlist():
    return json.loads((ROOT / "tracking_watchlist.json").read_text(encoding="utf-8"))


def build_query(term: str) -> str:
    return f"{term} ({' OR '.join(KEYWORDS)})"


def fetch_rss(session: requests.Session, query: str) -> bytes:
    url = "https://news.google.com/rss/search"
    params = {
        "q": query,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }
    response = session.get(url, params=params, timeout=20)
    response.raise_for_status()
    return response.content


def parse_items(xml_bytes: bytes):
    root = ElementTree.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        return []
    return channel.findall("item")


def parse_date_candidate(text: str):
    text = strip_markup(text)

    match = DATE_ISO_PATTERN.search(text)
    if match:
        year, month, day = map(int, match.groups())
        return datetime(year, month, day)

    match = MONTH_DAY_PATTERN.search(text)
    if match:
        month_name, day, year = match.groups()
        parsed_year = int(year) if year else TODAY.year
        month = datetime.strptime(month_name.title(), "%B").month
        candidate = datetime(parsed_year, month, int(day))
        if not year and candidate < TODAY.replace(hour=0, minute=0, second=0, microsecond=0):
            # Ignore vague past mentions without a year.
            return None
        return candidate

    return None


def domain_for(link: str):
    parsed = urllib.parse.urlparse(link)
    return parsed.netloc.lower()


def score_item(title: str, description: str, link: str):
    haystack = f"{title} {description}".lower()
    score = 0.45
    if any(word in haystack for word in HIGH_SIGNAL_WORDS):
        score += 0.2
    if any(keyword in haystack for keyword in KEYWORDS):
        score += 0.15
    if domain_for(link) in OFFICIAL_DOMAINS:
        score += 0.2
    return round(min(score, 0.95), 2)


def find_candidates_for_group(session: requests.Session, group_row: dict):
    group = group_row["group"]
    candidates = []

    for term in group_row["search_terms"]:
        query = build_query(term)
        xml_bytes = fetch_rss(session, query)
        for item in parse_items(xml_bytes):
            title = strip_markup(item.findtext("title", default=""))
            link = strip_markup(item.findtext("link", default=""))
            description = strip_markup(item.findtext("description", default=""))
            pub_date = strip_markup(item.findtext("pubDate", default=""))

            if not title or group.lower() not in f"{title} {description}".lower():
                continue

            combined = f"{title}. {description}"
            scheduled_at = parse_date_candidate(combined)
            if scheduled_at is None or scheduled_at <= TODAY:
                continue

            candidates.append(
                {
                    "group": group,
                    "scheduled_date": scheduled_at.strftime("%Y-%m-%d"),
                    "headline": title,
                    "source_url": link,
                    "source_domain": domain_for(link),
                    "published_at": pub_date,
                    "confidence": score_item(title, description, link),
                    "tracking_status": group_row["tracking_status"],
                    "search_term": term,
                }
            )
        time.sleep(0.35)

    deduped = {}
    for candidate in candidates:
        key = (candidate["group"], candidate["scheduled_date"])
        current = deduped.get(key)
        if current is None or candidate["confidence"] > current["confidence"]:
            deduped[key] = candidate

    return sorted(
        deduped.values(),
        key=lambda item: (item["scheduled_date"], -item["confidence"], item["group"].lower()),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="limit number of groups to scan")
    parser.add_argument("--group", type=str, default="", help="scan a single group name")
    args = parser.parse_args()

    watchlist = load_watchlist()
    if args.group:
        watchlist = [row for row in watchlist if row["group"].lower() == args.group.lower()]
    if args.limit > 0:
        watchlist = watchlist[: args.limit]

    session = requests.Session()
    session.headers.update({"User-Agent": "CodexKpopScanner/1.0"})

    results = []
    for index, group_row in enumerate(watchlist, start=1):
        try:
            results.extend(find_candidates_for_group(session, group_row))
        except Exception as error:
            results.append(
                {
                    "group": group_row["group"],
                    "scheduled_date": "",
                    "headline": f"scan_failed: {type(error).__name__}",
                    "source_url": "",
                    "source_domain": "",
                    "published_at": "",
                    "confidence": 0.0,
                    "tracking_status": group_row["tracking_status"],
                    "search_term": group_row["search_terms"][0],
                }
            )

        if index % 15 == 0 or index == len(watchlist):
            print(f"scanned {index}/{len(watchlist)}")

    valid_results = [row for row in results if row["scheduled_date"]]
    valid_results.sort(key=lambda item: (item["scheduled_date"], -item["confidence"], item["group"].lower()))

    (ROOT / "upcoming_release_candidates.json").write_text(
        json.dumps(valid_results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with (ROOT / "upcoming_release_candidates.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "scheduled_date",
                "headline",
                "source_url",
                "source_domain",
                "published_at",
                "confidence",
                "tracking_status",
                "search_term",
            ],
        )
        writer.writeheader()
        writer.writerows(valid_results)

    print(
        json.dumps(
            {
                "groups_scanned": len(watchlist),
                "candidates_found": len(valid_results),
                "output_json": "upcoming_release_candidates.json",
                "output_csv": "upcoming_release_candidates.csv",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
