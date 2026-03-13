import unittest
from subprocess import TimeoutExpired
from unittest.mock import patch

import run_title_track_backfill_batch_loop as loop


class RunTitleTrackBackfillBatchLoopTests(unittest.TestCase):
    def test_parse_positive_int_arg_accepts_positive_value(self) -> None:
        self.assertEqual(loop.parse_positive_int_arg("3"), 3)

    def test_parse_positive_int_arg_rejects_zero(self) -> None:
        with self.assertRaises(Exception):
            loop.parse_positive_int_arg("0")

    def test_run_batch_loop_resets_offset_after_progress(self) -> None:
        calls: list[int] = []

        def batch_runner(row_offset: int):
            calls.append(row_offset)
            if len(calls) == 1:
                return (
                    {
                        "rows_with_title_track_before": 2,
                        "rows_with_title_track_after": 4,
                        "title_track_auto_resolved_rows": 2,
                        "title_track_auto_double_rows": 0,
                        "title_track_review_queue_rows": 10,
                        "execution_scope": {
                            "selected_rows": 5,
                            "scoped_rows_total": 12,
                        },
                    },
                    "[progress]\n",
                )
            return (
                {
                    "rows_with_title_track_before": 4,
                    "rows_with_title_track_after": 4,
                    "title_track_auto_resolved_rows": 0,
                    "title_track_auto_double_rows": 0,
                    "title_track_review_queue_rows": 10,
                    "execution_scope": {
                        "selected_rows": 0,
                        "scoped_rows_total": 10,
                    },
                },
                "",
            )

        summary = loop.run_batch_loop(
            cohorts="latest,recent",
            batch_size=5,
            max_batches=4,
            progress_every=2,
            skip_acquisition=False,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
        )

        self.assertEqual(calls, [0, 0])
        self.assertEqual(summary["stop_reason"], "exhausted")
        self.assertEqual(summary["total_persisted_title_track_changes"], 2)

    def test_run_batch_loop_advances_offset_during_no_progress_scan(self) -> None:
        calls: list[int] = []

        def batch_runner(row_offset: int):
            calls.append(row_offset)
            return (
                {
                    "rows_with_title_track_before": 5,
                    "rows_with_title_track_after": 5,
                    "title_track_auto_resolved_rows": 0,
                    "title_track_auto_double_rows": 0,
                    "title_track_review_queue_rows": 20,
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
            skip_acquisition=True,
            command_timeout_seconds=180,
            batch_runner=batch_runner,
        )

        self.assertEqual(calls, [0, 10])
        self.assertEqual(summary["stop_reason"], "no_progress_full_scan")
        self.assertEqual(summary["batches_run"], 2)

    def test_build_backfill_command_forwards_row_offset_and_skip_flag(self) -> None:
        command = loop.build_backfill_command(
            "latest,recent",
            batch_size=10,
            row_offset=20,
            progress_every=2,
            skip_acquisition=True,
        )

        self.assertIn("--row-offset", command)
        self.assertIn("20", command)
        self.assertIn("--skip-acquisition", command)

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
