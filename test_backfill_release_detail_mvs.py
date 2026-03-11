from __future__ import annotations

import unittest

import backfill_release_detail_mvs as backfill


class BackfillReleaseDetailMvQueryTests(unittest.TestCase):
    def test_build_queries_prefers_primary_name_then_korean_alias_then_release_title(self) -> None:
        detail = {
            "group": "IVE",
            "release_title": "REVIVE+",
            "tracks": [
                {"title": "BLACKHOLE", "is_title_track": True},
                {"title": "BANG BANG", "is_title_track": True},
            ],
        }
        profile = {
            "display_name": "IVE",
            "aliases": [],
            "search_aliases": ["아이브", "ive"],
        }

        self.assertEqual(
            backfill.build_queries(detail, profile),
            [
                "IVE BLACKHOLE official mv",
                "IVE BLACKHOLE mv",
                "아이브 BLACKHOLE official mv",
                "아이브 BLACKHOLE mv",
                "IVE REVIVE+ official mv",
                "IVE REVIVE+ mv",
            ],
        )

    def test_build_queries_uses_romanized_alias_after_korean_alias(self) -> None:
        detail = {
            "group": "(G)I-DLE",
            "release_title": "Mono",
            "tracks": [
                {"title": "Mono", "is_title_track": True},
            ],
        }
        profile = {
            "display_name": "(G)I-DLE",
            "aliases": ["i-dle"],
            "search_aliases": ["아이들", "여자아이들"],
        }

        self.assertEqual(
            backfill.build_queries(detail, profile),
            [
                "(G)I-DLE Mono official mv",
                "(G)I-DLE Mono mv",
                "아이들 Mono official mv",
                "아이들 Mono mv",
                "i-dle Mono official mv",
                "i-dle Mono mv",
            ],
        )

    def test_infer_title_track_from_candidate_title_matches_unique_track(self) -> None:
        detail = {
            "group": "YENA",
            "tracks": [
                {"title": "Before Anyone Else"},
                {"title": "SMILEY (feat. BIBI)"},
            ],
        }

        self.assertEqual(
            backfill.infer_title_tracks_from_candidate_title(
                detail,
                "YENA - SMILEY (feat. BIBI) Official MV",
            ),
            ["SMILEY (feat. BIBI)"],
        )

    def test_merge_override_rows_persists_inferred_title_tracks(self) -> None:
        merged = backfill.merge_override_rows(
            [
                {
                    "group": "YENA",
                    "release_title": "SMiLEY",
                    "release_date": "2022-01-17",
                    "stream": "album",
                }
            ],
            [
                {
                    "group": "YENA",
                    "release_title": "SMiLEY",
                    "release_date": "2022-01-17",
                    "stream": "album",
                    "youtube_video_id": "abc123",
                    "youtube_video_url": "https://www.youtube.com/watch?v=abc123",
                    "youtube_video_provenance": "test",
                    "inferred_title_tracks": ["SMILEY (feat. BIBI)"],
                }
            ],
        )

        self.assertEqual(merged[0]["title_tracks"], ["SMILEY (feat. BIBI)"])

    def test_merge_override_rows_clears_stale_auto_accepted_mv_when_reevaluated(self) -> None:
        key = "bts::danger::2014-11-19::song"
        merged = backfill.merge_override_rows(
            [
                {
                    "group": "BTS",
                    "release_title": "Danger",
                    "release_date": "2014-11-19",
                    "stream": "song",
                    "youtube_video_id": "old123",
                    "youtube_video_url": "https://www.youtube.com/watch?v=old123",
                    "youtube_video_provenance": backfill.AUTO_ACCEPTED_YOUTUBE_PROVENANCE,
                }
            ],
            [],
            {key},
        )

        self.assertNotIn("youtube_video_id", merged[0])
        self.assertNotIn("youtube_video_url", merged[0])
        self.assertNotIn("youtube_video_provenance", merged[0])


if __name__ == "__main__":
    unittest.main()
