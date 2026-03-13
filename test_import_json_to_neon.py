import importlib
import sys
import types
import unittest
import uuid


def import_module_under_test():
    fake_psycopg = types.ModuleType("psycopg")
    fake_psycopg.Connection = object
    fake_types = types.ModuleType("psycopg.types")
    fake_types_json = types.ModuleType("psycopg.types.json")

    class FakeJsonb:
        def __init__(self, value):
            self.value = value

    fake_types_json.Jsonb = FakeJsonb

    sys.modules.setdefault("psycopg", fake_psycopg)
    sys.modules.setdefault("psycopg.types", fake_types)
    sys.modules.setdefault("psycopg.types.json", fake_types_json)
    return importlib.import_module("import_json_to_neon")


class ImportJsonToNeonDryRunSummaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = import_module_under_test()

    def test_build_table_count_review_focus_keeps_only_active_tables(self):
        focus = self.module.build_table_count_review_focus(
            {
                "entities": {
                    "payload_rows": 116,
                    "insert_candidates": 4,
                    "update_candidates": 112,
                    "projected_db_rows_after": 116,
                },
                "tracks": {
                    "payload_rows": 497,
                    "insert_candidates": 0,
                    "update_candidates": 497,
                    "projected_db_rows_after": 497,
                },
                "release_link_overrides": {
                    "payload_rows": 0,
                    "insert_candidates": 0,
                    "update_candidates": 0,
                    "projected_db_rows_after": 75,
                },
            }
        )

        self.assertEqual(focus["active_table_count"], 2)
        self.assertEqual([row["table"] for row in focus["tables_with_inserts"]], ["entities"])
        self.assertEqual(
            [row["table"] for row in focus["tables_with_updates"]],
            ["entities", "tracks"],
        )

    def test_build_anomaly_review_focus_omits_zero_buckets(self):
        focus = self.module.build_anomaly_review_focus(
            {
                "counts": {
                    "source_duplicates_total": 38,
                    "dropped_records_total": 0,
                    "missing_fk_tables": 0,
                    "missing_fk_sample_total": 0,
                    "unresolved_release_mappings": 2,
                    "unresolved_review_links": 0,
                    "stale_review_tasks": 1,
                },
                "by_table": {
                    "source_duplicates": {
                        "entities": 0,
                        "entity_aliases": 3,
                    },
                    "dropped_records": {
                        "releases": 0,
                    },
                    "missing_fk_sample_counts": {
                        "tracks": 0,
                    },
                },
            }
        )

        self.assertTrue(focus["has_anomalies"])
        self.assertEqual(
            focus["counts"],
            {
                "source_duplicates_total": 38,
                "unresolved_release_mappings": 2,
                "stale_review_tasks": 1,
            },
        )
        self.assertEqual(
            focus["nonzero_by_table"],
            {
                "source_duplicates": {
                    "entity_aliases": 3,
                }
            },
        )

    def test_build_cli_summary_includes_dry_run_focus(self):
        payload = self.module.build_cli_summary(
            {
                "mode": "dry_run",
                "summary_path": "backend/reports/json_to_neon_import_summary.json",
                "db_row_counts": {
                    "entities": 116,
                    "releases": 1768,
                    "upcoming_signals": 59,
                    "review_tasks": 101,
                },
                "db_unchanged": True,
                "dry_run_focus": {
                    "table_counts": {"active_table_count": 2},
                    "anomalies": {"has_anomalies": True},
                },
            }
        )

        self.assertEqual(payload["mode"], "dry_run")
        self.assertTrue(payload["db_unchanged"])
        self.assertEqual(
            payload["dry_run_focus"],
            {
                "table_counts": {"active_table_count": 2},
                "anomalies": {"has_anomalies": True},
            },
        )

    def test_build_upcoming_rows_prefers_official_social_exact_signal(self):
        summary = {
            "generated_at": "2026-03-14T00:00:00+00:00",
            "source_counts": {},
            "source_duplicates": self.module.Counter(),
            "dropped_records": self.module.Counter(),
            "dropped_missing_fk_samples": {},
            "unresolved_release_mappings": [],
            "unresolved_review_links": [],
        }
        entity_ids = {"AB6IX": uuid.uuid4()}
        rows = [
            {
                "group": "AB6IX",
                "scheduled_date": "2026-03-16",
                "date_status": "confirmed",
                "headline": "AB6IX official X announcement · SEVEN : CRIMSON HORIZON · 2026-03-16 6PM KST",
                "source_type": "official_social",
                "source_url": "https://x.com/AB6IX/status/2025948771490955484",
                "source_domain": "x.com",
                "published_at": None,
                "confidence": 0.98,
                "evidence_summary": "Official X announcement.",
                "tracking_status": "filtered_out",
                "search_term": "\"AB6IX\" official X comeback",
                "release_format": "album",
                "context_tags": ["official_social"],
                "date_precision": "exact",
                "scheduled_month": "2026-03",
            },
            {
                "group": "AB6IX",
                "scheduled_date": None,
                "date_status": "scheduled",
                "headline": "AB6IX March comeback expected",
                "source_type": "news_rss",
                "source_url": "https://example.com/news",
                "source_domain": "example.com",
                "published_at": None,
                "confidence": 0.4,
                "evidence_summary": "News placeholder.",
                "tracking_status": "filtered_out",
                "search_term": "AB6IX comeback",
                "release_format": "album",
                "context_tags": ["news_rss"],
                "date_precision": "month_only",
                "scheduled_month": "2026-03",
            },
        ]

        signal_rows, source_rows, signal_ids_by_dedupe = self.module.build_upcoming_rows(rows, entity_ids, summary)

        self.assertEqual(len(signal_rows), 1)
        self.assertEqual(signal_rows[0]["headline"], rows[0]["headline"])
        self.assertEqual(str(signal_rows[0]["scheduled_date"]), "2026-03-16")
        self.assertEqual(signal_rows[0]["date_precision"], "exact")
        self.assertEqual(signal_rows[0]["date_status"], "confirmed")
        self.assertEqual(signal_rows[0]["release_format"], "album")
        self.assertEqual(len(source_rows), 2)
        self.assertEqual(source_rows[0]["source_type"], "news_rss")
        self.assertEqual(source_rows[1]["source_type"], "official_social")
        self.assertEqual(len(signal_ids_by_dedupe), 2)


if __name__ == "__main__":
    unittest.main()
