import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal


ROOT = Path(__file__).resolve().parent

ReleaseFormat = Literal["album", "ep", "single"]
ContextTag = Literal[
    "pre_release",
    "title_track",
    "ost",
    "collab",
    "japanese_release",
    "special_project",
]

TAG_ORDER: tuple[ContextTag, ...] = (
    "pre_release",
    "title_track",
    "ost",
    "collab",
    "japanese_release",
    "special_project",
)
VALID_TAGS = set(TAG_ORDER)
MINI_ALBUM_PATTERN = re.compile(r"\b(mini[- ]album|extended play|\bep\b)\b", re.IGNORECASE)
ALBUM_PATTERN = re.compile(
    r"\b(full(?:[- ]length)? album|studio album|\d+(?:st|nd|rd|th)\s+album|\balbum\b)\b",
    re.IGNORECASE,
)
SINGLE_PATTERN = re.compile(
    r"\b(digital single|single|title track|pre[- ]release(?: track| single)?|lead single|track)\b",
    re.IGNORECASE,
)
PRE_RELEASE_PATTERN = re.compile(r"\b(pre[- ]release|pre release)\b", re.IGNORECASE)
TITLE_TRACK_PATTERN = re.compile(r"\btitle track\b", re.IGNORECASE)
OST_PATTERN = re.compile(r"\bost\b|original soundtrack|soundtrack", re.IGNORECASE)
COLLAB_PATTERN = re.compile(r"\bcollab(?:oration)?\b|\bfeat\.?\b|\bfeaturing\b", re.IGNORECASE)
JAPANESE_PATTERN = re.compile(r"\bjapanese\b|\bjapan\b|[ぁ-んァ-ヴー]", re.IGNORECASE)
SPECIAL_PROJECT_PATTERN = re.compile(
    r"\b(project|special single|special album|anniversary|tribute|season song|special track)\b",
    re.IGNORECASE,
)


def _dedupe_tags(tags: list[str]) -> list[ContextTag]:
    normalized = [tag for tag in tags if tag in VALID_TAGS]
    return [tag for tag in TAG_ORDER if tag in normalized]


@lru_cache(maxsize=1)
def _load_seed_data():
    seed_path = ROOT / "release_classification_seeds.json"
    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    release_seeds = {
        (row["group"], row["title"], row["date"]): row for row in payload.get("release_seeds", [])
    }
    upcoming_seeds = payload.get("upcoming_seeds", [])
    return release_seeds, upcoming_seeds


def infer_release_format(text: str, fallback: ReleaseFormat | str = "") -> ReleaseFormat | str:
    haystack = text or ""
    if MINI_ALBUM_PATTERN.search(haystack):
        return "ep"
    if ALBUM_PATTERN.search(haystack):
        return "album"
    if SINGLE_PATTERN.search(haystack):
        return "single"
    return fallback


def infer_context_tags(text: str) -> list[ContextTag]:
    tags: list[str] = []
    if PRE_RELEASE_PATTERN.search(text):
        tags.append("pre_release")
    if TITLE_TRACK_PATTERN.search(text):
        tags.append("title_track")
    if OST_PATTERN.search(text):
        tags.append("ost")
    if COLLAB_PATTERN.search(text):
        tags.append("collab")
    if JAPANESE_PATTERN.search(text):
        tags.append("japanese_release")
    if SPECIAL_PROJECT_PATTERN.search(text):
        tags.append("special_project")
    return _dedupe_tags(tags)


def classify_release(
    group: str,
    title: str,
    date: str,
    release_kind: ReleaseFormat,
):
    release_seeds, _ = _load_seed_data()
    seed = release_seeds.get((group, title, date), {})
    release_format = seed.get("release_format") or infer_release_format(title, release_kind) or release_kind
    context_tags = _dedupe_tags(infer_context_tags(title) + seed.get("context_tags", []))
    return {
        "release_format": release_format,
        "context_tags": context_tags,
    }


def classify_upcoming_candidate(
    group: str,
    headline: str,
    evidence_summary: str = "",
):
    _, upcoming_seeds = _load_seed_data()
    haystack = " ".join(part for part in [headline, evidence_summary] if part).strip()
    release_format = infer_release_format(haystack, "")
    context_tags = infer_context_tags(haystack)

    for seed in upcoming_seeds:
        if seed["group"] != group:
            continue
        headline_contains = seed.get("headline_contains", "")
        if headline_contains and headline_contains.lower() not in headline.lower():
            continue
        release_format = seed.get("release_format", release_format)
        context_tags = _dedupe_tags(context_tags + seed.get("context_tags", []))

    return {
        "release_format": release_format,
        "context_tags": context_tags,
    }
