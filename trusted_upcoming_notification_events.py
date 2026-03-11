import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence

import canonical_normalization


EVENT_TYPE = "trusted_upcoming_signal"
EVENT_REASONS = (
    "new_signal",
    "date_status_upgrade",
    "date_precision_gain",
    "confidence_threshold_crossed",
    "source_tier_upgrade",
)
SOURCE_TIER = {
    "manual": 0,
    "news_rss": 1,
    "official_social": 2,
    "weverse_notice": 3,
    "agency_notice": 4,
}
DATE_STATUS_LEVEL = {
    "rumor": 0,
    "scheduled": 1,
    "confirmed": 2,
}
DATE_PRECISION_LEVEL = {
    "unknown": 0,
    "month_only": 1,
    "exact": 2,
}
CONFIDENCE_BAND_LEVEL = {
    "low": 0,
    "trusted": 1,
    "high": 2,
}
REASON_PRIORITY = {
    "new_signal": 0,
    "date_status_upgrade": 1,
    "date_precision_gain": 2,
    "confidence_threshold_crossed": 3,
    "source_tier_upgrade": 4,
}
DEFAULT_COOLDOWN_HOURS = 24
TRUSTED_CONFIDENCE_MIN = 0.80
HIGH_CONFIDENCE_MIN = 0.90
TRUSTED_SOURCE_MIN_TIER = 2


def normalize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    return canonical_normalization.normalize_lookup_text(str(value))


def optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_timestamp(value: Any) -> Optional[datetime]:
    text = optional_text(value)
    if text is None:
        return None
    parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def isoformat_or_none(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def confidence_band(score: Optional[float]) -> str:
    value = float(score or 0)
    if value >= HIGH_CONFIDENCE_MIN:
        return "high"
    if value >= TRUSTED_CONFIDENCE_MIN:
        return "trusted"
    return "low"


def scheduled_bucket(snapshot: Dict[str, Any]) -> str:
    exact = optional_text(snapshot.get("scheduled_date"))
    if exact:
        return exact
    month = optional_text(snapshot.get("scheduled_month"))
    if month:
        return month
    return "unknown"


def pick_primary_source(source_rows: Sequence[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not source_rows:
        return None

    def sort_key(row: Dict[str, Any]) -> Any:
        published_at = parse_timestamp(row.get("published_at"))
        return (
            -SOURCE_TIER.get(optional_text(row.get("source_type")) or "", 0),
            -(published_at.timestamp() if published_at is not None else 0),
            optional_text(row.get("source_url")) or "",
        )

    return sorted(source_rows, key=sort_key)[0]


def build_fingerprint_key(snapshot: Dict[str, Any]) -> str:
    parts = [
        EVENT_TYPE,
        optional_text(snapshot.get("entity_slug")) or optional_text(snapshot.get("entity_id")) or "",
        normalize_text(snapshot.get("headline")),
        scheduled_bucket(snapshot),
        optional_text(snapshot.get("canonical_source_url")) or "",
    ]
    return "|".join(parts)


def is_trusted_signal(snapshot: Dict[str, Any]) -> bool:
    source_tier = int(snapshot.get("source_tier") or 0)
    score = float(snapshot.get("confidence_score") or 0)
    precision = optional_text(snapshot.get("date_precision")) or "unknown"
    status = optional_text(snapshot.get("date_status")) or "rumor"

    if source_tier >= TRUSTED_SOURCE_MIN_TIER:
        return True
    if score >= TRUSTED_CONFIDENCE_MIN and (precision != "unknown" or status in {"scheduled", "confirmed"}):
        return True
    return False


def build_destination(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "kind": "entity_detail",
        "entity_slug": snapshot["entity_slug"],
        "entity_id": snapshot["entity_id"],
        "upcoming_signal_id": snapshot["upcoming_signal_id"],
        "scheduled_bucket": scheduled_bucket(snapshot),
        "preferred_tab": "team",
    }


def build_state_snapshot(signal_row: Dict[str, Any], primary_source: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    source_type = optional_text(primary_source.get("source_type") if primary_source else None) or "manual"
    score = float(signal_row.get("confidence_score") or 0)
    snapshot = {
        "event_type": EVENT_TYPE,
        "entity_id": signal_row["entity_id"],
        "entity_slug": signal_row["entity_slug"],
        "entity_name": signal_row["entity_name"],
        "upcoming_signal_id": signal_row["upcoming_signal_id"],
        "headline": signal_row["headline"],
        "normalized_headline": normalize_text(signal_row["headline"]),
        "scheduled_date": optional_text(signal_row.get("scheduled_date")),
        "scheduled_month": optional_text(signal_row.get("scheduled_month")),
        "scheduled_bucket": scheduled_bucket(signal_row),
        "date_status": optional_text(signal_row.get("date_status")) or "rumor",
        "date_precision": optional_text(signal_row.get("date_precision")) or "unknown",
        "release_format": optional_text(signal_row.get("release_format")),
        "confidence_score": round(score, 2),
        "confidence_band": confidence_band(score),
        "source_type": source_type,
        "source_tier": SOURCE_TIER.get(source_type, 0),
        "canonical_source_url": optional_text(primary_source.get("source_url") if primary_source else None),
        "canonical_source_domain": optional_text(primary_source.get("source_domain") if primary_source else None),
        "published_at": isoformat_or_none(parse_timestamp(primary_source.get("published_at") if primary_source else None)),
        "evidence_summary": optional_text(primary_source.get("evidence_summary") if primary_source else None),
        "tracking_status": optional_text(signal_row.get("tracking_status")),
    }
    snapshot["fingerprint_key"] = build_fingerprint_key(snapshot)
    snapshot["destination"] = build_destination(snapshot)
    snapshot["is_trusted"] = is_trusted_signal(snapshot)
    return snapshot


def build_reason_key(reason: str, reason_value: str) -> str:
    return f"{reason}:{reason_value}"


def build_dedupe_key(snapshot: Dict[str, Any], reason: str, reason_value: str) -> str:
    return f"{snapshot['fingerprint_key']}|{reason}|{reason_value}"


def build_upgrade_candidates(previous_state: Optional[Dict[str, Any]], current_snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    if previous_state is None or not previous_state.get("is_active", True):
        if current_snapshot["is_trusted"]:
            return [
                {
                    "reason": "new_signal",
                    "reason_value": "trusted",
                    "severity_rank": 1,
                    "secondary_reasons": [],
                }
            ]
        return []

    if not current_snapshot["is_trusted"]:
        return []

    previous_status_level = DATE_STATUS_LEVEL.get(previous_state.get("latest_date_status") or "rumor", 0)
    current_status_level = DATE_STATUS_LEVEL[current_snapshot["date_status"]]
    previous_precision_level = DATE_PRECISION_LEVEL.get(previous_state.get("latest_date_precision") or "unknown", 0)
    current_precision_level = DATE_PRECISION_LEVEL[current_snapshot["date_precision"]]
    previous_band_level = CONFIDENCE_BAND_LEVEL.get(previous_state.get("latest_confidence_band") or "low", 0)
    current_band_level = CONFIDENCE_BAND_LEVEL[current_snapshot["confidence_band"]]
    previous_source_tier = int(previous_state.get("latest_source_tier") or 0)
    current_source_tier = int(current_snapshot["source_tier"])

    candidates: List[Dict[str, Any]] = []
    if current_status_level > previous_status_level and current_snapshot["date_status"] in {"scheduled", "confirmed"}:
        candidates.append(
            {
                "reason": "date_status_upgrade",
                "reason_value": current_snapshot["date_status"],
                "severity_rank": current_status_level,
            }
        )

    if current_precision_level > previous_precision_level and current_snapshot["date_precision"] != "unknown":
        candidates.append(
            {
                "reason": "date_precision_gain",
                "reason_value": current_snapshot["date_precision"],
                "severity_rank": current_precision_level,
            }
        )

    if current_band_level > previous_band_level and current_snapshot["confidence_band"] in {"trusted", "high"}:
        candidates.append(
            {
                "reason": "confidence_threshold_crossed",
                "reason_value": current_snapshot["confidence_band"],
                "severity_rank": current_band_level,
            }
        )

    if current_source_tier > previous_source_tier and current_source_tier >= TRUSTED_SOURCE_MIN_TIER:
        candidates.append(
            {
                "reason": "source_tier_upgrade",
                "reason_value": current_snapshot["source_type"],
                "severity_rank": current_source_tier,
            }
        )

    if not candidates and current_snapshot["is_trusted"] and previous_state.get("last_emitted_dedupe_key") is None:
        candidates.append(
            {
                "reason": "new_signal",
                "reason_value": "trusted",
                "severity_rank": 1,
            }
        )

    if not candidates:
        return []

    ordered = sorted(candidates, key=lambda item: (REASON_PRIORITY[item["reason"]], -item["severity_rank"]))
    primary = dict(ordered[0])
    primary["secondary_reasons"] = [build_reason_key(item["reason"], item["reason_value"]) for item in ordered[1:]]
    return [primary]


def build_event_payload(
    current_snapshot: Dict[str, Any],
    previous_state: Optional[Dict[str, Any]],
    candidate: Dict[str, Any],
    now: datetime,
    cooldown_hours: int = DEFAULT_COOLDOWN_HOURS,
) -> Dict[str, Any]:
    reason = candidate["reason"]
    reason_value = candidate["reason_value"]
    dedupe_key = build_dedupe_key(current_snapshot, reason, reason_value)
    cooldown_until = now + timedelta(hours=cooldown_hours)

    return {
        "event_type": EVENT_TYPE,
        "event_reason": reason,
        "event_reason_value": reason_value,
        "dedupe_key": dedupe_key,
        "cooldown_key": f"{current_snapshot['fingerprint_key']}|{reason}",
        "cooldown_until": cooldown_until,
        "status": "queued",
        "entity_id": current_snapshot["entity_id"],
        "entity_slug": current_snapshot["entity_slug"],
        "entity_name": current_snapshot["entity_name"],
        "upcoming_signal_id": current_snapshot["upcoming_signal_id"],
        "fingerprint_key": current_snapshot["fingerprint_key"],
        "canonical_destination": current_snapshot["destination"],
        "secondary_reasons": candidate.get("secondary_reasons") or [],
        "payload": {
            "entity": {
                "id": current_snapshot["entity_id"],
                "slug": current_snapshot["entity_slug"],
                "name": current_snapshot["entity_name"],
            },
            "headline": current_snapshot["headline"],
            "date_status": current_snapshot["date_status"],
            "date_precision": current_snapshot["date_precision"],
            "scheduled_date": current_snapshot.get("scheduled_date"),
            "scheduled_month": current_snapshot.get("scheduled_month"),
            "scheduled_bucket": current_snapshot["scheduled_bucket"],
            "release_format": current_snapshot.get("release_format"),
            "confidence_score": current_snapshot["confidence_score"],
            "confidence_band": current_snapshot["confidence_band"],
            "reason": reason,
            "reason_value": reason_value,
            "secondary_reasons": candidate.get("secondary_reasons") or [],
            "source": {
                "type": current_snapshot["source_type"],
                "tier": current_snapshot["source_tier"],
                "url": current_snapshot.get("canonical_source_url"),
                "domain": current_snapshot.get("canonical_source_domain"),
                "published_at": current_snapshot.get("published_at"),
                "evidence_summary": current_snapshot.get("evidence_summary"),
            },
            "canonical_destination": current_snapshot["destination"],
            "tracking_status": current_snapshot.get("tracking_status"),
            "previous_snapshot": previous_state.get("payload") if previous_state else None,
            "current_snapshot": current_snapshot,
            "cooldown_until": isoformat_or_none(cooldown_until),
            "generated_at": isoformat_or_none(now),
        },
    }


def build_updated_state(
    current_snapshot: Dict[str, Any],
    previous_state: Optional[Dict[str, Any]],
    emitted_event: Optional[Dict[str, Any]],
    now: datetime,
) -> Dict[str, Any]:
    state = {
        "event_type": EVENT_TYPE,
        "entity_id": current_snapshot["entity_id"],
        "upcoming_signal_id": current_snapshot["upcoming_signal_id"],
        "fingerprint_key": current_snapshot["fingerprint_key"],
        "canonical_source_url": current_snapshot.get("canonical_source_url"),
        "canonical_source_domain": current_snapshot.get("canonical_source_domain"),
        "scheduled_bucket": current_snapshot["scheduled_bucket"],
        "latest_date_status": current_snapshot["date_status"],
        "latest_date_precision": current_snapshot["date_precision"],
        "latest_confidence_score": current_snapshot["confidence_score"],
        "latest_confidence_band": current_snapshot["confidence_band"],
        "latest_source_type": current_snapshot["source_type"],
        "latest_source_tier": current_snapshot["source_tier"],
        "is_active": True,
        "is_trusted": current_snapshot["is_trusted"],
        "last_seen_at": now,
        "payload": current_snapshot,
        "last_emitted_dedupe_key": previous_state.get("last_emitted_dedupe_key") if previous_state else None,
        "last_emitted_reason": previous_state.get("last_emitted_reason") if previous_state else None,
        "last_emitted_reason_value": previous_state.get("last_emitted_reason_value") if previous_state else None,
        "last_emitted_at": previous_state.get("last_emitted_at") if previous_state else None,
        "cooldown_until": previous_state.get("cooldown_until") if previous_state else None,
    }

    if emitted_event is not None:
        state["last_emitted_dedupe_key"] = emitted_event["dedupe_key"]
        state["last_emitted_reason"] = emitted_event["event_reason"]
        state["last_emitted_reason_value"] = emitted_event["event_reason_value"]
        state["last_emitted_at"] = now
        state["cooldown_until"] = emitted_event["cooldown_until"]

    return state


def build_operator_alert_report(
    evaluations: Sequence[Dict[str, Any]],
    *,
    generated_at: datetime,
    summary_path: str,
) -> Dict[str, Any]:
    totals = {
        "signals_considered": len(evaluations),
        "trusted_signals": 0,
        "events_emitted": 0,
        "suppressed_unchanged": 0,
        "suppressed_untrusted": 0,
        "emitted_by_reason": {},
        "suppressed_by_reason": {},
    }
    emitted_events: List[Dict[str, Any]] = []
    suppressed_samples: List[Dict[str, Any]] = []

    for item in evaluations:
        snapshot = item["snapshot"]
        if snapshot["is_trusted"]:
            totals["trusted_signals"] += 1

        if item["event"] is not None:
            reason = item["event"]["event_reason"]
            totals["events_emitted"] += 1
            totals["emitted_by_reason"][reason] = totals["emitted_by_reason"].get(reason, 0) + 1
            emitted_events.append(
                {
                    "entity": snapshot["entity_name"],
                    "entity_slug": snapshot["entity_slug"],
                    "headline": snapshot["headline"],
                    "reason": reason,
                    "reason_value": item["event"]["event_reason_value"],
                    "secondary_reasons": item["event"]["secondary_reasons"],
                    "date_status": snapshot["date_status"],
                    "date_precision": snapshot["date_precision"],
                    "confidence_score": snapshot["confidence_score"],
                    "source_type": snapshot["source_type"],
                    "source_url": snapshot.get("canonical_source_url"),
                    "evidence_link": snapshot.get("canonical_source_url"),
                    "destination": snapshot["destination"],
                    "dedupe_key": item["event"]["dedupe_key"],
                }
            )
            continue

        suppression_reason = item["suppression_reason"]
        if suppression_reason == "untrusted":
            totals["suppressed_untrusted"] += 1
        else:
            totals["suppressed_unchanged"] += 1
        totals["suppressed_by_reason"][suppression_reason] = totals["suppressed_by_reason"].get(suppression_reason, 0) + 1
        if len(suppressed_samples) < 10:
            suppressed_samples.append(
                {
                    "entity": snapshot["entity_name"],
                    "headline": snapshot["headline"],
                    "suppression_reason": suppression_reason,
                    "date_status": snapshot["date_status"],
                    "date_precision": snapshot["date_precision"],
                    "confidence_score": snapshot["confidence_score"],
                    "source_type": snapshot["source_type"],
                }
            )

    summary_lines = [
        f"trusted upcoming alerts: emitted {totals['events_emitted']} / trusted {totals['trusted_signals']} / considered {totals['signals_considered']}",
        f"unchanged suppressed: {totals['suppressed_unchanged']}, untrusted suppressed: {totals['suppressed_untrusted']}",
    ]
    if totals["emitted_by_reason"]:
        reason_line = ", ".join(
            f"{reason}={count}"
            for reason, count in sorted(totals["emitted_by_reason"].items(), key=lambda item: item[0])
        )
        summary_lines.append(f"emitted by reason: {reason_line}")
    else:
        summary_lines.append("emitted by reason: none")

    return {
        "generated_at": isoformat_or_none(generated_at),
        "event_type": EVENT_TYPE,
        "summary_path": summary_path,
        "totals": totals,
        "emitted_events": emitted_events,
        "suppressed_samples": suppressed_samples,
        "summary_lines": summary_lines,
    }


def render_operator_alert_markdown(report: Dict[str, Any]) -> str:
    lines = [
        "# Trusted Upcoming Operator Alerts",
        "",
        f"- Generated at: {report['generated_at']}",
        f"- Considered: {report['totals']['signals_considered']}",
        f"- Trusted: {report['totals']['trusted_signals']}",
        f"- Emitted: {report['totals']['events_emitted']}",
        f"- Suppressed unchanged: {report['totals']['suppressed_unchanged']}",
        f"- Suppressed untrusted: {report['totals']['suppressed_untrusted']}",
        "",
        "## Emitted Events",
    ]

    if report["emitted_events"]:
        for event in report["emitted_events"]:
            lines.append(
                f"- {event['entity']} | {event['reason']}:{event['reason_value']} | {event['headline']} | "
                f"{event['date_status']} / {event['date_precision']} / {event['confidence_score']}"
            )
            if event.get("evidence_link"):
                lines.append(f"  - evidence: {event['evidence_link']}")
    else:
        lines.append("- none")

    lines.extend(["", "## Suppressed Samples"])
    if report["suppressed_samples"]:
        for sample in report["suppressed_samples"]:
            lines.append(
                f"- {sample['entity']} | {sample['suppression_reason']} | {sample['headline']} | "
                f"{sample['date_status']} / {sample['date_precision']} / {sample['confidence_score']}"
            )
    else:
        lines.append("- none")

    lines.append("")
    return "\n".join(lines)


def serialize_state_payload(value: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(value)
    for key in ("last_seen_at", "last_emitted_at", "cooldown_until"):
        if isinstance(serialized.get(key), datetime):
            serialized[key] = isoformat_or_none(serialized[key])
    return serialized


def serialize_event_payload(value: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(value)
    for key in ("cooldown_until",):
        if isinstance(serialized.get(key), datetime):
            serialized[key] = isoformat_or_none(serialized[key])
    return serialized
