import argparse
import csv
import html
import json
import re
import time
import urllib.parse
from datetime import datetime, timedelta
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
MONTH_ONLY_PATTERN = re.compile(
    r"\b(?:early|mid|late)?\s*("
    r"january|february|march|april|may|june|july|august|september|october|november|december"
    r")(?:\s+(20\d{2}))?\b",
    re.IGNORECASE,
)
WHITESPACE_PATTERN = re.compile(r"\s+")

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
RUMOR_SIGNAL_WORDS = ("reportedly", "expected", "rumor", "rumoured", "may", "might", "could")
OFFICIAL_DOMAINS = (
    "weverse.io",
    "weverse.com",
    "ygfamily.com",
    "smentertainment.com",
    "jype.com",
    "starship-ent.com",
)
GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
WEVERSE_NOTICE_SEEDS = {
    "TOMORROW X TOGETHER": ["https://weverse.io/txt/notice/34002"],
}
YG_GROUP_ALIASES = {
    "BABYMONSTER": ("BABYMONSTER",),
    "BLACKPINK": ("BLACKPINK",),
    "TREASURE": ("TREASURE",),
}
YG_REPORT_LINKS_CACHE = None


def strip_markup(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return WHITESPACE_PATTERN.sub(" ", text).strip()


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


def parse_date_candidate(text: str, fallback_year: int):
    text = strip_markup(text)

    match = DATE_ISO_PATTERN.search(text)
    if match:
        year, month, day = map(int, match.groups())
        return datetime(year, month, day, tzinfo=KST)

    match = MONTH_DAY_PATTERN.search(text)
    if match:
        month_name, day, year = match.groups()
        parsed_year = int(year) if year else fallback_year
        month = datetime.strptime(month_name.title(), "%B").month
        candidate = datetime(parsed_year, month, int(day), tzinfo=KST)
        return candidate

    return None


def parse_month_reference(text: str, fallback_year: int):
    text = strip_markup(text)
    match = MONTH_ONLY_PATTERN.search(text)
    if not match:
        return None

    month_name, year = match.groups()
    parsed_year = int(year) if year else fallback_year
    month = datetime.strptime(month_name.title(), "%B").month
    return datetime(parsed_year, month, 1, tzinfo=KST)


def parse_published_at(pub_date: str):
    if not pub_date:
        return None
    try:
        return datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z").replace(tzinfo=KST)
    except ValueError:
        return None


def domain_for(link: str):
    parsed = urllib.parse.urlparse(link)
    return parsed.netloc.lower()


def source_type_for(link: str):
    domain = domain_for(link)
    if "weverse" in domain:
        return "weverse_notice"
    if any(official_domain in domain for official_domain in OFFICIAL_DOMAINS):
        return "agency_notice"
    return "news_rss"


def summarize_evidence(title: str, description: str, scheduled_at, month_reference):
    summary_parts = []
    if scheduled_at is not None:
        summary_parts.append(f"Future date reference: {scheduled_at.strftime('%Y-%m-%d')}.")
    elif month_reference is not None:
        summary_parts.append(f"Future month reference: {month_reference.strftime('%Y-%m')}.")

    evidence_body = description or title
    evidence_body = strip_markup(evidence_body)
    if evidence_body:
        trimmed = evidence_body[:160].rstrip()
        if len(evidence_body) > 160:
            trimmed = f"{trimmed}..."
        summary_parts.append(trimmed)

    return " ".join(summary_parts).strip()


def classify_date_status(title: str, description: str, link: str, scheduled_at, month_reference):
    haystack = f"{title} {description}".lower()
    source_type = source_type_for(link)
    if scheduled_at is not None:
        if source_type != "news_rss" or any(word in haystack for word in HIGH_SIGNAL_WORDS):
            return "confirmed"
        return "scheduled"
    if month_reference is not None:
        return "scheduled"

    if any(word in haystack for word in RUMOR_SIGNAL_WORDS) or any(keyword in haystack for keyword in KEYWORDS):
        return "rumor"
    return "rumor"


def score_item(title: str, description: str, link: str, scheduled_at, month_reference):
    haystack = f"{title} {description}".lower()
    score = 0.38
    if any(word in haystack for word in HIGH_SIGNAL_WORDS):
        score += 0.18
    if any(keyword in haystack for keyword in KEYWORDS):
        score += 0.12
    if scheduled_at is not None:
        score += 0.14
    elif month_reference is not None:
        score += 0.08
    if source_type_for(link) != "news_rss":
        score += 0.2
    if any(word in haystack for word in RUMOR_SIGNAL_WORDS):
        score -= 0.06
    return round(max(0.2, min(score, 0.97)), 2)


def should_keep_candidate(candidate: dict, published_at):
    if candidate["source_type"] != "news_rss" and candidate["confidence"] >= 0.55:
        return True
    if candidate["scheduled_date"]:
        return True
    if candidate["date_status"] == "scheduled":
        return True
    if published_at is None:
        return False
    if source_type_for(candidate["source_url"]) == "news_rss" and published_at < TODAY - timedelta(days=60):
        return False
    return candidate["confidence"] >= 0.55 or candidate["source_type"] != "news_rss"


def sort_key(item: dict):
    date_key = item["scheduled_date"] or "9999-12-31"
    rumor_rank = 1 if item["date_status"] == "rumor" and not item["scheduled_date"] else 0
    return (rumor_rank, date_key, -source_priority(item["source_type"]), -item["confidence"], item["group"].lower())


def source_priority(source_type: str):
    priorities = {
        "weverse_notice": 3,
        "agency_notice": 2,
        "news_rss": 1,
    }
    return priorities.get(source_type, 0)


def fetch_html(session: requests.Session, url: str, user_agent: str = ""):
    headers = {"User-Agent": user_agent} if user_agent else None
    response = session.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    return response.text


def text_between(pattern: str, text: str):
    match = re.search(pattern, text, flags=re.I | re.S)
    if not match:
        return ""
    return strip_markup(match.group(1))


def format_pub_date(dt: datetime):
    return dt.strftime("%a, %d %b %Y 00:00:00 GMT")


def build_candidate(
    group_row: dict,
    title: str,
    description: str,
    source_url: str,
    pub_date: str,
    search_term: str,
    allow_month_reference: bool = True,
):
    published_at = parse_published_at(pub_date)
    fallback_year = published_at.year if published_at is not None else TODAY.year
    combined = f"{title}. {description}"
    scheduled_at = parse_date_candidate(combined, fallback_year)
    month_reference = parse_month_reference(combined, fallback_year) if allow_month_reference else None
    if scheduled_at is not None and scheduled_at <= TODAY:
        return None
    if month_reference is not None and (month_reference.year, month_reference.month) < (TODAY.year, TODAY.month):
        return None

    candidate = {
        "group": group_row["group"],
        "scheduled_date": scheduled_at.strftime("%Y-%m-%d") if scheduled_at is not None else "",
        "date_status": classify_date_status(title, description, source_url, scheduled_at, month_reference),
        "headline": title,
        "source_type": source_type_for(source_url),
        "source_url": source_url,
        "source_domain": domain_for(source_url),
        "published_at": pub_date,
        "confidence": score_item(title, description, source_url, scheduled_at, month_reference),
        "evidence_summary": summarize_evidence(title, description, scheduled_at, month_reference),
        "tracking_status": group_row["tracking_status"],
        "search_term": search_term,
    }
    if not should_keep_candidate(candidate, published_at):
        return None
    return candidate


def find_rss_candidates_for_group(session: requests.Session, group_row: dict):
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

            candidate = build_candidate(group_row, title, description, link, pub_date, term)
            if candidate:
                candidates.append(candidate)
        time.sleep(0.35)

    return candidates


def find_weverse_candidates_for_group(session: requests.Session, group_row: dict):
    candidates = []
    for url in WEVERSE_NOTICE_SEEDS.get(group_row["group"], []):
        html_text = fetch_html(session, url, user_agent=GOOGLEBOT_UA)
        title = text_between(r"<title>(.*?)</title>", html_text)
        description = text_between(r'<meta name="description" content="(.*?)"', html_text)
        candidate = build_candidate(group_row, title, description, url, "", "official_weverse_seed")
        if candidate:
            candidates.append(candidate)
    return candidates


def fetch_yg_report_links(session: requests.Session):
    global YG_REPORT_LINKS_CACHE
    if YG_REPORT_LINKS_CACHE is not None:
        return YG_REPORT_LINKS_CACHE

    html_text = fetch_html(session, "https://www.ygfamily.com/en/news/report")
    links = sorted(set(re.findall(r"/en/news/report/\d+", html_text)))
    YG_REPORT_LINKS_CACHE = [f"https://www.ygfamily.com{link}" for link in links]
    return YG_REPORT_LINKS_CACHE


def find_yg_agency_candidates_for_group(session: requests.Session, group_row: dict):
    aliases = YG_GROUP_ALIASES.get(group_row["group"])
    if not aliases:
        return []

    candidates = []
    for url in fetch_yg_report_links(session):
        html_text = fetch_html(session, url)
        title = text_between(r'<h2 class="f28">(.*?)</h2>', html_text)
        report_date = text_between(r'<span class="date">(.*?)</span>', html_text)
        body = text_between(r'<div class="ql-editor">(.*?)</div>', html_text)
        haystack = f"{title} {body}".lower()
        if not any(alias.lower() in haystack for alias in aliases):
            continue

        pub_date = ""
        if report_date:
            try:
                report_dt = datetime.strptime(report_date, "%Y.%m.%d").replace(tzinfo=KST)
                pub_date = format_pub_date(report_dt)
            except ValueError:
                pub_date = ""

        candidate = build_candidate(
            group_row,
            title,
            body,
            url,
            pub_date,
            "official_yg_report",
            allow_month_reference=False,
        )
        if candidate:
            candidates.append(candidate)
    return candidates


def find_candidates_for_group(session: requests.Session, group_row: dict):
    candidates = []
    candidates.extend(find_weverse_candidates_for_group(session, group_row))
    candidates.extend(find_yg_agency_candidates_for_group(session, group_row))
    candidates.extend(find_rss_candidates_for_group(session, group_row))

    deduped = {}
    for candidate in candidates:
        key = (
            candidate["group"],
            candidate["scheduled_date"] or candidate["headline"],
            candidate["source_type"],
        )
        current = deduped.get(key)
        if current is None or (source_priority(candidate["source_type"]), candidate["confidence"]) > (
            source_priority(current["source_type"]),
            current["confidence"],
        ):
            deduped[key] = candidate

    return sorted(deduped.values(), key=sort_key)


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
    session.headers.update({"User-Agent": "CodexKpopScanner/2.0"})

    results = []
    for index, group_row in enumerate(watchlist, start=1):
        try:
            results.extend(find_candidates_for_group(session, group_row))
        except Exception as error:
            print(f"scan_failed {group_row['group']}: {type(error).__name__}")

        if index % 15 == 0 or index == len(watchlist):
            print(f"scanned {index}/{len(watchlist)}")

    results.sort(key=sort_key)

    (ROOT / "upcoming_release_candidates.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with (ROOT / "upcoming_release_candidates.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "scheduled_date",
                "date_status",
                "headline",
                "source_type",
                "source_url",
                "source_domain",
                "published_at",
                "confidence",
                "evidence_summary",
                "tracking_status",
                "search_term",
            ],
        )
        writer.writeheader()
        writer.writerows(results)

    print(
        json.dumps(
            {
                "groups_scanned": len(watchlist),
                "candidates_found": len(results),
                "output_json": "upcoming_release_candidates.json",
                "output_csv": "upcoming_release_candidates.csv",
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
