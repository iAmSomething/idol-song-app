#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
UPCOMING_PATH = "web/src/data/upcomingCandidates.json"
RELEASES_PATH = "web/src/data/releases.json"
OUTPUT_PATH = ROOT / "web/src/data/releaseChangeLog.json"
VERIFIED_RELEASE_WINDOW_DAYS = 30


@dataclass(frozen=True)
class SnapshotState:
    group: str
    scheduled_date: str
    date_status: str
    headline: str
    source_type: str
    source_url: str
    published_at: str
    confidence: float


@dataclass(frozen=True)
class ReleaseState:
    title: str
    date: str
    release_kind: str
    source: str


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def load_json_at_ref(ref: str, path: str) -> Any:
    return json.loads(run_git("show", f"{ref}:{path}"))


def load_current_json(path: str) -> Any:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def get_history_refs(path: str) -> list[str]:
    refs = [line.strip() for line in run_git("log", "--format=%H", "--follow", "--", path).splitlines()]
    refs.reverse()
    return refs


def get_commit_date(ref: str) -> str:
    return run_git("show", "-s", "--format=%cI", ref).strip()


def is_exact_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def parse_datetime(value: str) -> datetime | None:
    if not value:
        return None

    if is_exact_date(value):
        return datetime.strptime(value, "%Y-%m-%d")

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        pass

    for pattern in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            return datetime.strptime(value, pattern)
        except ValueError:
            continue

    return None


def published_sort_value(value: str) -> float:
    parsed = parse_datetime(value)
    return parsed.timestamp() if parsed else -1


def source_rank(source_type: str) -> int:
    if source_type in {"agency_notice", "weverse_notice"}:
        return 0
    if source_type == "news_rss":
        return 1
    return 2


def date_status_rank(date_status: str) -> int:
    return {"confirmed": 0, "scheduled": 1, "rumor": 2}.get(date_status, 9)


def compare_state_priority(left: SnapshotState, right: SnapshotState) -> tuple[Any, ...]:
    return (
        0 if is_exact_date(left.scheduled_date) else 1,
        source_rank(left.source_type),
        date_status_rank(left.date_status),
        -(left.confidence or 0),
        -published_sort_value(left.published_at),
        left.headline,
    ) < (
        0 if is_exact_date(right.scheduled_date) else 1,
        source_rank(right.source_type),
        date_status_rank(right.date_status),
        -(right.confidence or 0),
        -published_sort_value(right.published_at),
        right.headline,
    )


def select_group_states(rows: list[dict[str, Any]]) -> dict[str, SnapshotState]:
    selected: dict[str, SnapshotState] = {}

    for row in rows:
        state = SnapshotState(
            group=row.get("group", ""),
            scheduled_date=row.get("scheduled_date", "") or "",
            date_status=row.get("date_status", "") or "",
            headline=row.get("headline", "") or "",
            source_type=row.get("source_type", "") or "",
            source_url=row.get("source_url", "") or "",
            published_at=row.get("published_at", "") or "",
            confidence=float(row.get("confidence", 0) or 0),
        )
        current = selected.get(state.group)
        if current is None or compare_state_priority(state, current):
            selected[state.group] = state

    return selected


def latest_release_states(rows: list[dict[str, Any]]) -> dict[str, ReleaseState]:
    releases: dict[str, ReleaseState] = {}

    for row in rows:
        candidates: list[dict[str, Any]] = []
        if row.get("latest_song"):
            candidates.append(row["latest_song"])
        if row.get("latest_album"):
            candidates.append(row["latest_album"])
        if not candidates:
            continue

        latest = max(candidates, key=lambda item: item.get("date", ""))
        releases[row["group"]] = ReleaseState(
            title=latest.get("title", "") or "",
            date=latest.get("date", "") or "",
            release_kind=latest.get("release_kind", "") or "",
            source=latest.get("source", "") or "",
        )

    return releases


def hash_state(value: dict[str, Any] | None) -> str:
    if value is None:
        return "none"
    serialized = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(serialized.encode("utf-8")).hexdigest()[:12]


def normalize_state(state: SnapshotState | None) -> dict[str, Any] | None:
    if state is None:
        return None
    return {
        "scheduled_date": state.scheduled_date,
        "date_status": state.date_status,
        "headline": state.headline,
        "source_type": state.source_type,
        "source_url": state.source_url,
        "published_at": state.published_at,
    }


def normalize_release(release: ReleaseState | None) -> dict[str, Any] | None:
    if release is None:
        return None
    return {
        "title": release.title,
        "date": release.date,
        "release_kind": release.release_kind,
        "source": release.source,
    }


def days_between(left: str, right: str) -> int | None:
    if not is_exact_date(left) or not is_exact_date(right):
        return None
    left_date = datetime.strptime(left, "%Y-%m-%d")
    right_date = datetime.strptime(right, "%Y-%m-%d")
    return (left_date - right_date).days


def get_source_url(change_type: str, next_state: SnapshotState | None, previous_state: SnapshotState | None, release: ReleaseState | None) -> str:
    if change_type == "verified_release_detected" and release:
        return release.source
    if next_state and next_state.source_url:
        return next_state.source_url
    if previous_state and previous_state.source_url:
        return previous_state.source_url
    return ""


def get_source_domain(source_url: str) -> str:
    if not source_url:
        return ""
    return urlparse(source_url).netloc


def get_change_occurred_at(change_type: str, next_state: SnapshotState | None, release: ReleaseState | None, next_commit_date: str) -> str:
    if change_type == "verified_release_detected" and release and release.date:
        return release.date
    if next_state and next_state.published_at:
        return next_state.published_at
    if next_state and next_state.scheduled_date:
        return next_state.scheduled_date
    return next_commit_date


def build_summary(change_type: str, previous_state: SnapshotState | None, next_state: SnapshotState | None, release: ReleaseState | None) -> str:
    if change_type == "scheduled_date_added" and next_state:
        return f"Scheduled date was filled in as {next_state.scheduled_date}."
    if change_type == "scheduled_date_changed" and previous_state and next_state:
        return f"Scheduled date moved from {previous_state.scheduled_date} to {next_state.scheduled_date}."
    if change_type == "date_status_changed" and previous_state and next_state:
        return f"Signal status changed from {previous_state.date_status} to {next_state.date_status}."
    if change_type == "headline_changed" and previous_state and next_state:
        return f'Primary tracked headline changed from "{previous_state.headline}" to "{next_state.headline}".'
    if change_type == "verified_release_detected" and release:
        return f'Verified release "{release.title}" landed on {release.date}.'
    return ""


def build_event(
    *,
    group: str,
    change_type: str,
    previous_state: SnapshotState | None,
    next_state: SnapshotState | None,
    next_release: ReleaseState | None,
    next_commit_date: str,
    previous_ref: str,
    next_ref: str,
) -> dict[str, Any]:
    previous_payload = normalize_state(previous_state)
    next_payload = normalize_state(next_state)
    previous_hash = hash_state(previous_payload)
    next_hash = hash_state(next_payload or normalize_release(next_release))
    diff_key = f"{group}:{previous_hash}:{next_hash}"
    source_url = get_source_url(change_type, next_state, previous_state, next_release)

    return {
        "key": f"{diff_key}:{change_type}",
        "diff_key": diff_key,
        "group": group,
        "change_type": change_type,
        "occurred_at": get_change_occurred_at(change_type, next_state, next_release, next_commit_date),
        "summary": build_summary(change_type, previous_state, next_state, next_release),
        "source_url": source_url,
        "source_domain": get_source_domain(source_url),
        "previous_state_hash": previous_hash,
        "next_state_hash": next_hash,
        "previous": previous_payload,
        "next": next_payload,
        "verified_release": normalize_release(next_release) if change_type == "verified_release_detected" else None,
        "snapshot": {
            "previous_ref": shorten_ref(previous_ref),
            "next_ref": shorten_ref(next_ref),
        },
    }


def shorten_ref(ref: str) -> str:
    if ref == "WORKTREE":
        return "worktree"
    return ref.lower() if len(ref) <= 7 else ref[:7].lower()


def compare_snapshots(
    previous_ref: str,
    next_ref: str,
    previous_states: dict[str, SnapshotState],
    next_states: dict[str, SnapshotState],
    previous_releases: dict[str, ReleaseState],
    next_releases: dict[str, ReleaseState],
    next_commit_date: str,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    all_groups = sorted(set(previous_states) | set(next_states))

    for group in all_groups:
        previous_state = previous_states.get(group)
        next_state = next_states.get(group)
        previous_release = previous_releases.get(group)
        next_release = next_releases.get(group)

        if previous_state and next_state:
            if not previous_state.scheduled_date and is_exact_date(next_state.scheduled_date):
                events.append(
                    build_event(
                        group=group,
                        change_type="scheduled_date_added",
                        previous_state=previous_state,
                        next_state=next_state,
                        next_release=None,
                        next_commit_date=next_commit_date,
                        previous_ref=previous_ref,
                        next_ref=next_ref,
                    )
                )

            if (
                is_exact_date(previous_state.scheduled_date)
                and is_exact_date(next_state.scheduled_date)
                and previous_state.scheduled_date != next_state.scheduled_date
            ):
                events.append(
                    build_event(
                        group=group,
                        change_type="scheduled_date_changed",
                        previous_state=previous_state,
                        next_state=next_state,
                        next_release=None,
                        next_commit_date=next_commit_date,
                        previous_ref=previous_ref,
                        next_ref=next_ref,
                    )
                )

            if (
                previous_state.date_status
                and next_state.date_status
                and previous_state.date_status != next_state.date_status
            ):
                events.append(
                    build_event(
                        group=group,
                        change_type="date_status_changed",
                        previous_state=previous_state,
                        next_state=next_state,
                        next_release=None,
                        next_commit_date=next_commit_date,
                        previous_ref=previous_ref,
                        next_ref=next_ref,
                    )
                )

            if previous_state.headline and next_state.headline and previous_state.headline != next_state.headline:
                events.append(
                    build_event(
                        group=group,
                        change_type="headline_changed",
                        previous_state=previous_state,
                        next_state=next_state,
                        next_release=None,
                        next_commit_date=next_commit_date,
                        previous_ref=previous_ref,
                        next_ref=next_ref,
                    )
                )

        if previous_state and next_release:
            release_changed = previous_release != next_release
            release_near_scheduled = False
            if is_exact_date(previous_state.scheduled_date) and is_exact_date(next_release.date):
                difference = days_between(next_release.date, previous_state.scheduled_date)
                release_near_scheduled = difference is not None and abs(difference) <= VERIFIED_RELEASE_WINDOW_DAYS

            if release_changed and release_near_scheduled:
                events.append(
                    build_event(
                        group=group,
                        change_type="verified_release_detected",
                        previous_state=previous_state,
                        next_state=next_state,
                        next_release=next_release,
                        next_commit_date=next_commit_date,
                        previous_ref=previous_ref,
                        next_ref=next_ref,
                    )
                )

    return events


def occurred_sort_value(value: str) -> tuple[int, str]:
    parsed = parse_datetime(value)
    if parsed is None:
        return (0, value)
    return (1, parsed.isoformat())


def main() -> None:
    refs = get_history_refs(UPCOMING_PATH)
    if not refs:
        raise SystemExit("Need at least one snapshot revision to build release change log.")

    snapshots: list[dict[str, Any]] = []
    for ref in refs:
        states = select_group_states(load_json_at_ref(ref, UPCOMING_PATH))
        if not states:
            continue
        snapshots.append(
            {
                "ref": ref,
                "commit_date": get_commit_date(ref),
                "states": states,
                "releases": latest_release_states(load_json_at_ref(ref, RELEASES_PATH)),
            }
        )

    head_ref = refs[-1]
    current_upcoming = load_current_json(UPCOMING_PATH)
    current_releases = load_current_json(RELEASES_PATH)
    head_upcoming = load_json_at_ref(head_ref, UPCOMING_PATH)
    head_releases = load_json_at_ref(head_ref, RELEASES_PATH)

    if current_upcoming != head_upcoming or current_releases != head_releases:
        snapshots.append(
            {
                "ref": "WORKTREE",
                "commit_date": datetime.now().astimezone().isoformat(),
                "states": select_group_states(current_upcoming),
                "releases": latest_release_states(current_releases),
            }
        )

    if len(snapshots) < 2:
        raise SystemExit("Need at least two snapshot revisions to build release change log.")

    events: list[dict[str, Any]] = []
    for previous_snapshot, next_snapshot in zip(snapshots, snapshots[1:]):
        events.extend(
            compare_snapshots(
                previous_ref=previous_snapshot["ref"],
                next_ref=next_snapshot["ref"],
                previous_states=previous_snapshot["states"],
                next_states=next_snapshot["states"],
                previous_releases=previous_snapshot["releases"],
                next_releases=next_snapshot["releases"],
                next_commit_date=next_snapshot["commit_date"],
            )
        )

    deduped = {event["key"]: event for event in events}
    ordered = sorted(
        deduped.values(),
        key=lambda item: (occurred_sort_value(item["occurred_at"]), item["group"], item["change_type"]),
        reverse=True,
    )

    OUTPUT_PATH.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(ordered)} change events to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
