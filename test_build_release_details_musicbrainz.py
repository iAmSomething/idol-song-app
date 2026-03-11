from __future__ import annotations

import unittest
from datetime import date

import build_release_details_musicbrainz as builder


class BuildReleaseDetailsMusicBrainzTitleTrackTests(unittest.TestCase):
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
