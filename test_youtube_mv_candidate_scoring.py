from __future__ import annotations

import unittest

import youtube_mv_candidate_scoring as scoring


class YouTubeMvCandidateScoringTests(unittest.TestCase):
    def test_fixture_cases_match_expected_outcomes(self) -> None:
        for case in scoring.load_fixture_cases():
            with self.subTest(case_id=case["case_id"]):
                outcome = scoring.score_candidates(case["release"], case["candidates"])
                expected = case["expected"]
                self.assertEqual(outcome["status"], expected["status"])
                self.assertEqual(outcome["accepted_video_id"], expected["accepted_video_id"])

    def test_hard_exclusion_rejects_shorts_even_on_allowlisted_channel(self) -> None:
        case = {
            "group": "Example Group",
            "release_title": "Example",
            "title_tracks": ["Example"],
            "release_date": "2026-03-01",
            "mv_allowlist_match_keys": ["@exampleofficial"],
        }
        outcome = scoring.score_candidates(
            case,
            [
                {
                    "video_id": "shorts-only",
                    "title": "Example Group - Example Shorts",
                    "channel_url": "https://www.youtube.com/@ExampleOfficial",
                    "published_at": "2026-03-01T09:00:00Z",
                    "view_count": 5000000,
                }
            ],
        )
        self.assertEqual(outcome["status"], "no_match")
        self.assertEqual(outcome["candidates"][0]["decision"], "rejected")


if __name__ == "__main__":
    unittest.main()
