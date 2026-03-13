from __future__ import annotations

import argparse
import io
import unittest
from datetime import date, datetime
from urllib.error import URLError
from unittest.mock import patch

import backfill_release_detail_mvs as backfill


class BackfillReleaseDetailMvQueryTests(unittest.TestCase):
    def test_parse_positive_int_arg_accepts_positive_values(self) -> None:
        self.assertEqual(backfill.parse_positive_int_arg("4"), 4)

    def test_parse_positive_int_arg_rejects_zero(self) -> None:
        with self.assertRaises(argparse.ArgumentTypeError):
            backfill.parse_positive_int_arg("0")

    def test_parse_non_negative_int_arg_accepts_zero(self) -> None:
        self.assertEqual(backfill.parse_non_negative_int_arg("0"), 0)

    def test_parse_non_negative_int_arg_rejects_negative_values(self) -> None:
        with self.assertRaises(argparse.ArgumentTypeError):
            backfill.parse_non_negative_int_arg("-1")

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
                "IVE BLACKHOLE official music video",
                "IVE BLACKHOLE mv",
                "IVE BLACKHOLE",
                "아이브 BLACKHOLE official mv",
                "아이브 BLACKHOLE official music video",
                "아이브 BLACKHOLE mv",
                "아이브 BLACKHOLE",
                "IVE BANG BANG official mv",
                "IVE BANG BANG official music video",
                "IVE BANG BANG mv",
                "IVE BANG BANG",
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
                "(G)I-DLE Mono official music video",
                "(G)I-DLE Mono mv",
                "(G)I-DLE Mono",
                "아이들 Mono official mv",
                "아이들 Mono official music video",
                "아이들 Mono mv",
                "아이들 Mono",
                "i-dle Mono official mv",
                "i-dle Mono official music video",
                "i-dle Mono mv",
                "i-dle Mono",
            ],
        )

    def test_build_queries_keeps_release_title_as_primary_fallback_after_two_title_tracks(self) -> None:
        detail = {
            "group": "ZEROBASEONE",
            "release_title": "NEVER SAY NEVER",
            "tracks": [
                {"title": "SLAM DUNK", "is_title_track": True},
                {"title": "BLUE", "is_title_track": True},
            ],
        }

        self.assertEqual(
            backfill.pick_title_variants(detail),
            ["SLAM DUNK", "BLUE", "NEVER SAY NEVER"],
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

    def test_build_candidate_channel_url_uses_short_byline_text(self) -> None:
        video = {
            "shortBylineText": {
                "runs": [
                    {
                        "text": "H1-KEY",
                        "navigationEndpoint": {
                            "browseEndpoint": {
                                "canonicalBaseUrl": "/@H1KEY_official",
                            }
                        },
                    }
                ]
            }
        }

        self.assertEqual(
            backfill.build_candidate_channel_url(video),
            "https://www.youtube.com/@H1KEY_official",
        )

    def test_infer_release_cohort_uses_one_year_and_three_year_windows(self) -> None:
        reference_date = date(2026, 3, 12)

        self.assertEqual(backfill.infer_release_cohort("2025-12-01", reference_date), "latest")
        self.assertEqual(backfill.infer_release_cohort("2024-04-01", reference_date), "recent")
        self.assertEqual(backfill.infer_release_cohort("2021-03-10", reference_date), "historical")

    @patch.object(backfill.urllib.request, "urlopen", side_effect=URLError("boom"))
    def test_fetch_query_candidates_returns_empty_when_request_fails(self, _: object) -> None:
        self.assertEqual(
            backfill.fetch_query_candidates("YENA LOVE CATCHER official mv", datetime(2026, 3, 12)),
            [],
        )

    @patch.object(backfill, "REQUEST_DELAY_SECONDS", 0)
    def test_choose_resolutions_uses_track_search_for_unresolved_album_rows(self) -> None:
        details = [
            {
                "group": "YENA",
                "release_title": "LOVE CATCHER",
                "release_date": "2026-03-11",
                "stream": "album",
                "release_kind": "ep",
                "youtube_video_status": "unresolved",
                "tracks": [
                    {"title": "캐치 캐치"},
                    {"title": "봄이라서"},
                ],
            }
        ]
        profiles_by_group = {"YENA": {"display_name": "YENA", "aliases": [], "search_aliases": ["최예나"]}}
        allowlists_by_group = {
            "YENA": {
                "mv_allowlist_match_keys": ["channel:uckrdegnm3mqzxhk2mfnojmw"],
                "mv_source_channels": [
                    {
                        "channel_url": "https://www.youtube.com/channel/UCkrDEGNM3mqZXHk2MfnOjMw",
                        "owner_type": "team",
                    }
                ],
            }
        }

        def fake_fetch_query_candidates(query: str, reference: object) -> list[dict[str, object]]:
            if "캐치 캐치" not in query:
                return []
            return [
                {
                    "video_id": "abc123",
                    "title": "YENA(최예나) - '캐치 캐치' M/V",
                    "channel_url": "https://www.youtube.com/channel/UCkrDEGNM3mqZXHk2MfnOjMw",
                    "view_count": 1000,
                    "published_at": "2026-03-11T09:00:00Z",
                    "query": query,
                }
            ]

        with patch.object(backfill, "fetch_query_candidates", side_effect=fake_fetch_query_candidates):
            resolutions, review_rows = backfill.choose_resolutions(details, profiles_by_group, allowlists_by_group)

        self.assertEqual(len(review_rows), 0)
        self.assertEqual(len(resolutions), 1)
        self.assertEqual(resolutions[0]["youtube_video_id"], "abc123")
        self.assertEqual(resolutions[0]["inferred_title_tracks"], ["캐치 캐치"])
        self.assertEqual(resolutions[0]["title_track_basis"], "track_search")

    @patch.object(backfill, "REQUEST_DELAY_SECONDS", 0)
    def test_choose_resolutions_emits_progress_to_stderr_without_changing_resolution(self) -> None:
        details = [
            {
                "group": "YENA",
                "release_title": "LOVE CATCHER",
                "release_date": "2026-03-11",
                "stream": "album",
                "release_kind": "ep",
                "youtube_video_status": "unresolved",
                "tracks": [
                    {"title": "캐치 캐치"},
                ],
            }
        ]
        profiles_by_group = {"YENA": {"display_name": "YENA", "aliases": [], "search_aliases": ["최예나"]}}
        allowlists_by_group = {
            "YENA": {
                "mv_allowlist_match_keys": ["channel:uckrdegnm3mqzxhk2mfnojmw"],
                "mv_source_channels": [
                    {
                        "channel_url": "https://www.youtube.com/channel/UCkrDEGNM3mqZXHk2MfnOjMw",
                        "owner_type": "team",
                    }
                ],
            }
        }

        def fake_fetch_query_candidates(query: str, reference: object) -> list[dict[str, object]]:
            return [
                {
                    "video_id": "abc123",
                    "title": "YENA(최예나) - '캐치 캐치' M/V",
                    "channel_url": "https://www.youtube.com/channel/UCkrDEGNM3mqZXHk2MfnOjMw",
                    "view_count": 1000,
                    "published_at": "2026-03-11T09:00:00Z",
                    "query": query,
                }
            ]

        stderr_buffer = io.StringIO()
        with patch.object(backfill, "fetch_query_candidates", side_effect=fake_fetch_query_candidates):
            with patch("sys.stderr", stderr_buffer):
                resolutions, review_rows = backfill.choose_resolutions(
                    details,
                    profiles_by_group,
                    allowlists_by_group,
                    progress_every=1,
                )

        self.assertEqual(len(review_rows), 0)
        self.assertEqual(len(resolutions), 1)
        self.assertIn("[backfill_release_detail_mvs] 1/1 YENA / LOVE CATCHER", stderr_buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
