import unittest

import release_detail_acquisition as acquisition


class ReleaseDetailAcquisitionTests(unittest.TestCase):
    def test_actionable_fields_include_youtube_music_and_mv(self) -> None:
        detail = {
            "tracks": [{"order": 1, "title": "Example"}],
            "spotify_url": "https://open.spotify.com/album/example",
            "youtube_music_url": None,
            "youtube_video_url": None,
            "youtube_video_id": None,
        }

        self.assertEqual(
            acquisition.get_actionable_release_detail_fields(detail),
            ["youtube_music_url", "youtube_video"],
        )


if __name__ == "__main__":
    unittest.main()
