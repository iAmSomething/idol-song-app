from __future__ import annotations

import unittest

import backfill_release_detail_mvs as backfill


class BackfillReleaseDetailMvQueryTests(unittest.TestCase):
    def test_build_queries_prefers_primary_name_then_korean_alias_then_release_title(self) -> None:
        detail = {
            "group": "IVE",
            "release_title": "REVIVE+",
            "tracks": [
                {"title": "BLACKHOLE", "is_title_track": True},
                {"title": "BANG BANG", "is_title_track": True},
            ],
        }
        profile = {
            "display_name": "IVE",
            "aliases": [],
            "search_aliases": ["아이브", "ive"],
        }

        self.assertEqual(
            backfill.build_queries(detail, profile),
            [
                "IVE BLACKHOLE official mv",
                "IVE BLACKHOLE mv",
                "아이브 BLACKHOLE official mv",
                "아이브 BLACKHOLE mv",
                "IVE REVIVE+ official mv",
                "IVE REVIVE+ mv",
            ],
        )

    def test_build_queries_uses_romanized_alias_after_korean_alias(self) -> None:
        detail = {
            "group": "(G)I-DLE",
            "release_title": "Mono",
            "tracks": [
                {"title": "Mono", "is_title_track": True},
            ],
        }
        profile = {
            "display_name": "(G)I-DLE",
            "aliases": ["i-dle"],
            "search_aliases": ["아이들", "여자아이들"],
        }

        self.assertEqual(
            backfill.build_queries(detail, profile),
            [
                "(G)I-DLE Mono official mv",
                "(G)I-DLE Mono mv",
                "아이들 Mono official mv",
                "아이들 Mono mv",
                "i-dle Mono official mv",
                "i-dle Mono mv",
            ],
        )


if __name__ == "__main__":
    unittest.main()
