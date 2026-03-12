import unittest
from datetime import datetime

import same_day_release_targets as module


class SameDayReleaseTargetsTests(unittest.TestCase):
    def test_same_day_default_window_starts_at_noon_kst(self):
        rows = [
            {
                "group": "P1Harmony",
                "scheduled_date": "2026-03-12",
                "date_precision": "exact",
                "date_status": "confirmed",
                "headline": "P1Harmony returns March 12",
                "source_type": "news_rss",
                "confidence": 0.82,
            }
        ]

        before_noon = module.build_same_day_target_summary(
            rows,
            datetime.fromisoformat("2026-03-12T11:30:00+09:00"),
        )
        after_noon = module.build_same_day_target_summary(
            rows,
            datetime.fromisoformat("2026-03-12T12:05:00+09:00"),
        )

        self.assertEqual(before_noon["eligible_target_count"], 0)
        self.assertEqual(before_noon["deferred_targets"][0]["window_mode"], "default_noon")
        self.assertEqual(after_noon["eligible_groups"], ["P1Harmony"])

    def test_explicit_release_time_starts_one_hour_early(self):
        rows = [
            {
                "group": "YENA",
                "scheduled_date": "2026-03-12",
                "date_precision": "exact",
                "date_status": "confirmed",
                "headline": "YENA returns at 6 PM KST on March 12",
                "source_type": "official_social",
                "confidence": 0.95,
            }
        ]

        deferred = module.build_same_day_target_summary(
            rows,
            datetime.fromisoformat("2026-03-12T16:30:00+09:00"),
        )
        eligible = module.build_same_day_target_summary(
            rows,
            datetime.fromisoformat("2026-03-12T17:05:00+09:00"),
        )

        self.assertEqual(deferred["eligible_target_count"], 0)
        self.assertEqual(deferred["deferred_targets"][0]["window_mode"], "explicit_english_time")
        self.assertEqual(eligible["eligible_groups"], ["YENA"])
        self.assertEqual(eligible["eligible_targets"][0]["window_start_kst"], "2026-03-12T17:00:00+09:00")

    def test_korean_explicit_time_is_parsed_from_evidence_summary(self):
        rows = [
            {
                "group": "P1Harmony",
                "scheduled_date": "2026-03-12",
                "date_precision": "exact",
                "date_status": "confirmed",
                "headline": "P1Harmony 3월 12일 컴백",
                "evidence_summary": "3월 12일 오후 6시 발매 확정",
                "source_type": "agency_notice",
                "confidence": 0.93,
            }
        ]

        summary = module.build_same_day_target_summary(
            rows,
            datetime.fromisoformat("2026-03-12T17:10:00+09:00"),
        )

        self.assertEqual(summary["eligible_groups"], ["P1Harmony"])
        self.assertEqual(summary["eligible_targets"][0]["release_time_source_field"], "evidence_summary")
        self.assertEqual(summary["eligible_targets"][0]["release_time_kst"], "2026-03-12T18:00:00+09:00")

    def test_representative_target_prefers_official_source(self):
        rows = [
            {
                "group": "P1Harmony",
                "scheduled_date": "2026-03-12",
                "date_precision": "exact",
                "date_status": "confirmed",
                "headline": "news headline",
                "source_type": "news_rss",
                "confidence": 0.99,
            },
            {
                "group": "P1Harmony",
                "scheduled_date": "2026-03-12",
                "date_precision": "exact",
                "date_status": "confirmed",
                "headline": "official headline",
                "source_type": "official_social",
                "confidence": 0.80,
            },
        ]

        selected = module.choose_representative_same_day_targets(rows, datetime(2026, 3, 12).date())

        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["headline"], "official headline")


if __name__ == "__main__":
    unittest.main()
