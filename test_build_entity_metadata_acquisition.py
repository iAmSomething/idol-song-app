import unittest

import build_entity_metadata_acquisition as module


class BuildEntityMetadataAcquisitionTests(unittest.TestCase):
    def test_build_youtube_probe_candidates_preserves_unique_handles(self):
        profile = {
            "official_x_url": "https://x.com/ALL_H_OURS",
            "official_instagram_url": "https://www.instagram.com/all_h_ours/",
            "official_youtube_url": None,
        }
        seed_row = {
            "official_youtube_candidates": ["ALL_H_OURS", "@ALL_H_OURS", "all_h_ours"],
        }

        candidates = module.build_youtube_probe_candidates(profile, seed_row)

        self.assertEqual(candidates[0], "ALL_H_OURS")
        self.assertEqual(candidates[1], "all_h_ours")
        self.assertEqual(len(candidates), 2)

    def test_youtube_probe_matches_when_slug_token_is_in_channel_title(self):
        profile = {"slug": "all-h-ours", "group": "ALL(H)OURS"}
        probe = {
            "url": "https://www.youtube.com/@ALL_H_OURS",
            "og_title": "올아워즈 ALL(H)OURS",
            "canonical_handle": "ALL_H_OURS",
        }

        self.assertTrue(module.youtube_probe_matches(profile, "ALL_H_OURS", probe))

    def test_youtube_probe_rejects_unrelated_channel(self):
        profile = {"slug": "hearts2hearts", "group": "Hearts2Hearts"}
        probe = {
            "url": "https://www.youtube.com/@hearts2heartsrussia",
            "og_title": "Hearts to Hearts Russia",
            "canonical_handle": "hearts2heartsrussia",
        }

        self.assertFalse(module.youtube_probe_matches(profile, "Hearts2Hearts", probe))


if __name__ == "__main__":
    unittest.main()
