import csv
import json
from datetime import date
from pathlib import Path

from latest_verified_release_selection import select_latest_release


ROOT = Path(__file__).resolve().parent
HISTORY_PATH = ROOT / "verified_release_history_mb.json"
OUTPUT_JSON_PATH = ROOT / "group_latest_release_since_2025-06-01_mb.json"
OUTPUT_CSV_PATH = ROOT / "group_latest_release_since_2025-06-01_mb.csv"
WEB_OUTPUT_PATH = ROOT / "web/src/data/releases.json"
CUTOFF = date(2025, 6, 1)


def load_history_rows():
    return json.loads(HISTORY_PATH.read_text(encoding="utf-8"))


def serialize_release(release: dict | None) -> dict | None:
    if not release:
        return None
    return {
        "title": release["title"],
        "date": release["date"],
        "source": release["source"],
        "release_kind": release["release_kind"],
        "release_format": release["release_format"],
        "context_tags": release.get("context_tags") or [],
    }


def is_after_cutoff(release: dict | None) -> bool:
    if not release:
        return False
    return date.fromisoformat(release["date"]) > CUTOFF


def build_rows():
    rows = []
    for history_row in load_history_rows():
        releases = history_row.get("releases") or []
        latest_song = select_latest_release(releases, stream="song")
        latest_album = select_latest_release(releases, stream="album")

        latest_song = latest_song if is_after_cutoff(latest_song) else None
        latest_album = latest_album if is_after_cutoff(latest_album) else None
        if latest_song is None and latest_album is None:
            continue

        rows.append(
            {
                "group": history_row["group"],
                "artist_name_mb": history_row["artist_name_mb"],
                "artist_mbid": history_row["artist_mbid"],
                "latest_song": serialize_release(latest_song),
                "latest_album": serialize_release(latest_album),
                "artist_source": history_row["artist_source"],
            }
        )

    rows.sort(key=lambda row: row["group"].casefold())
    return rows


def write_outputs(rows):
    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    OUTPUT_JSON_PATH.write_text(payload, encoding="utf-8")
    WEB_OUTPUT_PATH.write_text(payload, encoding="utf-8")

    with OUTPUT_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "group",
                "artist_name_mb",
                "artist_mbid",
                "latest_song_title",
                "latest_song_date",
                "latest_song_source",
                "latest_song_kind",
                "latest_song_format",
                "latest_song_context_tags",
                "latest_album_title",
                "latest_album_date",
                "latest_album_source",
                "latest_album_kind",
                "latest_album_format",
                "latest_album_context_tags",
                "artist_source",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "group": row["group"],
                    "artist_name_mb": row["artist_name_mb"],
                    "artist_mbid": row["artist_mbid"],
                    "latest_song_title": row["latest_song"]["title"] if row["latest_song"] else "",
                    "latest_song_date": row["latest_song"]["date"] if row["latest_song"] else "",
                    "latest_song_source": row["latest_song"]["source"] if row["latest_song"] else "",
                    "latest_song_kind": row["latest_song"]["release_kind"] if row["latest_song"] else "",
                    "latest_song_format": row["latest_song"]["release_format"] if row["latest_song"] else "",
                    "latest_song_context_tags": " ; ".join(row["latest_song"]["context_tags"]) if row["latest_song"] else "",
                    "latest_album_title": row["latest_album"]["title"] if row["latest_album"] else "",
                    "latest_album_date": row["latest_album"]["date"] if row["latest_album"] else "",
                    "latest_album_source": row["latest_album"]["source"] if row["latest_album"] else "",
                    "latest_album_kind": row["latest_album"]["release_kind"] if row["latest_album"] else "",
                    "latest_album_format": row["latest_album"]["release_format"] if row["latest_album"] else "",
                    "latest_album_context_tags": " ; ".join(row["latest_album"]["context_tags"]) if row["latest_album"] else "",
                    "artist_source": row["artist_source"],
                }
            )


def main():
    rows = build_rows()
    write_outputs(rows)
    print(
        json.dumps(
            {
                "groups_with_recent_release_data": len(rows),
                "output_json": OUTPUT_JSON_PATH.name,
                "web_output_json": str(WEB_OUTPUT_PATH.relative_to(ROOT)),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
