from __future__ import annotations

import re
from datetime import date
from typing import Any, Dict, Iterable, List, Optional


RELEASE_KIND_TO_STREAM = {
    "single": "song",
    "album": "album",
    "ep": "album",
}

STREAM_PRIORITY = {
    "album": 0,
    "song": 1,
}


def optional_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def parse_exact_date(value: Any) -> Optional[date]:
    text = optional_text(value)
    if len(text) != 10:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def infer_stream(candidate: Dict[str, Any]) -> str:
    stream = optional_text(candidate.get("stream")).lower()
    if stream in STREAM_PRIORITY:
        return stream

    release_kind = optional_text(candidate.get("release_kind")).lower()
    return RELEASE_KIND_TO_STREAM.get(release_kind, "album")


def normalize_release_title(value: Any) -> str:
    return re.sub(r"\s+", " ", optional_text(value)).casefold()


def normalize_release_candidate(candidate: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    title = optional_text(candidate.get("title"))
    release_date = optional_text(candidate.get("date"))
    parsed_date = parse_exact_date(release_date)
    if not title or parsed_date is None:
        return None

    normalized = dict(candidate)
    normalized["title"] = title
    normalized["date"] = release_date
    normalized["stream"] = infer_stream(candidate)
    return normalized


def merge_release_candidates(*candidate_groups: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen = set()

    for candidate_group in candidate_groups:
        for candidate in candidate_group:
            normalized = normalize_release_candidate(candidate)
            if normalized is None:
                continue

            dedupe_key = (
                normalized["stream"],
                normalize_release_title(normalized["title"]),
                normalized["date"],
            )
            if dedupe_key in seen:
                continue

            seen.add(dedupe_key)
            merged.append(normalized)

    return merged


def latest_release_sort_key(candidate: Dict[str, Any]) -> tuple[int, int, str]:
    parsed_date = parse_exact_date(candidate.get("date"))
    if parsed_date is None:
        return (date.min.toordinal(), STREAM_PRIORITY["song"], "")

    return (
        -parsed_date.toordinal(),
        STREAM_PRIORITY.get(infer_stream(candidate), STREAM_PRIORITY["song"]),
        normalize_release_title(candidate.get("title")),
    )


def sort_release_candidates(candidates: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = merge_release_candidates(candidates)
    return sorted(normalized, key=latest_release_sort_key)


def select_latest_release(
    candidates: Iterable[Dict[str, Any]],
    *,
    stream: Optional[str] = None,
    reference_date: Optional[date] = None,
) -> Optional[Dict[str, Any]]:
    eligible: List[Dict[str, Any]] = []
    for candidate in merge_release_candidates(candidates):
        parsed_date = parse_exact_date(candidate["date"])
        if parsed_date is None:
            continue
        if reference_date and parsed_date > reference_date:
            continue
        if stream and infer_stream(candidate) != stream:
            continue
        eligible.append(candidate)

    if not eligible:
        return None

    return sorted(eligible, key=latest_release_sort_key)[0]


def has_recent_release(candidates: Iterable[Dict[str, Any]], *, cutoff: date) -> bool:
    for candidate in merge_release_candidates(candidates):
        parsed_date = parse_exact_date(candidate["date"])
        if parsed_date and parsed_date > cutoff:
            return True
    return False
