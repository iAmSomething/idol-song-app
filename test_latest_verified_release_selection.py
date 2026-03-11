import unittest
from datetime import date

from latest_verified_release_selection import has_recent_release, select_latest_release, sort_release_candidates


class LatestVerifiedReleaseSelectionTest(unittest.TestCase):
    def test_select_latest_release_prefers_newer_date(self) -> None:
        result = select_latest_release(
            [
                {"title": "Lovestruck", "date": "2025-06-26", "release_kind": "ep"},
                {"title": "LOVECHAPTER", "date": "2026-03-05", "release_kind": "ep"},
            ],
            reference_date=date(2026, 3, 11),
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["title"], "LOVECHAPTER")
        self.assertEqual(result["date"], "2026-03-05")

    def test_select_latest_release_prefers_album_on_same_date(self) -> None:
        result = select_latest_release(
            [
                {"title": "HOT", "date": "2025-03-14", "release_kind": "single"},
                {"title": "HOT", "date": "2025-03-14", "release_kind": "ep"},
            ],
            reference_date=date(2026, 3, 11),
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["stream"], "album")

    def test_select_latest_release_prefers_title_ascending_with_same_date_and_stream(self) -> None:
        result = select_latest_release(
            [
                {"title": "SPAGHETTI", "date": "2025-10-24", "release_kind": "single"},
                {"title": "Pearlies (My oyster is the world)", "date": "2025-10-24", "release_kind": "single"},
            ],
            stream="song",
            reference_date=date(2026, 3, 11),
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["title"], "Pearlies (My oyster is the world)")

    def test_has_recent_release_uses_cutoff_exclusively(self) -> None:
        self.assertFalse(
            has_recent_release(
                [{"title": "Old", "date": "2025-06-01", "release_kind": "single"}],
                cutoff=date(2025, 6, 1),
            )
        )
        self.assertTrue(
            has_recent_release(
                [{"title": "New", "date": "2025-06-02", "release_kind": "single"}],
                cutoff=date(2025, 6, 1),
            )
        )

    def test_sort_release_candidates_matches_projection_order(self) -> None:
        rows = sort_release_candidates(
            [
                {"title": "SPAGHETTI", "date": "2025-10-24", "release_kind": "single"},
                {"title": "Pearlies (My oyster is the world)", "date": "2025-10-24", "release_kind": "single"},
                {"title": "HOT", "date": "2025-03-14", "release_kind": "ep"},
                {"title": "HOT", "date": "2025-03-14", "release_kind": "single"},
            ]
        )

        self.assertEqual(
            [(row["title"], row["stream"]) for row in rows],
            [
                ("Pearlies (My oyster is the world)", "song"),
                ("SPAGHETTI", "song"),
                ("HOT", "album"),
                ("HOT", "song"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
