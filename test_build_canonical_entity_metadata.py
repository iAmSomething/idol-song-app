import unittest

import build_canonical_entity_metadata as module


class CanonicalEntityMetadataTests(unittest.TestCase):
    def test_prefers_social_source_when_profile_and_social_match(self):
        field = module.choose_social_field(
            profile_value="https://x.com/CH_CHUN9HA",
            profile_provenance=None,
            profile_source_url=None,
            default_profile_provenance="artistProfiles.official_x_url",
            social_value="https://x.com/CH_CHUN9HA/",
            social_source_kind="wikidata_direct",
            social_source_url="https://www.wikidata.org/wiki/Q12970165",
            social_field_name="x_url",
        )

        self.assertEqual(field["value"], "https://x.com/CH_CHUN9HA")
        self.assertEqual(field["status"], "resolved")
        self.assertEqual(field["provenance"], "artistSocialsStructured.x_url.wikidata_direct")
        self.assertEqual(field["source_url"], "https://www.wikidata.org/wiki/Q12970165")

    def test_promotes_badge_asset_to_representative_image(self):
        field = module.choose_representative_image_field(
            profile_value=None,
            profile_provenance=None,
            profile_source_url=None,
            badge_image_url="https://yt3.googleusercontent.com/avatar=s900-c-k-c0x00ffffff-no-rj",
            badge_source_url="https://www.youtube.com/channel/UC1234567890",
        )

        self.assertEqual(field["status"], "resolved")
        self.assertEqual(field["value"], "https://yt3.googleusercontent.com/avatar=s900-c-k-c0x00ffffff-no-rj")
        self.assertEqual(field["provenance"], "teamBadgeAssets.badge_image_url")
        self.assertEqual(field["source_url"], "https://www.youtube.com/channel/UC1234567890")

    def test_preserves_existing_profile_source_url_on_rerun(self):
        field = module.choose_social_field(
            profile_value="https://x.com/yena_official",
            profile_provenance="artistProfiles.official_x_url",
            profile_source_url="https://www.topstarnews.net/news/articleView.html?idxno=1234",
            default_profile_provenance="artistProfiles.official_x_url",
            social_value=None,
            social_source_kind=None,
            social_source_url=None,
            social_field_name="x_url",
        )

        self.assertEqual(field["source_url"], "https://www.topstarnews.net/news/articleView.html?idxno=1234")
        self.assertEqual(field["provenance"], "artistProfiles.official_x_url")


if __name__ == "__main__":
    unittest.main()
