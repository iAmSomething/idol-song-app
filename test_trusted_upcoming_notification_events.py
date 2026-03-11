import unittest
from datetime import datetime, timezone

import trusted_upcoming_notification_events as notification_events


class TrustedUpcomingNotificationEventsTests(unittest.TestCase):
    def make_snapshot(self, **overrides):
        base = {
            "entity_id": "entity-1",
            "entity_slug": "yena",
            "entity_name": "YENA",
            "upcoming_signal_id": "signal-1",
            "headline": "YENA announces new single",
            "scheduled_date": None,
            "scheduled_month": "2026-03",
            "date_status": "scheduled",
            "date_precision": "month_only",
            "release_format": "single",
            "confidence_score": 0.82,
            "source_type": "news_rss",
            "source_tier": 1,
            "canonical_source_url": "https://example.com/article",
            "canonical_source_domain": "example.com",
            "published_at": "2026-03-11T00:00:00Z",
            "evidence_summary": "Source summary",
            "tracking_status": "watch_only",
        }
        base.update(overrides)
        base["confidence_band"] = notification_events.confidence_band(base["confidence_score"])
        base["scheduled_bucket"] = notification_events.scheduled_bucket(base)
        base["fingerprint_key"] = notification_events.build_fingerprint_key(base)
        base["destination"] = notification_events.build_destination(base)
        base["is_trusted"] = notification_events.is_trusted_signal(base)
        return base

    def test_builds_new_signal_for_first_trusted_snapshot(self):
        snapshot = self.make_snapshot()

        candidates = notification_events.build_upgrade_candidates(None, snapshot)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["reason"], "new_signal")
        self.assertEqual(candidates[0]["reason_value"], "trusted")

    def test_suppresses_unchanged_rerun(self):
        snapshot = self.make_snapshot()
        previous_state = {
            "latest_date_status": "scheduled",
            "latest_date_precision": "month_only",
            "latest_confidence_band": "trusted",
            "latest_source_tier": 1,
            "is_active": True,
            "last_emitted_dedupe_key": "existing",
        }

        candidates = notification_events.build_upgrade_candidates(previous_state, snapshot)

        self.assertEqual(candidates, [])

    def test_prefers_status_upgrade_over_other_secondaries(self):
        previous_state = {
            "latest_date_status": "rumor",
            "latest_date_precision": "unknown",
            "latest_confidence_band": "low",
            "latest_source_tier": 1,
            "is_active": True,
            "last_emitted_dedupe_key": None,
        }
        snapshot = self.make_snapshot(date_status="confirmed", date_precision="exact", confidence_score=0.91)

        candidates = notification_events.build_upgrade_candidates(previous_state, snapshot)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["reason"], "date_status_upgrade")
        self.assertEqual(candidates[0]["reason_value"], "confirmed")
        self.assertIn("date_precision_gain:exact", candidates[0]["secondary_reasons"])
        self.assertIn("confidence_threshold_crossed:high", candidates[0]["secondary_reasons"])

    def test_emits_source_tier_upgrade_for_official_source(self):
        previous_state = {
            "latest_date_status": "scheduled",
            "latest_date_precision": "month_only",
            "latest_confidence_band": "low",
            "latest_source_tier": 1,
            "is_active": True,
            "last_emitted_dedupe_key": None,
        }
        snapshot = self.make_snapshot(source_type="official_social", source_tier=2, confidence_score=0.55)

        candidates = notification_events.build_upgrade_candidates(previous_state, snapshot)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["reason"], "source_tier_upgrade")
        self.assertEqual(candidates[0]["reason_value"], "official_social")

    def test_build_event_payload_contains_destination_and_cooldown(self):
        snapshot = self.make_snapshot()
        now = datetime(2026, 3, 11, 1, 0, tzinfo=timezone.utc)
        candidate = {"reason": "new_signal", "reason_value": "trusted", "secondary_reasons": []}

        event = notification_events.build_event_payload(snapshot, None, candidate, now)

        self.assertEqual(event["event_reason"], "new_signal")
        self.assertEqual(event["status"], "queued")
        self.assertEqual(event["canonical_destination"]["kind"], "entity_detail")
        self.assertIn("cooldown_until", event["payload"])
        self.assertTrue(event["dedupe_key"].endswith("|new_signal|trusted"))


if __name__ == "__main__":
    unittest.main()
