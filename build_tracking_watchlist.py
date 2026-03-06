import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


SEARCH_QUERY_OVERRIDE = {
    "(G)I-DLE": ['"i-dle" kpop comeback'],
    "&TEAM": ['"&TEAM" kpop comeback'],
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
    "ifeye": ['"ifeye" kpop comeback'],
    "izna": ['"izna" kpop comeback'],
    "woo!ah!": ['"woo!ah!" comeback'],
    "xikers": ['"xikers" comeback'],
}


def load_json(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def default_search_terms(group: str):
    terms = SEARCH_QUERY_OVERRIDE.get(group)
    if terms:
        return terms
    return [f'"{group}" kpop comeback']


def newest_release(row: dict):
    releases = [release for release in [row.get("latest_song"), row.get("latest_album")] if release]
    if not releases:
        return None
    return sorted(releases, key=lambda release: release["date"], reverse=True)[0]


def main():
    social_rows = load_json("artist_socials_structured_2026-03-04.json")
    recent_rows = load_json("group_latest_release_since_2025-06-01_mb.json")
    unresolved_rows = load_json("group_latest_release_since_2025-06-01_mb_unresolved.json")
    manual_rows = load_json("watch_targets_manual.json")

    recent_by_group = {row["group"]: row for row in recent_rows}
    unresolved_by_group = {row["group"]: row for row in unresolved_rows}

    watchlist = {}
    for row in social_rows:
        if row.get("tier") not in {"core", "longtail"}:
            continue

        group = row["artist"]
        latest_release = newest_release(recent_by_group.get(group, {}))
        status = "filtered_out"
        if group in recent_by_group:
            status = "recent_release"
        elif group in unresolved_by_group:
            status = "needs_manual_review"

        watchlist[group] = {
            "group": group,
            "tier": row["tier"],
            "tracking_status": status,
            "latest_release_title": latest_release["title"] if latest_release else "",
            "latest_release_date": latest_release["date"] if latest_release else "",
            "latest_release_kind": latest_release["release_kind"] if latest_release else "",
            "x_url": row.get("x_url", ""),
            "instagram_url": row.get("instagram_url", ""),
            "search_terms": default_search_terms(group),
        }

    for row in manual_rows:
        group = row["group"]
        current = watchlist.get(
            group,
            {
                "group": group,
                "tier": row.get("tier", "manual"),
                "tracking_status": "watch_only",
                "latest_release_title": "",
                "latest_release_date": "",
                "latest_release_kind": "",
                "x_url": "",
                "instagram_url": "",
                "search_terms": [],
            },
        )
        current["tier"] = row.get("tier", current["tier"])
        current["tracking_status"] = current.get("tracking_status") or "watch_only"
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
                "tracking_status",
                "latest_release_title",
                "latest_release_date",
                "latest_release_kind",
                "x_url",
                "instagram_url",
                "search_terms",
            ],
        )
        writer.writeheader()
        for row in rows:
            output = dict(row)
            output["search_terms"] = " ; ".join(output["search_terms"])
            writer.writerow(output)

    print(
        json.dumps(
            {
                "watch_targets": len(rows),
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
