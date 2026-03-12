import unittest

import non_runtime_dataset_paths as paths


class NonRuntimeDatasetPathsTests(unittest.TestCase):
    def test_release_detail_primary_path_points_to_root_catalog(self):
        self.assertEqual(paths.primary_path("releaseDetails.json").name, "release_detail_catalog.json")

    def test_release_detail_mirror_paths_include_export_and_web_snapshot(self):
        mirrors = paths.mirror_output_paths("releaseDetails.json")
        mirror_names = {path.name for path in mirrors}

        self.assertIn("releaseDetails.json", mirror_names)
        self.assertEqual(len(mirrors), 2)
        self.assertTrue(any("backend/exports/non_runtime_web_snapshots" in str(path) for path in mirrors))
        self.assertTrue(any("web/src/data" in str(path) for path in mirrors))


if __name__ == "__main__":
    unittest.main()
