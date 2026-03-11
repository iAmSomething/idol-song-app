import unittest

import deliver_trusted_push_notifications as push_delivery


class DeliverTrustedPushNotificationsTest(unittest.TestCase):
    def test_build_push_copy_uses_reason_specific_title(self) -> None:
        title, body = push_delivery.build_push_copy(
            {
                "event_reason": "date_precision_gain",
                "payload": {
                    "entity": {"name": "YENA"},
                    "headline": "최예나, 3월 11일 컴백 확정",
                    "reason": "date_precision_gain",
                    "scheduled_date": "2026-03-11",
                },
            }
        )

        self.assertEqual(title, "YENA 날짜 정보가 더 구체화됐습니다")
        self.assertIn("2026-03-11", body)

    def test_build_push_message_embeds_canonical_destination(self) -> None:
        message = push_delivery.build_push_message(
            {
                "id": "event-1",
                "event_type": "trusted_upcoming_signal",
                "event_reason": "new_signal",
                "event_reason_value": "trusted",
                "canonical_destination": {"kind": "entity_detail", "entity_slug": "yena"},
                "payload": {
                    "entity": {"slug": "yena", "name": "YENA"},
                    "headline": "최예나, 3월 11일 컴백 확정",
                    "reason": "new_signal",
                    "scheduled_date": "2026-03-11",
                    "date_precision": "exact",
                    "date_status": "confirmed",
                    "source": {"url": "https://example.com/yena", "type": "news_rss"},
                },
            },
            {
                "expo_push_token": "ExponentPushToken[test-token]",
            },
        )

        self.assertEqual(message["to"], "ExponentPushToken[test-token]")
        self.assertEqual(message["data"]["destination"]["kind"], "entity_detail")
        self.assertEqual(message["data"]["entity_slug"], "yena")

    def test_skip_reason_prefers_permission_denied(self) -> None:
        skip_reason = push_delivery.classify_registration_skip_reason(
            {
                "alerts_enabled": True,
                "permission_status": "denied",
                "expo_push_token": None,
                "is_active": False,
                "disabled_reason": "permission_denied",
            }
        )

        self.assertEqual(skip_reason, "permission_denied")

    def test_retryable_failure_code_only_allows_known_transient_errors(self) -> None:
        self.assertTrue(push_delivery.is_retryable_failure_code("http_503"))
        self.assertTrue(push_delivery.is_retryable_failure_code("timeout"))
        self.assertFalse(push_delivery.is_retryable_failure_code("DeviceNotRegistered"))
        self.assertFalse(push_delivery.is_retryable_failure_code(None))


if __name__ == "__main__":
    unittest.main()
