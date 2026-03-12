import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlsplit, urlunsplit

import non_runtime_dataset_paths


ROOT = Path(__file__).resolve().parent
ARTIST_PROFILES_DATASET = "artistProfiles.json"
TEAM_BADGE_ASSETS_DATASET = "teamBadgeAssets.json"
YOUTUBE_ALLOWLISTS_DATASET = "youtubeChannelAllowlists.json"
ARTIST_PROFILES_PATH = non_runtime_dataset_paths.resolve_input_path(ARTIST_PROFILES_DATASET)
ARTIST_SOCIALS_PATH = ROOT / "artist_socials_structured_2026-03-04.json"
TEAM_BADGE_ASSETS_PATH = non_runtime_dataset_paths.resolve_input_path(TEAM_BADGE_ASSETS_DATASET)
YOUTUBE_ALLOWLISTS_PATH = non_runtime_dataset_paths.resolve_input_path(YOUTUBE_ALLOWLISTS_DATASET)
ENTITY_METADATA_ACQUISITION_PATH = ROOT / "entity_metadata_acquisition.json"
OUTPUT_PATH = ROOT / "canonical_entity_metadata.json"

FIELD_KEYS = (
    "official_youtube",
    "official_x",
    "official_instagram",
    "agency_name",
    "debut_year",
    "representative_image",
)


def load_json(path: Path) -> List[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_url(value: Any) -> Optional[str]:
    text = optional_text(value)
    if text is None:
        return None
    parsed = urlsplit(text)
    path = parsed.path.rstrip("/") or parsed.path
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))


def normalize_year(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        year = int(value)
    except (TypeError, ValueError):
        return None
    if 1900 <= year <= 2100:
        return year
    return None


def normalize_source_url(value: Any) -> Optional[str]:
    text = optional_text(value)
    if text is None:
        return None
    return normalize_url(text)


def social_provenance(field_name: str, source_kind: Optional[str]) -> str:
    normalized = optional_text(source_kind) or "unspecified"
    return f"artistSocialsStructured.{field_name}.{normalized}"


def resolved_field(
    value: Any,
    *,
    provenance: str,
    source_url: Optional[str] = None,
    review_notes: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "value": value,
        "status": "resolved",
        "provenance": provenance,
        "source_url": source_url,
        "review_notes": review_notes,
    }


def review_needed_field(
    *,
    provenance: str,
    source_url: Optional[str] = None,
    review_notes: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "value": None,
        "status": "review_needed",
        "provenance": provenance,
        "source_url": source_url,
        "review_notes": review_notes,
    }


def choose_social_field(
    *,
    profile_value: Any,
    profile_provenance: Any,
    profile_source_url: Any,
    default_profile_provenance: str,
    social_value: Any,
    social_source_kind: Any,
    social_source_url: Any,
    social_field_name: str,
) -> Dict[str, Any]:
    normalized_profile_value = normalize_url(profile_value)
    normalized_social_value = normalize_url(social_value)
    normalized_profile_source_url = normalize_source_url(profile_source_url)
    profile_provenance = optional_text(profile_provenance) or default_profile_provenance
    social_prov = social_provenance(social_field_name, social_source_kind)
    social_url = normalize_source_url(social_source_url)

    if normalized_profile_value and normalized_social_value and normalized_profile_value == normalized_social_value:
        return resolved_field(
            normalized_profile_value,
            provenance=social_prov if optional_text(social_source_kind) else profile_provenance,
            source_url=social_url,
        )

    if normalized_profile_value:
        return resolved_field(
            normalized_profile_value,
            provenance=profile_provenance,
            source_url=normalized_profile_source_url,
        )

    if normalized_social_value:
        return resolved_field(normalized_social_value, provenance=social_prov, source_url=social_url)

    return review_needed_field(
        provenance=f"{social_prov}.review_needed",
        review_notes="Collected social inventory has no defensible value yet.",
    )


def choose_youtube_field(
    *,
    profile_value: Any,
    profile_provenance: Any,
    profile_source_url: Any,
    allowlist_value: Any,
) -> Dict[str, Any]:
    normalized_profile_value = normalize_url(profile_value)
    normalized_allowlist_value = normalize_url(allowlist_value)
    normalized_profile_source_url = normalize_source_url(profile_source_url)
    profile_provenance = optional_text(profile_provenance) or "artistProfiles.official_youtube_url"

    if normalized_profile_value and normalized_allowlist_value and normalized_profile_value == normalized_allowlist_value:
        return resolved_field(
            normalized_profile_value,
            provenance="youtubeChannelAllowlists.primary_team_channel_url",
            source_url=normalized_allowlist_value,
        )

    if normalized_profile_value:
        return resolved_field(
            normalized_profile_value,
            provenance=profile_provenance,
            source_url=normalized_profile_source_url,
        )

    if normalized_allowlist_value:
        return resolved_field(
            normalized_allowlist_value,
            provenance="youtubeChannelAllowlists.primary_team_channel_url",
            source_url=normalized_allowlist_value,
        )

    return review_needed_field(
        provenance="youtubeChannelAllowlists.primary_team_channel_url.review_needed",
        review_notes="Primary team channel is still missing from the allowlist seed.",
    )


def choose_scalar_field(
    value: Any,
    *,
    provenance: str,
    source_url: Any = None,
    missing_review_notes: str,
) -> Dict[str, Any]:
    normalized_value = optional_text(value)
    if normalized_value is not None:
        return resolved_field(normalized_value, provenance=provenance, source_url=normalize_source_url(source_url))
    return review_needed_field(
        provenance=f"{provenance}.review_needed",
        source_url=normalize_source_url(source_url),
        review_notes=missing_review_notes,
    )


def choose_year_field(
    value: Any,
    *,
    provenance: str,
    missing_review_notes: str,
) -> Dict[str, Any]:
    normalized_value = normalize_year(value)
    if normalized_value is not None:
        return resolved_field(normalized_value, provenance=provenance)
    return review_needed_field(
        provenance=f"{provenance}.review_needed",
        review_notes=missing_review_notes,
    )


def choose_representative_image_field(
    *,
    profile_value: Any,
    profile_provenance: Any,
    profile_source_url: Any,
    badge_image_url: Any,
    badge_source_url: Any,
) -> Dict[str, Any]:
    normalized_profile_value = normalize_url(profile_value)
    normalized_badge_value = normalize_url(badge_image_url)
    normalized_profile_source_url = normalize_source_url(profile_source_url)
    profile_provenance = optional_text(profile_provenance) or "artistProfiles.representative_image_url"
    badge_source = normalize_source_url(badge_source_url)

    if normalized_profile_value and normalized_badge_value and normalized_profile_value == normalized_badge_value:
        return resolved_field(
            normalized_profile_value,
            provenance="teamBadgeAssets.badge_image_url",
            source_url=badge_source,
        )

    if normalized_profile_value:
        return resolved_field(
            normalized_profile_value,
            provenance=profile_provenance,
            source_url=normalized_profile_source_url,
        )

    if normalized_badge_value:
        return resolved_field(
            normalized_badge_value,
            provenance="teamBadgeAssets.badge_image_url",
            source_url=badge_source,
        )

    return review_needed_field(
        provenance="teamBadgeAssets.badge_image_url.review_needed",
        review_notes="Representative image has no verified upstream seed yet.",
    )


def build_field_map(
    profile: Dict[str, Any],
    social_row: Dict[str, Any],
    badge_row: Dict[str, Any],
    allowlist_row: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    return {
        "official_x": choose_social_field(
            profile_value=profile.get("official_x_url"),
            profile_provenance=profile.get("official_x_source"),
            profile_source_url=profile.get("official_x_source_url"),
            default_profile_provenance="artistProfiles.official_x_url",
            social_value=social_row.get("x_url"),
            social_source_kind=social_row.get("x_source"),
            social_source_url=social_row.get("wikidata_source"),
            social_field_name="x_url",
        ),
        "official_instagram": choose_social_field(
            profile_value=profile.get("official_instagram_url"),
            profile_provenance=profile.get("official_instagram_source"),
            profile_source_url=profile.get("official_instagram_source_url"),
            default_profile_provenance="artistProfiles.official_instagram_url",
            social_value=social_row.get("instagram_url"),
            social_source_kind=social_row.get("instagram_source"),
            social_source_url=social_row.get("wikidata_source"),
            social_field_name="instagram_url",
        ),
        "official_youtube": choose_youtube_field(
            profile_value=profile.get("official_youtube_url"),
            profile_provenance=profile.get("official_youtube_source"),
            profile_source_url=profile.get("official_youtube_source_url"),
            allowlist_value=allowlist_row.get("primary_team_channel_url"),
        ),
        "agency_name": choose_scalar_field(
            profile.get("agency"),
            provenance=optional_text(profile.get("agency_source")) or "artistProfiles.agency",
            source_url=profile.get("agency_source_url"),
            missing_review_notes="Agency is still missing in the canonical entity profile seed.",
        ),
        "debut_year": choose_year_field(
            profile.get("debut_year"),
            provenance=optional_text(profile.get("debut_year_source")) or "artistProfiles.debut_year",
            missing_review_notes="Debut year is still missing in the canonical entity profile seed.",
        ),
        "representative_image": choose_representative_image_field(
            profile_value=profile.get("representative_image_url"),
            profile_provenance=profile.get("representative_image_source"),
            profile_source_url=profile.get("representative_image_source_url"),
            badge_image_url=badge_row.get("badge_image_url"),
            badge_source_url=badge_row.get("badge_source_url"),
        ),
    }


def overlay_acquisition_fields(
    field_map: Dict[str, Dict[str, Any]],
    acquisition_fields: Dict[str, Any],
) -> Dict[str, Dict[str, Any]]:
    if not acquisition_fields:
        return field_map

    overlaid = dict(field_map)
    for field_key, acquisition_field in acquisition_fields.items():
        if field_key in FIELD_KEYS:
            overlaid[field_key] = acquisition_field
    return overlaid


def apply_fields_to_profile(profile: Dict[str, Any], field_map: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    updated = dict(profile)

    x_field = field_map["official_x"]
    updated["official_x_url"] = x_field["value"]
    updated["official_x_source"] = x_field["provenance"]
    updated["official_x_source_url"] = x_field["source_url"]
    updated["official_x_status"] = x_field["status"]

    instagram_field = field_map["official_instagram"]
    updated["official_instagram_url"] = instagram_field["value"]
    updated["official_instagram_source"] = instagram_field["provenance"]
    updated["official_instagram_source_url"] = instagram_field["source_url"]
    updated["official_instagram_status"] = instagram_field["status"]

    youtube_field = field_map["official_youtube"]
    updated["official_youtube_url"] = youtube_field["value"]
    updated["official_youtube_source"] = youtube_field["provenance"]
    updated["official_youtube_source_url"] = youtube_field["source_url"]
    updated["official_youtube_status"] = youtube_field["status"]

    agency_field = field_map["agency_name"]
    updated["agency"] = agency_field["value"]
    updated["agency_source"] = agency_field["provenance"]
    updated["agency_source_url"] = agency_field["source_url"]
    updated["agency_status"] = agency_field["status"]

    debut_field = field_map["debut_year"]
    updated["debut_year"] = debut_field["value"]
    updated["debut_year_source"] = debut_field["provenance"]
    updated["debut_year_status"] = debut_field["status"]

    representative_field = field_map["representative_image"]
    updated["representative_image_url"] = representative_field["value"]
    updated["representative_image_source"] = representative_field["provenance"]
    updated["representative_image_source_url"] = representative_field["source_url"]
    updated["representative_image_status"] = representative_field["status"]

    return updated


def build_metadata_rows(
    artist_profiles: List[Dict[str, Any]],
    social_rows: List[Dict[str, Any]],
    badge_rows: List[Dict[str, Any]],
    allowlist_rows: List[Dict[str, Any]],
    acquisition_rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    social_by_artist = {row["artist"]: row for row in social_rows if optional_text(row.get("artist"))}
    badge_by_group = {row["group"]: row for row in badge_rows if optional_text(row.get("group"))}
    allowlist_by_group = {row["group"]: row for row in allowlist_rows if optional_text(row.get("group"))}
    acquisition_by_slug = {row["slug"]: row for row in acquisition_rows if optional_text(row.get("slug"))}

    rows: List[Dict[str, Any]] = []
    updated_profiles: List[Dict[str, Any]] = []
    for profile in sorted(artist_profiles, key=lambda row: row["group"].casefold()):
        social_row = social_by_artist.get(profile["group"], {})
        badge_row = badge_by_group.get(profile["group"], {})
        allowlist_row = allowlist_by_group.get(profile["group"], {})
        acquisition_row = acquisition_by_slug.get(profile["slug"], {})
        field_map = build_field_map(profile, social_row, badge_row, allowlist_row)
        field_map = overlay_acquisition_fields(field_map, acquisition_row.get("fields", {}))
        updated_profiles.append(apply_fields_to_profile(profile, field_map))
        rows.append(
            {
                "group": profile["group"],
                "slug": profile["slug"],
                "fields": field_map,
            }
        )

    non_runtime_dataset_paths.write_json_dataset(ARTIST_PROFILES_DATASET, updated_profiles)
    return rows


def build_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    status_counts: Dict[str, Dict[str, int]] = {}
    resolved_counts: Dict[str, int] = {}

    for field_key in FIELD_KEYS:
        counts: Dict[str, int] = {}
        for row in rows:
            status = row["fields"][field_key]["status"]
            counts[status] = counts.get(status, 0) + 1
        status_counts[field_key] = dict(sorted(counts.items()))
        resolved_counts[field_key] = counts.get("resolved", 0)

    return {
        "entity_count": len(rows),
        "resolved_counts": resolved_counts,
        "status_counts": status_counts,
    }


def main() -> None:
    artist_profiles = load_json(ARTIST_PROFILES_PATH)
    social_rows = load_json(ARTIST_SOCIALS_PATH)
    badge_rows = load_json(TEAM_BADGE_ASSETS_PATH)
    allowlist_rows = load_json(YOUTUBE_ALLOWLISTS_PATH)
    acquisition_rows = load_json(ENTITY_METADATA_ACQUISITION_PATH) if ENTITY_METADATA_ACQUISITION_PATH.exists() else []

    rows = build_metadata_rows(artist_profiles, social_rows, badge_rows, allowlist_rows, acquisition_rows)
    write_json(OUTPUT_PATH, rows)
    profile_io = non_runtime_dataset_paths.describe_dataset_io(ARTIST_PROFILES_DATASET)

    print(
        json.dumps(
            {
                "artist_profiles_input_json": str(ARTIST_PROFILES_PATH.relative_to(ROOT)),
                "team_badge_assets_input_json": str(TEAM_BADGE_ASSETS_PATH.relative_to(ROOT)),
                "youtube_allowlists_input_json": str(YOUTUBE_ALLOWLISTS_PATH.relative_to(ROOT)),
                "output_json": str(OUTPUT_PATH.relative_to(ROOT)),
                "artist_profiles_primary_json": profile_io["primary_path"],
                "artist_profiles_mirror_json": profile_io["mirror_paths"],
                **build_summary(rows),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
