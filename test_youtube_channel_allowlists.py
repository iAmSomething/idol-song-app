from __future__ import annotations

import unittest

import youtube_channel_allowlists as allowlists


class YoutubeChannelAllowlistsTests(unittest.TestCase):
    def test_extract_youtube_channel_alias_urls_returns_channel_and_canonical_handle(self) -> None:
        html = """
        <script>
        var ytInitialData = {
          "header": {"c4TabbedHeaderRenderer": {"channelId":"UC1234567890abcdefghijkl"}},
          "metadata": {"channelMetadataRenderer": {"canonicalBaseUrl":"/@YENA_OFFICIAL"}}
        };
        </script>
        """

        self.assertEqual(
            allowlists.extract_youtube_channel_alias_urls(html),
            [
                "https://www.youtube.com/channel/UC1234567890abcdefghijkl",
                "https://www.youtube.com/@YENA_OFFICIAL",
            ],
        )

    def test_build_source_adds_match_keys_for_resolved_channel_aliases(self) -> None:
        source = allowlists.build_source(
            "https://www.youtube.com/@YENA_OFFICIAL",
            "YENA",
            "team",
            True,
            "test",
            fetcher=lambda _: """
            <script>
            {"channelId":"UC1234567890abcdefghijkl","canonicalBaseUrl":"/@YENA_OFFICIAL"}
            </script>
            """,
        )

        self.assertIn("https://www.youtube.com/channel/UC1234567890abcdefghijkl", source["resolved_alias_urls"])
        self.assertIn("channel:uc1234567890abcdefghijkl", source["match_keys"])
        self.assertIn("@yena_official", source["match_keys"])


if __name__ == "__main__":
    unittest.main()
