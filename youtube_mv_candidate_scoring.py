#!/usr/bin/env python3

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import youtube_channel_allowlists


ROOT = Path(__file__).resolve().parent
FIXTURE_PATH = ROOT / "youtube_mv_candidate_scoring_fixtures.json"

AUTO_ACCEPT_SCORE = 80
AUTO_ACCEPT_MARGIN = 12
REVIEW_SCORE = 55
MIN_VALID_SCORE = 25

HARD_REJECT_PATTERNS = {
    "fancam": re.compile(r"\bfancam\b", re.IGNORECASE),
    "dance_practice": re.compile(r"\bdance practice\b", re.IGNORECASE),
    "teaser": re.compile(r"\bteaser\b", re.IGNORECASE),
    "highlight_medley": re.compile(r"\bhighlight medley\b", re.IGNORECASE),
    "shorts": re.compile(r"\bshorts?\b", re.IGNORECASE),
    "special_clip": re.compile(r"\bspecial clip\b", re.IGNORECASE),
    "reaction": re.compile(r"\breaction\b", re.IGNORECASE),
    "visualizer": re.compile(r"\bvisualizer\b", re.IGNORECASE),
    "behind": re.compile(r"\bbehind\b|\bbehind the scenes\b", re.IGNORECASE),
    "concept_film": re.compile(r"\bconcept film\b", re.IGNORECASE),
    "medley": re.compile(r"\bmedley\b", re.IGNORECASE),
    "making_film": re.compile(r"\bmaking film\b|\bmv making\b|\bmaking of\b", re.IGNORECASE),
    "shoot_sketch": re.compile(r"\bshoot sketch\b|\bmv shoot sketch\b|\bsketch\b", re.IGNORECASE),
    "shooting": re.compile(r"\bshooting\b|\bmv shooting\b", re.IGNORECASE),
    "episode": re.compile(r"\bepisode\b", re.IGNORECASE),
    "coming_soon": re.compile(r"\bcoming soon\b", re.IGNORECASE),
    "self_cam": re.compile(r"\bself-?cam\b", re.IGNORECASE),
    "special_video": re.compile(r"\bspecial video\b", re.IGNORECASE),
    "mv_bts": re.compile(r"\b(?:m\/v|mv)\s+bts\b", re.IGNORECASE),
}

SOFT_NEGATIVE_PATTERNS = {
    "performance": re.compile(r"\bperformance\b|\bperformance video\b", re.IGNORECASE),
    "stage": re.compile(r"\bstage\b", re.IGNORECASE),
    "lyric_video": re.compile(r"\blyric\b|\blyrics\b", re.IGNORECASE),
    "audio": re.compile(r"\baudio\b|\bofficial audio\b", re.IGNORECASE),
    "live_clip": re.compile(r"\blive clip\b|\blive video\b", re.IGNORECASE),
    "track_video": re.compile(r"\btrack video\b", re.IGNORECASE),
}

STRONG_MV_MARKERS = {
    "official_mv": re.compile(r"\bofficial mv\b|\bofficial m\/v\b|\bofficial music video\b", re.IGNORECASE),
}

MV_MARKERS = {
    "mv": re.compile(r"\bm\/v\b|\bmv\b", re.IGNORECASE),
    "music_video": re.compile(r"\bmusic video\b", re.IGNORECASE),
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value.casefold())
    cleaned = re.sub(r"[^a-z0-9가-힣]+", " ", normalized)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_datetime(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    for parser in (datetime.fromisoformat,):
        try:
            return parser(normalized)
        except ValueError:
            continue
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def build_reference_titles(release_title: str, title_tracks: list[str]) -> list[str]:
    values = [release_title, *title_tracks]
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = normalize_text(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(value)
    return deduped


def get_candidate_channel_match_keys(candidate: dict[str, Any]) -> list[str]:
    explicit = candidate.get("channel_match_keys") or []
    if explicit:
        return [str(value).casefold() for value in explicit if value]
    return youtube_channel_allowlists.extract_youtube_channel_match_keys(candidate.get("channel_url", ""))


def add_signal(signals: list[dict[str, Any]], signal: str, weight: int, detail: str) -> int:
    signals.append({"signal": signal, "weight": weight, "detail": detail})
    return weight


def score_candidate(candidate: dict[str, Any], context: dict[str, Any], max_view_count: int, second_view_count: int) -> dict[str, Any]:
    candidate_title = candidate.get("title", "")
    normalized_title = normalize_text(candidate_title)
    release_group = context.get("group", "")
    release_group_normalized = normalize_text(release_group)
    reference_titles = build_reference_titles(context.get("release_title", ""), context.get("title_tracks", []))
    matched_reference_titles = [
        title
        for title in reference_titles
        if normalize_text(title) and normalize_text(title) in normalized_title
    ]

    signals: list[dict[str, Any]] = []
    total_score = 0
    hard_negative_markers: list[str] = []
    soft_negative_markers: list[str] = []
    positive_title_markers: list[str] = []

    candidate_channel_keys = set(get_candidate_channel_match_keys(candidate))
    allowlist_match_keys = {str(value).casefold() for value in context.get("mv_allowlist_match_keys", []) if value}
    allowlist_match = bool(candidate_channel_keys & allowlist_match_keys)
    if allowlist_match:
        total_score += add_signal(signals, "allowlist_match", 60, "Candidate channel is in the official MV allowlist.")

    if matched_reference_titles:
        weight = 30 if len(matched_reference_titles) > 1 else 24
        total_score += add_signal(
            signals,
            "title_match",
            weight,
            f"Candidate title matches release metadata: {', '.join(matched_reference_titles)}.",
        )

    if release_group_normalized and release_group_normalized in normalized_title:
        total_score += add_signal(signals, "group_match", 10, "Candidate title mentions the tracked group name.")

    strong_marker_hits = [name for name, pattern in STRONG_MV_MARKERS.items() if pattern.search(candidate_title)]
    if strong_marker_hits:
        positive_title_markers.extend(strong_marker_hits)
        total_score += add_signal(signals, "official_mv_marker", 24, "Candidate title contains a strong official MV marker.")
    else:
        marker_hits = [name for name, pattern in MV_MARKERS.items() if pattern.search(candidate_title)]
        if marker_hits:
            positive_title_markers.extend(marker_hits)
            total_score += add_signal(signals, "mv_marker", 12, "Candidate title contains an MV marker.")

    release_datetime = parse_datetime(context.get("release_date"))
    published_datetime = parse_datetime(candidate.get("published_at"))
    if release_datetime and published_datetime:
        delta_days = abs((published_datetime.date() - release_datetime.date()).days)
        if delta_days <= 3:
            total_score += add_signal(signals, "release_window", 16, "Upload date is within three days of the release date.")
        elif delta_days <= 14:
            total_score += add_signal(signals, "release_window", 8, "Upload date is within two weeks of the release date.")
        elif delta_days > 45:
            total_score += add_signal(signals, "late_upload_penalty", -8, "Upload date is far from the release window.")

    view_count = int(candidate.get("view_count") or 0)
    if max_view_count > 0:
        if view_count == max_view_count:
            if second_view_count and view_count >= int(second_view_count * 1.8):
                total_score += add_signal(signals, "view_advantage", 10, "Candidate has a clear view-count advantage among valid candidates.")
            else:
                total_score += add_signal(signals, "view_advantage", 6, "Candidate leads the current view-count ranking.")
        elif view_count >= max_view_count * 0.5:
            total_score += add_signal(signals, "view_support", 3, "Candidate remains competitive on view count.")
        elif max_view_count and view_count <= max_view_count * 0.15:
            total_score += add_signal(signals, "view_penalty", -3, "Candidate trails well behind the current view leader.")

    for marker, pattern in HARD_REJECT_PATTERNS.items():
        if pattern.search(candidate_title):
            hard_negative_markers.append(marker)
            total_score += add_signal(signals, "hard_negative", -90, f"Candidate title contains hard exclusion marker: {marker}.")

    for marker, pattern in SOFT_NEGATIVE_PATTERNS.items():
        if pattern.search(candidate_title):
            soft_negative_markers.append(marker)
            total_score += add_signal(signals, "soft_negative", -28, f"Candidate title contains negative marker: {marker}.")

    return {
        **candidate,
        "score": total_score,
        "allowlist_match": allowlist_match,
        "matched_reference_titles": matched_reference_titles,
        "positive_title_markers": positive_title_markers,
        "hard_negative_markers": hard_negative_markers,
        "soft_negative_markers": soft_negative_markers,
        "signals": signals,
        "decision": "pending",
    }


def score_candidates(context: dict[str, Any], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    ordered_by_views = sorted((int(candidate.get("view_count") or 0) for candidate in candidates), reverse=True)
    max_view_count = ordered_by_views[0] if ordered_by_views else 0
    second_view_count = ordered_by_views[1] if len(ordered_by_views) > 1 else 0

    scored = [score_candidate(candidate, context, max_view_count, second_view_count) for candidate in candidates]
    ranked = sorted(scored, key=lambda candidate: (candidate["score"], int(candidate.get("view_count") or 0)), reverse=True)

    valid = [
        candidate
        for candidate in ranked
        if not candidate["hard_negative_markers"] and candidate["score"] >= MIN_VALID_SCORE
    ]

    status = "no_match"
    accepted_video_id = None
    if valid:
        top_candidate = valid[0]
        runner_up = valid[1] if len(valid) > 1 else None
        margin = top_candidate["score"] - (runner_up["score"] if runner_up else 0)
        has_title_match = bool(top_candidate["matched_reference_titles"])
        has_mv_marker = bool(top_candidate["positive_title_markers"])
        has_soft_negative = bool(top_candidate["soft_negative_markers"])

        if (
            top_candidate["allowlist_match"]
            and top_candidate["score"] >= AUTO_ACCEPT_SCORE
            and margin >= AUTO_ACCEPT_MARGIN
            and has_title_match
            and has_mv_marker
            and not has_soft_negative
        ):
            status = "accepted"
            accepted_video_id = top_candidate.get("video_id")
        elif has_title_match and top_candidate["score"] >= REVIEW_SCORE:
            status = "needs_review"

    for index, candidate in enumerate(ranked):
        if candidate["hard_negative_markers"] or candidate["score"] < MIN_VALID_SCORE:
            candidate["decision"] = "rejected"
            continue

        if status == "accepted" and candidate.get("video_id") == accepted_video_id:
            candidate["decision"] = "accepted"
            continue

        if status == "needs_review" and index == 0:
            candidate["decision"] = "review"
            continue

        if status == "accepted" and ranked[0]["score"] - candidate["score"] <= AUTO_ACCEPT_MARGIN:
            candidate["decision"] = "review"
            continue

        candidate["decision"] = "rejected"

    return {
        "status": status,
        "accepted_video_id": accepted_video_id,
        "candidates": ranked,
    }


def load_fixture_cases(path: Path = FIXTURE_PATH) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    results = []
    for case in load_fixture_cases():
        outcome = score_candidates(case["release"], case["candidates"])
        results.append(
            {
                "case_id": case["case_id"],
                "status": outcome["status"],
                "accepted_video_id": outcome["accepted_video_id"],
                "top_candidate": outcome["candidates"][0]["video_id"] if outcome["candidates"] else None,
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
