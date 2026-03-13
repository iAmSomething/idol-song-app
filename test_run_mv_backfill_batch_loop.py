import unittest
from subprocess import TimeoutExpired
from unittest.mock import patch

import run_mv_backfill_batch_loop as loop


class RunMvBackfillBatchLoopTests(unittest.TestCase):
    def test_parse_positive_int_arg_accepts_positive_value(self) -> None:
        self.assertEqual(loop.parse_positive_int_arg("3"), 3)

    def test_parse_positive_int_arg_rejects_zero(self) -> None:
        with self.assertRaises(Exception):
            loop.parse_positive_int_arg("0")

    def test_run_batch_loop_resets_offset_after_progress_and_stops_when_next_scan_has_none(self) -> None:
        calls: list[int] = []

        def batch_runner(row_offset: int):
            calls.append(row_offset)
            if row_offset == 0 and len(calls) == 1:
                return (
                {
                    "resolved_now": 2,
                    "persisted_resolution_changes": 2,
                    "coverage_lift": 2,
                    "review_row_count": 1,
                    "resolved_entities": 1,
                        "unresolved_remainder": 10,
                        "execution_scope": {
                            "selected_rows": 5,
                            "scoped_rows_total": 12,
                        },
                    },
                    "[progress]\n",
                )
            return (
                {
                    "resolved_now": 0,
                    "persisted_resolution_changes": 0,
                    "coverage_lift": 0,
                    "review_row_count": 0,
                    "resolved_entities": 0,
                    "unresolved_remainder": 10,
                    "execution_scope": {
                        "selected_rows": 0,
                        "scoped_rows_total": 10,
                    },
                },
                "",
            )

        def queue_builder():
            return {"queue_items": 10}

        summary = loop.run_batch_loop(
            cohorts="latest,recent",
            batch_size=5,
            max_batches=4,
            progress_every=2,
            request_timeout_seconds=10,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
            queue_builder=queue_builder,
        )

        self.assertEqual(calls, [0, 0])
        self.assertEqual(summary["stop_reason"], "exhausted")
        self.assertEqual(summary["total_resolved_now"], 2)
        self.assertEqual(summary["queue_summary"]["queue_items"], 10)

    def test_run_batch_loop_advances_offset_during_no_progress_scan_and_stops_at_end(self) -> None:
        calls: list[int] = []

        def batch_runner(row_offset: int):
            calls.append(row_offset)
            return (
                {
                    "resolved_now": 0,
                    "persisted_resolution_changes": 0,
                    "coverage_lift": 0,
                    "review_row_count": 2,
                    "resolved_entities": 0,
                    "unresolved_remainder": 40,
                    "execution_scope": {
                        "selected_rows": 10,
                        "scoped_rows_total": 20,
                    },
                },
                "",
            )

        summary = loop.run_batch_loop(
            cohorts="latest,recent",
            batch_size=10,
            max_batches=5,
            progress_every=2,
            request_timeout_seconds=10,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
            queue_builder=lambda: {"queue_items": 40},
        )

        self.assertEqual(calls, [0, 10])
        self.assertEqual(summary["stop_reason"], "no_progress_full_scan")
        self.assertEqual(summary["batches_run"], 2)

    def test_run_batch_loop_stops_at_max_batches(self) -> None:
        def batch_runner(_row_offset: int):
            return (
                {
                    "resolved_now": 1,
                    "persisted_resolution_changes": 1,
                    "coverage_lift": 1,
                    "review_row_count": 0,
                    "resolved_entities": 1,
                    "unresolved_remainder": 100,
                    "execution_scope": {
                        "selected_rows": 10,
                        "scoped_rows_total": 100,
                    },
                },
                "",
            )

        summary = loop.run_batch_loop(
            cohorts="latest,recent",
            batch_size=10,
            max_batches=3,
            progress_every=2,
            request_timeout_seconds=10,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
            queue_builder=lambda: {"queue_items": 100},
        )

        self.assertEqual(summary["stop_reason"], "max_batches")
        self.assertEqual(summary["batches_run"], 3)
        self.assertEqual(summary["total_persisted_resolution_changes"], 3)

    def test_run_batch_loop_moves_forward_when_resolutions_do_not_change_files(self) -> None:
        calls: list[int] = []

        def batch_runner(row_offset: int):
            calls.append(row_offset)
            return (
                {
                    "resolved_now": 3,
                    "persisted_resolution_changes": 0,
                    "coverage_lift": 0,
                    "review_row_count": 7,
                    "resolved_entities": 1,
                    "unresolved_remainder": 100,
                    "execution_scope": {
                        "selected_rows": 10,
                        "scoped_rows_total": 20,
                    },
                },
                "",
            )

        summary = loop.run_batch_loop(
            cohorts="latest,recent",
            batch_size=10,
            max_batches=5,
            progress_every=2,
            request_timeout_seconds=10,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
            queue_builder=lambda: {"queue_items": 100},
        )

        self.assertEqual(calls, [0, 10])
        self.assertEqual(summary["stop_reason"], "no_progress_full_scan")
        self.assertEqual(summary["total_resolved_now"], 6)
        self.assertEqual(summary["total_persisted_resolution_changes"], 0)

    def test_build_backfill_command_forwards_request_timeout(self) -> None:
        command = loop.build_backfill_command(
            "latest,recent",
            batch_size=10,
            row_offset=20,
            progress_every=2,
            request_timeout_seconds=9,
        )

        self.assertIn("--request-timeout", command)
        self.assertEqual(command[-1], "9")

    @patch.object(loop.subprocess, "run")
    def test_run_json_command_raises_timeout_error(self, mock_run: object) -> None:
        mock_run.side_effect = TimeoutExpired(
            cmd=["python", "fake.py"],
            timeout=30,
            output="partial stdout",
            stderr="partial stderr",
        )

        with self.assertRaises(RuntimeError) as error:
            loop.run_json_command(["python", "fake.py"], command_timeout_seconds=30)

        self.assertIn("command timed out", str(error.exception))
        self.assertIn("partial stdout", str(error.exception))
        self.assertIn("partial stderr", str(error.exception))


if __name__ == "__main__":
    unittest.main()
