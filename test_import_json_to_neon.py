import importlib
import sys
import types
import unittest


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


if __name__ == "__main__":
    unittest.main()
