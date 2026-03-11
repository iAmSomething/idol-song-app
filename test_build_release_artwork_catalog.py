import unittest

import build_release_artwork_catalog as module


class ReleaseArtworkCatalogTests(unittest.TestCase):
    def test_build_verified_row_uses_cover_art_archive_urls(self):
        row = module.build_verified_row(
            "BLACKPINK",
            {
                "title": "DEADLINE",
                "date": "2026-02-27",
                "stream": "album",
            },
            "38204997-b295-4d09-a946-f7e119725031",
        )

        self.assertEqual(row["artwork_status"], "verified")
        self.assertEqual(row["artwork_provenance"], "releaseHistory.releases.source")
        self.assertEqual(
            row["cover_image_url"],
            "https://coverartarchive.org/release-group/38204997-b295-4d09-a946-f7e119725031/front",
        )

    def test_extract_release_group_id(self):
        self.assertEqual(
            module.extract_release_group_id("https://musicbrainz.org/release-group/38204997-b295-4d09-a946-f7e119725031"),
            "38204997-b295-4d09-a946-f7e119725031",
        )


if __name__ == "__main__":
    unittest.main()
