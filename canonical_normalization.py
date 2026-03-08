import re
import unicodedata
from typing import Tuple


def normalize_lookup_text(value: str) -> str:
    return (
        unicodedata.normalize("NFKC", value)
        .replace("×", "x")
        .replace("✕", "x")
        .replace("&", " and ")
        .lower()
        .replace("'", "")
        .replace("’", "")
        .replace("`", "")
    )


def collapse_normalized_text(value: str) -> str:
    collapsed = re.sub(r"[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+", " ", value)
    collapsed = re.sub(r"\s+", " ", collapsed).strip()
    return collapsed


def normalize_alias_value(value: str) -> str:
    return collapse_normalized_text(normalize_lookup_text(value))


def normalize_release_lookup_title(value: str) -> str:
    return normalize_alias_value(value)


def normalize_slug_value(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    normalized = re.sub(r"[^a-z0-9_-]+", "-", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized)
    return normalized.strip("-_")


def build_release_lookup_key(entity_slug: str, release_title: str, release_date: str, stream: str) -> Tuple[str, str, str, str]:
    return (
        normalize_slug_value(entity_slug),
        normalize_release_lookup_title(release_title),
        release_date.strip(),
        stream.strip().lower(),
    )
