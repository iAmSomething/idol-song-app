import json
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

import non_runtime_dataset_paths


ROOT = Path(__file__).resolve().parent
ARTIST_PROFILES_PATH = non_runtime_dataset_paths.resolve_input_path("artistProfiles.json")
SEED_PATH = ROOT / "entity_metadata_acquisition_seed.json"
OUTPUT_PATH = ROOT / "entity_metadata_acquisition.json"
USER_AGENT = "Mozilla/5.0 (compatible; idol-song-app-entity-metadata/1.0)"
YOUTUBE_HANDLE_TEMPLATE = "https://www.youtube.com/@{handle}"
FETCH_TIMEOUT_SECONDS = 8
PROBE_FIELDS = ("official_youtube",)
FIELD_KEYS = ("official_youtube", "official_x", "official_instagram", "agency_name")
PROBE_CACHE: Dict[str, Optional[Dict[str, str]]] = {}


def load_json(path: Path) -> Any:
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


def normalize_handle(value: Any) -> Optional[str]:
    text = optional_text(value)
    if text is None:
        return None
    return text.lstrip("@")


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def extract_handle(url: Any) -> Optional[str]:
    text = normalize_url(url)
    if text is None:
        return None
    path = urlsplit(text).path.strip("/")
    if not path:
        return None
    return path.split("/")[-1].lstrip("@")


def build_slug_tokens(slug: str, group: str) -> List[str]:
    raw_tokens = {
        normalize_token(slug),
        normalize_token(slug.replace("-", "")),
        normalize_token(group),
        normalize_token(group.replace(" ", "")),
    }
    return [token for token in raw_tokens if token]


def build_youtube_probe_candidates(profile: Dict[str, Any], seed_row: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []
    for key in ("official_youtube_url", "official_x_url", "official_instagram_url"):
        handle = extract_handle(seed_row.get(key) or profile.get(key))
        if handle and handle not in candidates:
            candidates.append(handle)
    for handle in seed_row.get("official_youtube_candidates", []) or []:
        normalized = normalize_handle(handle)
        if normalized and normalized not in candidates:
            candidates.append(normalized)
    return candidates


def fetch_url(url: str) -> Optional[str]:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            return response.read().decode("utf-8", "ignore")
    except (HTTPError, URLError, TimeoutError):
        return None


def extract_meta(html: str, pattern: str) -> Optional[str]:
    match = re.search(pattern, html)
    if match is None:
        return None
    return optional_text(match.group(1))


def probe_youtube_handle(handle: str) -> Optional[Dict[str, str]]:
    cached = PROBE_CACHE.get(handle)
    if cached is not None:
        return dict(cached)

    url = YOUTUBE_HANDLE_TEMPLATE.format(handle=handle)
    html = fetch_url(url)
    if html is None:
        PROBE_CACHE[handle] = None
        return None
    og_title = extract_meta(html, r'<meta property="og:title" content="([^"]+)"')
    canonical = extract_meta(html, r'"canonicalBaseUrl":"([^"]+)"')
    if og_title is None or canonical is None:
        return None
    canonical_url = normalize_url(f"https://www.youtube.com{canonical}")
    if canonical_url is None:
        PROBE_CACHE[handle] = None
        return None
    probe = {
        "url": canonical_url,
        "og_title": og_title,
        "canonical_handle": canonical.split("/")[-1].lstrip("@"),
    }
    PROBE_CACHE[handle] = dict(probe)
    return probe


def youtube_probe_matches(profile: Dict[str, Any], candidate_handle: str, probe: Dict[str, str]) -> bool:
    slug_tokens = build_slug_tokens(profile["slug"], profile["group"])
    title_token = normalize_token(probe["og_title"])
    canonical_token = normalize_token(probe["canonical_handle"])
    candidate_token = normalize_token(candidate_handle)
    if candidate_token == canonical_token:
        return True
    return any(token and (token == title_token or token == canonical_token) for token in slug_tokens)


def resolved_field(
    value: Any,
    *,
    provenance: str,
    source_url: Optional[str],
    review_notes: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "value": value,
        "status": "resolved",
        "provenance": provenance,
        "source_url": source_url,
        "review_notes": review_notes,
    }


def build_seed_field(seed_row: Dict[str, Any], field_key: str) -> Optional[Dict[str, Any]]:
    value_key = {
        "official_youtube": "official_youtube_url",
        "official_x": "official_x_url",
        "official_instagram": "official_instagram_url",
        "agency_name": "agency_name",
    }[field_key]
    value = optional_text(seed_row.get(value_key))
    if value is None:
        return None
    if field_key != "agency_name":
        value = normalize_url(value)
    source_key = {
        "official_youtube": "official_youtube_source",
        "official_x": "official_x_source",
        "official_instagram": "official_instagram_source",
        "agency_name": "agency_name_source",
    }[field_key]
    source_url_key = {
        "official_youtube": "official_youtube_source_url",
        "official_x": "official_x_source_url",
        "official_instagram": "official_instagram_source_url",
        "agency_name": "agency_name_source_url",
    }[field_key]
    review_notes_key = {
        "official_youtube": "official_youtube_review_notes",
        "official_x": "official_x_review_notes",
        "official_instagram": "official_instagram_review_notes",
        "agency_name": "agency_name_review_notes",
    }[field_key]
    return resolved_field(
        value,
        provenance=optional_text(seed_row.get(source_key)) or f"entityMetadataAcquisition.manual_seed.{field_key}",
        source_url=normalize_url(seed_row.get(source_url_key) or value),
        review_notes=optional_text(seed_row.get(review_notes_key)),
    )


def build_row(profile: Dict[str, Any], seed_row: Dict[str, Any]) -> Dict[str, Any]:
    fields: Dict[str, Dict[str, Any]] = {}

    # Resolved seed data always wins because it is already reviewed.
    for field_key in FIELD_KEYS:
        seed_field = build_seed_field(seed_row, field_key)
        if seed_field is not None:
            fields[field_key] = seed_field

    if "official_youtube" not in fields:
        candidates = build_youtube_probe_candidates(profile, seed_row)
        for handle in candidates:
            probe = probe_youtube_handle(handle)
            if probe is None:
                continue
            if not youtube_probe_matches(profile, handle, probe):
                continue
            fields["official_youtube"] = resolved_field(
                probe["url"],
                provenance="entityMetadataAcquisition.youtube_handle_probe",
                source_url=probe["url"],
                review_notes=f"Verified from @{handle} handle probe against the official social handle pattern.",
            )
            break

    return {
        "group": profile["group"],
        "slug": profile["slug"],
        "fields": fields,
    }


def build_summary(rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    field_counts = {key: 0 for key in FIELD_KEYS}
    row_count = 0
    for row in rows:
        row_count += 1
        for field_key in FIELD_KEYS:
            if field_key in row["fields"]:
                field_counts[field_key] += 1
    return {"row_count": row_count, "resolved_field_counts": field_counts}


def main() -> None:
    artist_profiles = load_json(ARTIST_PROFILES_PATH)
    seed_rows = load_json(SEED_PATH)
    seed_by_slug = {row["slug"]: row for row in seed_rows}

    rows: List[Dict[str, Any]] = []
    for profile in sorted(artist_profiles, key=lambda row: row["group"].casefold()):
        seed_row = seed_by_slug.get(profile["slug"], {"slug": profile["slug"], "group": profile["group"]})
        rows.append(build_row(profile, seed_row))

    rows = [row for row in rows if row["fields"]]
    write_json(OUTPUT_PATH, rows)
    print(
        json.dumps(
            {
                "input_json": str(ARTIST_PROFILES_PATH.relative_to(ROOT)),
                "output_json": str(OUTPUT_PATH.relative_to(ROOT)),
                **build_summary(rows),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
