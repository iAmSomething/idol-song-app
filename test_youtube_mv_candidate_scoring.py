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

    def test_making_film_is_rejected_even_with_mv_marker(self) -> None:
        case = {
            "group": "Xdinary Heroes",
            "release_title": "FiRE (My Sweet Misery)",
            "title_tracks": ["FiRE (My Sweet Misery)"],
            "release_date": "2025-07-07",
            "mv_allowlist_match_keys": ["@xdinaryheroes"],
        }
        outcome = scoring.score_candidates(
            case,
            [
                {
                    "video_id": "making-film",
                    "title": "Xdinary Heroes 〈FiRE (My Sweet Misery)〉 M/V Making Film",
                    "channel_url": "https://www.youtube.com/@XdinaryHeroes",
                    "published_at": "2025-07-07T09:00:00Z",
                    "view_count": 1200000,
                }
            ],
        )
        self.assertEqual(outcome["status"], "no_match")
        self.assertEqual(outcome["candidates"][0]["decision"], "rejected")

    def test_mv_bts_label_is_rejected_even_on_allowlisted_channel(self) -> None:
        case = {
            "group": "LUN8",
            "release_title": "LOST",
            "title_tracks": ["LOST"],
            "release_date": "2025-09-17",
            "mv_allowlist_match_keys": ["@lun8_official"],
        }
        outcome = scoring.score_candidates(
            case,
            [
                {
                    "video_id": "lost-mv-bts",
                    "title": "Lost M/V BTS #루네이트 #LUN8 #LOST #로스트",
                    "channel_url": "https://www.youtube.com/@LUN8_official",
                    "published_at": "2025-09-17T09:00:00Z",
                    "view_count": 1800000,
                }
            ],
        )
        self.assertEqual(outcome["status"], "no_match")
        self.assertEqual(outcome["candidates"][0]["decision"], "rejected")

    def test_episode_shooting_title_is_rejected_even_on_allowlisted_channel(self) -> None:
        case = {
            "group": "BTS",
            "release_title": "Danger",
            "title_tracks": ["Danger -Japanese ver.-"],
            "release_date": "2014-11-19",
            "mv_allowlist_match_keys": ["@bts", "@bighitmusic", "@hybelabels"],
        }
        outcome = scoring.score_candidates(
            case,
            [
                {
                    "video_id": "danger-episode",
                    "title": "[EPISODE] 방탄소년단 'Danger' MV Shooting",
                    "channel_url": "https://www.youtube.com/channel/UCLkAepWjdylmXSltofFvsYQ",
                    "published_at": "2014-11-19T09:00:00Z",
                    "view_count": 1200000,
                }
            ],
        )
        self.assertEqual(outcome["status"], "no_match")
        self.assertEqual(outcome["candidates"][0]["decision"], "rejected")


if __name__ == "__main__":
    unittest.main()
