import csv
import json
from datetime import date
from pathlib import Path

from latest_verified_release_selection import has_recent_release as has_recent_release_after_cutoff
from latest_verified_release_selection import merge_release_candidates, select_latest_release


ROOT = Path(__file__).resolve().parent
RECENT_RELEASE_CUTOFF = date(2025, 6, 1)


SEARCH_QUERY_OVERRIDE = {
    "(G)I-DLE": ['"i-dle" kpop comeback'],
    "&TEAM": ['"&TEAM" kpop comeback'],
    "ALLDAY PROJECT": ['"ALLDAY PROJECT" kpop comeback', '"ALLDAY_PROJECT" comeback'],
    "AtHeart": ['"AtHeart" kpop comeback'],
    "Hearts2Hearts": ['"Hearts2Hearts" kpop comeback'],
    "KiiiKiii": ['"KiiiKiii" kpop comeback'],
    "QWER": ['"QWER" kpop band comeback'],
    "RESCENE": ['"RESCENE" kpop comeback'],
    "SAY MY NAME": ['"SAY MY NAME" kpop comeback'],
    "The KingDom": ['"The KingDom" kpop comeback', '"KINGDOM" kpop comeback'],
    "TOMORROW X TOGETHER": ['"TOMORROW X TOGETHER" comeback', '"TXT" comeback kpop'],
    "UNIS": ['"UNIS" kpop comeback'],
    "WJSN": ['"WJSN" kpop comeback', '"Cosmic Girls" comeback'],
    "Weeekly": ['"Weeekly" comeback'],
    "ifeye": ['"ifeye" kpop comeback'],
    "izna": ['"izna" kpop comeback'],
    "woo!ah!": ['"woo!ah!" comeback'],
    "xikers": ['"xikers" comeback'],
    "XLOV": ['"XLOV" kpop comeback', '"엑스러브" 컴백', '"xluv" comeback kpop'],
}

LONG_GAP_DAYS = 365


def load_json(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def default_search_terms(group: str):
    terms = SEARCH_QUERY_OVERRIDE.get(group)
    if terms:
        return terms
    return [f'"{group}" kpop comeback']


def release_candidates_from_rollup(row: dict):
    if not row:
        return []

    return [release for release in [row.get("latest_song"), row.get("latest_album")] if release]


def release_candidates_from_history(row: dict):
    if not row:
        return []
    return row.get("releases") or []


def parse_release_date(value: str | None):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def is_long_gap(value: str | None, reference_date: date):
    release_date = parse_release_date(value)
    if release_date is None:
        return False
    return (reference_date - release_date).days >= LONG_GAP_DAYS


def manual_release(row: dict):
    if not row:
        return None

    release_date = row.get("latest_release_date", "")
    if not release_date:
        return None

    return {
        "title": row.get("latest_release_title", ""),
        "date": release_date,
        "release_kind": row.get("latest_release_kind", ""),
    }


def resolve_watch_reason(
    latest_release: dict | None,
    has_recent_release: bool,
    manual_row: dict | None,
    reference_date: date,
):
    if has_recent_release:
        return "recent_release"

    manual_reason = (manual_row or {}).get("watch_reason")
    if latest_release and is_long_gap(latest_release.get("date"), reference_date):
        return "long_gap"

    if manual_reason in {"manual_watch", "long_gap"}:
        return "manual_watch"

    return ""


def resolve_tracking_status(
    group: str,
    has_recent_release: bool,
    watch_reason: str,
    manual_row: dict | None,
    unresolved_by_group: dict[str, dict],
):
    if has_recent_release:
        return "recent_release"
    if group in unresolved_by_group:
        return "needs_manual_review"
    if manual_row and manual_row.get("tracking_status") and watch_reason:
        return manual_row["tracking_status"]
    if watch_reason in {"long_gap", "manual_watch"}:
        return "watch_only"
    return "filtered_out"


def main():
    social_rows = load_json("artist_socials_structured_2026-03-04.json")
    recent_rows = load_json("group_latest_release_since_2025-06-01_mb.json")
    release_history_rows = load_json("verified_release_history_mb.json")
    unresolved_rows = load_json("group_latest_release_since_2025-06-01_mb_unresolved.json")
    manual_rows = load_json("watch_targets_manual.json")

    recent_by_group = {row["group"]: row for row in recent_rows}
    history_by_group = {row["group"]: row for row in release_history_rows}
    unresolved_by_group = {row["group"]: row for row in unresolved_rows}
    manual_by_group = {row["group"]: row for row in manual_rows}
    reference_date = date.today()

    watchlist = {}
    for row in social_rows:
        if row.get("tier") not in {"core", "longtail"}:
            continue

        group = row["artist"]
        manual_row = manual_by_group.get(group)
        release_candidates = merge_release_candidates(
            release_candidates_from_history(history_by_group.get(group, {})),
            release_candidates_from_rollup(recent_by_group.get(group, {})),
        )
        latest_release = select_latest_release(release_candidates, reference_date=reference_date) or manual_release(manual_row or {})
        has_recent_release = has_recent_release_after_cutoff(release_candidates, cutoff=RECENT_RELEASE_CUTOFF)
        watch_reason = resolve_watch_reason(
            latest_release=latest_release,
            has_recent_release=has_recent_release,
            manual_row=manual_row,
            reference_date=reference_date,
        )
        status = resolve_tracking_status(
            group=group,
            has_recent_release=has_recent_release,
            watch_reason=watch_reason,
            manual_row=manual_row,
            unresolved_by_group=unresolved_by_group,
        )

        watchlist[group] = {
            "group": group,
            "tier": row["tier"],
            "watch_reason": watch_reason,
            "tracking_status": status,
            "latest_release_title": latest_release["title"] if latest_release else "",
            "latest_release_date": latest_release["date"] if latest_release else "",
            "latest_release_kind": latest_release["release_kind"] if latest_release else "",
            "x_url": row.get("x_url", ""),
            "instagram_url": row.get("instagram_url", ""),
            "search_terms": (manual_row or {}).get("search_terms") or default_search_terms(group),
        }

    for row in manual_rows:
        group = row["group"]
        current = watchlist.get(
            group,
            {
                "group": group,
                "tier": row.get("tier", "manual"),
                "watch_reason": row.get("watch_reason", "manual_watch"),
                "tracking_status": "watch_only",
                "latest_release_title": "",
                "latest_release_date": "",
                "latest_release_kind": "",
                "x_url": "",
                "instagram_url": "",
                "search_terms": [],
            },
        )
        latest_release = manual_release(row)
        release_candidates = merge_release_candidates(
            release_candidates_from_history(history_by_group.get(group, {})),
            release_candidates_from_rollup(recent_by_group.get(group, {})),
            [latest_release] if latest_release else [],
        )
        latest_release = select_latest_release(release_candidates, reference_date=reference_date) or latest_release
        watch_reason = resolve_watch_reason(
            latest_release=latest_release,
            has_recent_release=has_recent_release_after_cutoff(release_candidates, cutoff=RECENT_RELEASE_CUTOFF),
            manual_row=row,
            reference_date=reference_date,
        )
        current["tier"] = row.get("tier", current["tier"])
        current["watch_reason"] = watch_reason
        current["tracking_status"] = resolve_tracking_status(
            group=group,
            has_recent_release=has_recent_release_after_cutoff(release_candidates, cutoff=RECENT_RELEASE_CUTOFF),
            watch_reason=watch_reason,
            manual_row=row,
            unresolved_by_group=unresolved_by_group,
        )
        if latest_release:
            current["latest_release_title"] = latest_release["title"]
            current["latest_release_date"] = latest_release["date"]
            current["latest_release_kind"] = latest_release["release_kind"]
        current["x_url"] = row.get("x_url", current["x_url"])
        current["instagram_url"] = row.get("instagram_url", current["instagram_url"])
        current["search_terms"] = row.get("search_terms", current["search_terms"]) or default_search_terms(group)
        watchlist[group] = current

    rows = sorted(watchlist.values(), key=lambda item: item["group"].lower())

    (ROOT / "tracking_watchlist.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with (ROOT / "tracking_watchlist.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "tier",
                "watch_reason",
                "tracking_status",
                "latest_release_title",
                "latest_release_date",
                "latest_release_kind",
                "x_url",
                "instagram_url",
                "search_terms",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in rows:
            output = dict(row)
            output["search_terms"] = " ; ".join(output["search_terms"])
            writer.writerow(output)

    print(
        json.dumps(
            {
                "reference_date": reference_date.isoformat(),
                "watch_targets": len(rows),
                "recent_release_reason": sum(1 for row in rows if row["watch_reason"] == "recent_release"),
                "long_gap_reason": sum(1 for row in rows if row["watch_reason"] == "long_gap"),
                "manual_watch_reason": sum(1 for row in rows if row["watch_reason"] == "manual_watch"),
                "recent_release": sum(1 for row in rows if row["tracking_status"] == "recent_release"),
                "filtered_out": sum(1 for row in rows if row["tracking_status"] == "filtered_out"),
                "needs_manual_review": sum(
                    1 for row in rows if row["tracking_status"] == "needs_manual_review"
                ),
                "watch_only": sum(1 for row in rows if row["tracking_status"] == "watch_only"),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
