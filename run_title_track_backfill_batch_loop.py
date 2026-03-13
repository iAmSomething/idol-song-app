#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parent
DEFAULT_SUMMARY_PATH = ROOT / "backend" / "reports" / "title_track_backfill_batch_loop_report.json"
BACKFILL_SCRIPT = ROOT / "build_release_details_musicbrainz.py"


class CommandTimedOutError(RuntimeError):
    pass


def parse_positive_int_arg(raw_value: str) -> int:
    try:
        parsed = int(raw_value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive integer") from error
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_json_from_stdout(stdout: str) -> dict[str, Any]:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"command did not emit valid JSON stdout: {error}") from error
    if not isinstance(payload, dict):
        raise RuntimeError("command did not emit a JSON object")
    return payload


def build_backfill_command(
    cohorts: str,
    batch_size: int,
    row_offset: int,
    progress_every: int,
    skip_acquisition: bool,
) -> list[str]:
    command = [
        sys.executable,
        str(BACKFILL_SCRIPT),
        "--cohorts",
        cohorts,
        "--max-rows",
        str(batch_size),
        "--row-offset",
        str(row_offset),
        "--progress-every",
        str(progress_every),
    ]
    if skip_acquisition:
        command.append("--skip-acquisition")
    return command


def run_json_command(command: list[str], command_timeout_seconds: int) -> tuple[dict[str, Any], str]:
    try:
        completed = subprocess.run(
            command,
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=command_timeout_seconds,
        )
    except subprocess.TimeoutExpired as error:
        raise CommandTimedOutError(
            "command timed out "
            f"(timeout={command_timeout_seconds}s): {' '.join(command)}\n"
            f"stdout:\n{error.stdout or ''}\nstderr:\n{error.stderr or ''}"
        ) from error
    if completed.returncode != 0:
        raise RuntimeError(
            "command failed "
            f"(exit={completed.returncode}): {' '.join(command)}\n"
            f"stderr:\n{completed.stderr}\nstdout:\n{completed.stdout}"
        )
    return load_json_from_stdout(completed.stdout), completed.stderr


def summarize_iteration(
    batch_index: int,
    row_offset: int,
    batch_size: int,
    report: dict[str, Any],
    stderr: str,
) -> dict[str, Any]:
    execution_scope = report.get("execution_scope", {})
    rows_with_title_track_before = int(report.get("rows_with_title_track_before") or 0)
    rows_with_title_track_after = int(report.get("rows_with_title_track_after") or 0)
    return {
        "batch_index": batch_index,
        "row_offset": row_offset,
        "batch_size": batch_size,
        "selected_rows": execution_scope.get("selected_rows", 0),
        "scoped_rows_total": execution_scope.get("scoped_rows_total", 0),
        "rows_with_title_track_before": rows_with_title_track_before,
        "rows_with_title_track_after": rows_with_title_track_after,
        "persisted_title_track_changes": max(rows_with_title_track_after - rows_with_title_track_before, 0),
        "title_track_auto_resolved_rows": int(report.get("title_track_auto_resolved_rows") or 0),
        "title_track_auto_double_rows": int(report.get("title_track_auto_double_rows") or 0),
        "title_track_review_queue_rows": int(report.get("title_track_review_queue_rows") or 0),
        "stderr_lines": [line for line in stderr.splitlines() if line.strip()],
    }


def run_batch_loop(
    *,
    cohorts: str,
    batch_size: int,
    min_batch_size: int,
    max_batches: int,
    progress_every: int,
    skip_acquisition: bool,
    command_timeout_seconds: int,
    batch_runner: Callable[[int, int], tuple[dict[str, Any], str]],
) -> dict[str, Any]:
    started_at = now_utc_iso()
    row_offset = 0
    batch_index = 0
    iterations: list[dict[str, Any]] = []
    adaptive_events: list[dict[str, Any]] = []
    stop_reason = "unknown"
    current_batch_size = batch_size

    while batch_index < max_batches:
        try:
            report, stderr = batch_runner(row_offset, current_batch_size)
        except CommandTimedOutError as error:
            if current_batch_size <= min_batch_size:
                raise
            next_batch_size = max(min_batch_size, current_batch_size // 2)
            adaptive_events.append(
                {
                    "row_offset": row_offset,
                    "previous_batch_size": current_batch_size,
                    "next_batch_size": next_batch_size,
                    "reason": "command_timeout",
                    "error": str(error),
                }
            )
            current_batch_size = next_batch_size
            continue

        batch_index += 1
        iteration = summarize_iteration(batch_index, row_offset, current_batch_size, report, stderr)
        iterations.append(iteration)

        selected_rows = int(iteration["selected_rows"])
        scoped_rows_total = int(iteration["scoped_rows_total"])
        persisted_title_track_changes = int(iteration["persisted_title_track_changes"])

        if selected_rows == 0:
            stop_reason = "exhausted"
            break

        if persisted_title_track_changes > 0:
            row_offset = 0
            continue

        next_row_offset = row_offset + selected_rows
        if next_row_offset >= scoped_rows_total:
            stop_reason = "no_progress_full_scan"
            break
        row_offset = next_row_offset
    else:
        stop_reason = "max_batches"

    summary = {
        "started_at": started_at,
        "finished_at": now_utc_iso(),
        "config": {
            "cohorts": [value.strip() for value in cohorts.split(",") if value.strip()],
            "batch_size": batch_size,
            "min_batch_size": min_batch_size,
            "max_batches": max_batches,
            "progress_every": progress_every,
            "skip_acquisition": skip_acquisition,
            "command_timeout_seconds": command_timeout_seconds,
        },
        "stop_reason": stop_reason,
        "batches_run": len(iterations),
        "adaptive_events": adaptive_events,
        "total_persisted_title_track_changes": sum(int(row["persisted_title_track_changes"]) for row in iterations),
        "total_auto_resolved_rows": sum(int(row["title_track_auto_resolved_rows"]) for row in iterations),
        "final_iteration": iterations[-1] if iterations else None,
        "iterations": iterations,
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--cohorts",
        default="latest,recent",
        help="Comma-separated release cohorts to backfill in the automated loop.",
    )
    parser.add_argument(
        "--batch-size",
        type=parse_positive_int_arg,
        default=50,
        help="Number of rows to process per title-track batch.",
    )
    parser.add_argument(
        "--min-batch-size",
        type=parse_positive_int_arg,
        default=10,
        help="Minimum batch size to fall back to after timeout-driven retries.",
    )
    parser.add_argument(
        "--max-batches",
        type=parse_positive_int_arg,
        default=20,
        help="Maximum number of title-track batch invocations before stopping.",
    )
    parser.add_argument(
        "--progress-every",
        type=parse_positive_int_arg,
        default=25,
        help="Forwarded to build_release_details_musicbrainz.py for stderr progress output.",
    )
    parser.add_argument(
        "--command-timeout-seconds",
        type=parse_positive_int_arg,
        default=180,
        help="Hard timeout in seconds for each batch subprocess.",
    )
    parser.add_argument(
        "--skip-acquisition",
        action="store_true",
        help="Forward --skip-acquisition to the underlying release detail builder.",
    )
    parser.add_argument(
        "--summary-path",
        default=str(DEFAULT_SUMMARY_PATH),
        help="Where to write the loop summary JSON.",
    )
    args = parser.parse_args()

    def batch_runner(row_offset: int, batch_size: int) -> tuple[dict[str, Any], str]:
        command = build_backfill_command(
            args.cohorts,
            batch_size,
            row_offset,
            args.progress_every,
            args.skip_acquisition,
        )
        print(
            "[run_title_track_backfill_batch_loop] "
            f"batch row_offset={row_offset} batch_size={batch_size}",
            file=sys.stderr,
            flush=True,
        )
        return run_json_command(command, args.command_timeout_seconds)

    summary = run_batch_loop(
        cohorts=args.cohorts,
        batch_size=args.batch_size,
        min_batch_size=args.min_batch_size,
        max_batches=args.max_batches,
        progress_every=args.progress_every,
        skip_acquisition=args.skip_acquisition,
        command_timeout_seconds=args.command_timeout_seconds,
        batch_runner=batch_runner,
    )

    summary_path = Path(args.summary_path)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
