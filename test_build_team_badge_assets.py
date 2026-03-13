from __future__ import annotations

import unittest

from build_team_badge_assets import (
    build_badge_row,
    build_badge_rows,
    extract_avatar_image_url,
    select_team_channel_url,
)


def stub_fetcher_factory(pages: dict[str, str]):
    def fetcher(url: str) -> str:
        if url not in pages:
            raise RuntimeError(f"missing page for {url}")
        return pages[url]

    return fetcher


class BuildTeamBadgeAssetsTest(unittest.TestCase):
    def test_extract_avatar_image_url_prefers_og_image(self) -> None:
        html = """
        <html><head>
          <meta property="og:image" content="https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj" />
        </head></html>
        """
        self.assertEqual(
            extract_avatar_image_url(html),
            "https://yt3.googleusercontent.com/example=s900-c-k-c0x00ffffff-no-rj",
        )

    def test_select_team_channel_url_skips_agency_channel(self) -> None:
        profile = {
            "group": "Hearts2Hearts",
            "official_youtube_url": "https://www.youtube.com/@SMTOWN",
        }
        allowlist_row = {
            "primary_team_channel_url": "https://www.youtube.com/@SMTOWN",
            "channels": [
                {
                    "channel_url": "https://www.youtube.com/@SMTOWN",
                    "owner_type": "team",
                    "display_in_team_links": True,
                }
            ],
        }
        self.assertIsNone(select_team_channel_url(profile, allowlist_row))

    def test_build_badge_row_uses_channel_alias_for_source(self) -> None:
        channel_url = "https://www.youtube.com/@ALLDAY_PROJECT"
        fetcher = stub_fetcher_factory(
            {
                channel_url: """
                <html>
                  <head>
                    <meta property="og:image" content="https://yt3.googleusercontent.com/allday=s900-c-k-c0x00ffffff-no-rj" />
                  </head>
                  <body>
                    "channelId":"UCg8ZzloDPTrOiGztK0C9txQ"
                    "canonicalBaseUrl":"/@ALLDAY_PROJECT"
                  </body>
                </html>
                """
            }
        )
        row = build_badge_row("ALLDAY PROJECT", channel_url, fetcher)
        self.assertIsNotNone(row)
        self.assertEqual(
            row["badge_source_url"],
            "https://www.youtube.com/channel/UCg8ZzloDPTrOiGztK0C9txQ",
        )

    def test_build_badge_rows_adds_missing_team_owned_badges(self) -> None:
        profiles = [
            {
                "group": "ALLDAY PROJECT",
                "official_youtube_url": "https://www.youtube.com/@ALLDAY_PROJECT",
            },
            {
                "group": "Hearts2Hearts",
                "official_youtube_url": "https://www.youtube.com/@SMTOWN",
                "official_instagram_url": "https://www.instagram.com/hearts2hearts",
            },
        ]
        existing_rows = [
            {
                "group": "BTS",
                "badge_image_url": "https://yt3.googleusercontent.com/bts=s900-c-k-c0x00ffffff-no-rj",
                "badge_source_url": "https://www.youtube.com/channel/UC1",
                "badge_source_label": "Official YouTube channel avatar",
                "badge_kind": "official_channel_avatar",
            }
        ]
        allowlists_by_group = {
            "ALLDAY PROJECT": {
                "primary_team_channel_url": "https://www.youtube.com/@ALLDAY_PROJECT",
                "channels": [
                    {
                        "channel_url": "https://www.youtube.com/@ALLDAY_PROJECT",
                        "owner_type": "team",
                        "display_in_team_links": True,
                    }
                ],
            },
            "Hearts2Hearts": {
                "primary_team_channel_url": "https://www.youtube.com/@SMTOWN",
                "channels": [
                    {
                        "channel_url": "https://www.youtube.com/@SMTOWN",
                        "owner_type": "team",
                        "display_in_team_links": True,
                    }
                ],
            },
        }
        fetcher = stub_fetcher_factory(
            {
                "https://www.youtube.com/@ALLDAY_PROJECT": """
                <html>
                  <head>
                    <meta property="og:image" content="https://yt3.googleusercontent.com/allday=s900-c-k-c0x00ffffff-no-rj" />
                  </head>
                  <body>"channelId":"UCg8ZzloDPTrOiGztK0C9txQ"</body>
                </html>
                """,
                "https://www.instagram.com/hearts2hearts": """
                <html>
                  <head>
                    <meta property="og:image" content="https://scontent.example/hearts2hearts.jpg" />
                  </head>
                </html>
                """,
            }
        )

        rows, summary = build_badge_rows(profiles, existing_rows, allowlists_by_group, fetcher)

        groups = {row["group"] for row in rows}
        self.assertIn("ALLDAY PROJECT", groups)
        self.assertIn("Hearts2Hearts", groups)
        hearts_row = next(row for row in rows if row["group"] == "Hearts2Hearts")
        self.assertEqual(hearts_row["badge_kind"], "official_social_avatar")
        self.assertEqual(summary["added"], 2)
        self.assertEqual(summary["skipped_agency_only"], 0)


if __name__ == "__main__":
    unittest.main()
