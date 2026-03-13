import unittest

import build_official_social_survey_inventory as module


def make_row(
    group: str,
    slug: str,
    x_status: str,
    instagram_status: str,
    youtube_status: str,
) -> dict:
    def field(status: str, value: str | None) -> dict:
        return {
            "value": value,
            "status": status,
            "provenance": "test",
            "source_url": "https://example.com/source",
            "review_notes": None,
        }

    return {
        "group": group,
        "slug": slug,
        "fields": {
            "official_x": field(x_status, f"https://x.com/{slug}" if x_status == "resolved" else None),
            "official_instagram": field(
                instagram_status,
                f"https://www.instagram.com/{slug}" if instagram_status == "resolved" else None,
            ),
            "official_youtube": field(
                youtube_status,
                f"https://www.youtube.com/@{slug}" if youtube_status == "resolved" else None,
            ),
        },
    }


class BuildOfficialSocialSurveyInventoryTests(unittest.TestCase):
    def test_classify_entity_buckets_resolved_partial_and_missing(self) -> None:
        ready = module.classify_entity(make_row("Ready", "ready", "resolved", "resolved", "resolved"))
        partial = module.classify_entity(make_row("Partial", "partial", "resolved", "resolved", "review_needed"))
        missing = module.classify_entity(make_row("Missing", "missing", "review_needed", "review_needed", "review_needed"))

        self.assertEqual(ready["eligibility_state"], "survey_ready")
        self.assertEqual(ready["resolved_handle_count"], 3)
        self.assertEqual(partial["eligibility_state"], "partially_ready")
        self.assertEqual(partial["weak_fields"], ["official_youtube"])
        self.assertEqual(missing["eligibility_state"], "missing_handle")
        self.assertEqual(missing["resolved_handle_count"], 0)

    def test_build_inventory_report_counts_weak_fields(self) -> None:
        report = module.build_inventory_report(
            [
                make_row("Ready", "ready", "resolved", "resolved", "resolved"),
                make_row("Partial", "partial", "resolved", "resolved", "review_needed"),
                make_row("Missing", "missing", "review_needed", "resolved", "review_needed"),
            ]
        )

        self.assertEqual(report["entity_count"], 3)
        self.assertEqual(report["eligibility_counts"]["survey_ready"], 1)
        self.assertEqual(report["eligibility_counts"]["partially_ready"], 2)
        self.assertEqual(report["weak_field_counts"]["official_youtube"], 2)
        self.assertEqual(report["field_status_counts"]["official_x"]["resolved"], 2)
        self.assertEqual(report["field_status_counts"]["official_youtube"]["review_needed"], 2)

    def test_build_workbench_includes_only_non_ready_entities(self) -> None:
        report = module.build_inventory_report(
            [
                make_row("Ready", "ready", "resolved", "resolved", "resolved"),
                make_row("Partial", "partial", "resolved", "resolved", "review_needed"),
                make_row("Missing", "missing", "review_needed", "review_needed", "review_needed"),
            ]
        )

        workbench = module.build_workbench(report)

        self.assertEqual(workbench["total_entries"], 2)
        self.assertEqual(workbench["counts_by_state"]["partially_ready"], 1)
        self.assertEqual(workbench["counts_by_state"]["missing_handle"], 1)
        self.assertEqual([entry["slug"] for entry in workbench["entries"]], ["missing", "partial"])

    def test_build_inventory_report_sets_generated_at(self) -> None:
        report = module.build_inventory_report([make_row("Ready", "ready", "resolved", "resolved", "resolved")])

        self.assertIsInstance(report["generated_at"], str)
        self.assertTrue(report["generated_at"])

    def test_missing_social_field_becomes_missing_status(self) -> None:
        row = make_row("Missing", "missing", "resolved", "resolved", "resolved")
        del row["fields"]["official_youtube"]

        classified = module.classify_entity(row)

        self.assertEqual(classified["eligibility_state"], "partially_ready")
        self.assertEqual(classified["handles"]["official_youtube"]["status"], "missing")
        self.assertEqual(classified["weak_fields"], ["official_youtube"])

    def test_build_inventory_report_tracks_official_social_findings(self) -> None:
        report = module.build_inventory_report(
            [make_row("AB6IX", "ab6ix", "resolved", "resolved", "resolved")],
            [
                {
                    "group": "AB6IX",
                    "scheduled_date": "2026-03-16",
                    "headline": "AB6IX official X announcement · SEVEN : CRIMSON HORIZON · 2026-03-16 6PM KST",
                    "source_type": "official_social",
                    "source_url": "https://x.com/AB6IX/status/2025948771490955484",
                    "release_format": "album",
                    "date_precision": "exact",
                }
            ],
        )

        findings = report["official_social_findings"]
        self.assertEqual(findings["count"], 1)
        self.assertEqual(findings["cohort_counts"]["resolved"], 1)
        self.assertEqual(findings["cohort_counts"]["unresolved"], 0)
        self.assertEqual(findings["fixtures"][0]["group"], "AB6IX")
        self.assertEqual(findings["fixtures"][0]["cohort"], "resolved")
        self.assertEqual(findings["fixtures"][0]["source_type"], "official_social")


if __name__ == "__main__":
    unittest.main()
