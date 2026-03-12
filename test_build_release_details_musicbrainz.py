from __future__ import annotations

import unittest
from datetime import date

import build_release_details_musicbrainz as builder


class BuildReleaseDetailsMusicBrainzTitleTrackTests(unittest.TestCase):
    def test_parse_scoped_cohorts_accepts_supported_values(self) -> None:
        self.assertEqual(
            builder.parse_scoped_cohorts("latest,recent"),
            {"latest", "recent"},
        )

    def test_parse_scoped_cohorts_rejects_unknown_values(self) -> None:
        with self.assertRaises(ValueError):
            builder.parse_scoped_cohorts("latest,foo")

    def test_matches_execution_scope_respects_cohort_filter(self) -> None:
        item = {
            "group": "YENA",
            "release_title": "LOVE CATCHER",
            "release_date": "2026-03-11",
            "stream": "album",
        }
        self.assertTrue(
            builder.matches_execution_scope(item, None, {"latest"}, date(2026, 3, 12))
        )
        self.assertFalse(
            builder.matches_execution_scope(item, None, {"recent"}, date(2026, 3, 12))
        )

    def test_mv_backfill_scope_matches_checks_cohorts_and_groups(self) -> None:
        execution_scope = {"groups": ["YENA"], "cohorts": ["latest", "recent"]}
        matching_summary = {
            "execution_scope": {"groups": ["YENA"], "cohorts": ["latest", "recent"]}
        }
        mismatched_summary = {
            "execution_scope": {"groups": ["YENA"], "cohorts": ["historical"]}
        }

        self.assertTrue(builder.mv_backfill_scope_matches(matching_summary, execution_scope))
        self.assertFalse(builder.mv_backfill_scope_matches(mismatched_summary, execution_scope))

    def test_exact_title_match_outranks_nearby_single_fallback(self) -> None:
        detail = {
            "group": "TWICE",
            "release_title": "YES or YES",
            "release_date": "2018-11-05",
            "stream": "album",
            "release_kind": "ep",
            "tracks": [
                {"title": "YES or YES"},
                {"title": "BDZ (Korean ver.)"},
            ],
        }
        song_release_index = {
            "TWICE": [
                {
                    "title": "BDZ",
                    "release_date": date(2018, 8, 17),
                    "base_title": builder.normalize_base_title("BDZ"),
                }
            ]
        }

        resolution = builder.infer_title_track_resolution(detail, song_release_index)

        self.assertEqual(resolution["status"], builder.TITLE_TRACK_STATUS_AUTO_SINGLE)
        self.assertEqual(resolution["selected_titles"], ["YES or YES"])

    def test_intro_track_is_not_selected_from_release_title_substring(self) -> None:
        detail = {
            "group": "BTS",
            "release_title": "YOUTH",
            "release_date": "2016-09-07",
            "stream": "album",
            "release_kind": "album",
            "tracks": [
                {"title": "INTRODUCTION : YOUTH"},
                {"title": "RUN (Japanese ver.)"},
            ],
        }
        song_release_index = {
            "BTS": [
                {
                    "title": "RUN",
                    "release_date": date(2016, 3, 15),
                    "base_title": builder.normalize_base_title("RUN"),
                }
            ]
        }

        resolution = builder.infer_title_track_resolution(detail, song_release_index)

        self.assertEqual(resolution["status"], builder.TITLE_TRACK_STATUS_AUTO_SINGLE)
        self.assertEqual(resolution["selected_titles"], ["RUN (Japanese ver.)"])


if __name__ == "__main__":
    unittest.main()
