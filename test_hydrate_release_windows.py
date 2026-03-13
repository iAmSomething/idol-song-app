import unittest
from datetime import date

import hydrate_release_windows as module


def make_target(**overrides):
    target = {
        "group": "Example Group",
        "scheduled_date": "2026-03-12",
        "date_precision": "exact",
        "source_type": "official_social",
        "source_url": "https://www.instagram.com/p/example",
        "date_status": "confirmed",
        "confidence": 0.91,
        "headline": "Example Group returns with 'Signal'",
        "evidence_summary": "",
        "release_format": "single",
        "context_tags": [],
        "phase": "d_day",
    }
    target.update(overrides)
    return target


def make_preflight(**overrides):
    row = {
        "scheduled_date": "2026-03-12",
        "phase": "d_day",
        "candidate_releases": [],
    }
    row.update(overrides)
    return row


class HydrateReleaseWindowsTests(unittest.TestCase):
    def test_representative_target_prefers_official_social_over_news(self):
        rows = [
            make_target(source_type="news_rss", source_url="https://news.google.com/example", headline="news"),
            make_target(source_type="official_social", source_url="https://www.instagram.com/p/example", headline="official"),
        ]

        selected = module.choose_representative_targets(rows)

        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["headline"], "official")

    def test_promotes_from_official_social_evidence(self):
        candidate = module.build_provisional_release_candidate(
            [make_target()],
            [make_preflight()],
            date(2026, 3, 12),
        )

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["promotion_evidence_kind"], "official_social")
        self.assertEqual(candidate["detail_provenance"], "trusted_upcoming_signal.same_day_official_social")
        self.assertEqual(candidate["title"], "Signal")

    def test_promotes_from_official_youtube_evidence(self):
        candidate = module.build_provisional_release_candidate(
            [
                make_target(
                    source_url="https://www.youtube.com/watch?v=abc123",
                    headline="Example Group drops 'Signal' official MV",
                )
            ],
            [make_preflight()],
            date(2026, 3, 12),
        )

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["promotion_evidence_kind"], "official_youtube")
        self.assertEqual(candidate["detail_provenance"], "trusted_upcoming_signal.same_day_official_youtube")

    def test_promotes_from_trusted_catalog_even_if_source_type_is_news(self):
        candidate = module.build_provisional_release_candidate(
            [
                make_target(
                    source_type="news_rss",
                    source_url="https://open.spotify.com/album/example",
                    headline="Example Group 'Signal' now on Spotify",
                )
            ],
            [make_preflight()],
            date(2026, 3, 12),
        )

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["promotion_evidence_kind"], "trusted_catalog")
        self.assertEqual(candidate["detail_provenance"], "trusted_upcoming_signal.same_day_trusted_catalog")

    def test_does_not_promote_generic_news_rss_evidence(self):
        candidate = module.build_provisional_release_candidate(
            [
                make_target(
                    source_type="news_rss",
                    source_url="https://news.google.com/example",
                    headline="Example Group to return with 'Signal'",
                )
            ],
            [make_preflight()],
            date(2026, 3, 12),
        )

        self.assertIsNone(candidate)


if __name__ == "__main__":
    unittest.main()
