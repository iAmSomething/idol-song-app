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

    def test_acquisition_overlay_wins_for_reviewed_fields(self):
        base_map = {
            "official_youtube": module.review_needed_field(
                provenance="youtubeChannelAllowlists.primary_team_channel_url.review_needed"
            ),
            "official_x": module.review_needed_field(
                provenance="artistSocialsStructured.x_url.review_needed"
            ),
            "official_instagram": module.review_needed_field(
                provenance="artistSocialsStructured.instagram_url.review_needed"
            ),
            "agency_name": module.review_needed_field(provenance="artistProfiles.agency.review_needed"),
            "debut_year": module.review_needed_field(provenance="artistProfiles.debut_year.review_needed"),
            "representative_image": module.review_needed_field(
                provenance="teamBadgeAssets.badge_image_url.review_needed"
            ),
        }
        acquisition_fields = {
            "official_youtube": module.resolved_field(
                "https://www.youtube.com/@ALLDAY_PROJECT",
                provenance="entityMetadataAcquisition.reviewed_social_profile",
                source_url="https://www.youtube.com/@ALLDAY_PROJECT",
            ),
            "agency_name": module.resolved_field(
                "BPM Entertainment",
                provenance="entityMetadataAcquisition.reviewed_label_channel",
                source_url="https://www.youtube.com/@inkodeofficial",
            ),
        }

        overlaid = module.overlay_acquisition_fields(base_map, acquisition_fields)

        self.assertEqual(overlaid["official_youtube"]["value"], "https://www.youtube.com/@ALLDAY_PROJECT")
        self.assertEqual(overlaid["official_youtube"]["provenance"], "entityMetadataAcquisition.reviewed_social_profile")
        self.assertEqual(overlaid["agency_name"]["value"], "BPM Entertainment")
        self.assertEqual(overlaid["debut_year"]["status"], "review_needed")


if __name__ == "__main__":
    unittest.main()
