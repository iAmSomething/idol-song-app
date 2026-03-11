# Canonical Null Hygiene Cadence And Owner Checklist

이 문서는 canonical null hygiene를 ad hoc 정리 작업이 아니라 반복 운영 루틴으로 고정한다.

닫는 문제:

- `#583`: canonical null hygiene cadence / owner checklist

## 1. Cadence Model

| cadence | primary path | focus | required artifacts |
| --- | --- | --- | --- |
| daily | `weekly-kpop-scan.yml` | latest upcoming / latest release-adjacent Wave 1 null | `canonical_null_coverage_report.json`, `canonical_null_recheck_queue.json`, `null_coverage_trend_report.json`, `worker_cadence_report.json`, `report_bundle_metadata.json` |
| weekly | `catalog-enrichment-refresh.yml` | recent + historical enrichment after slow catalog refresh | 위 daily artifact + `historical_release_detail_coverage_report.json`, `migration_readiness_scorecard.json` |
| monthly | operator review | unresolved backlog aging, retry policy tuning, field taxonomy correction | latest weekly bundle + explicit issue / policy follow-up |

원칙:

- daily는 freshness를 지킨다.
- weekly는 enrichment completeness와 backlog reduction을 본다.
- monthly는 taxonomy / policy / ownership drift를 정리한다.

## 2. Daily Owner Checklist

1. `backend/reports/canonical_null_coverage_report.json`이 생성됐는지 확인한다.
2. `latest` cohort Wave 1 family floor miss가 생겼는지 본다.
3. `fake_default`가 새로 생긴 family가 있는지 본다.
4. `backend/reports/canonical_null_recheck_queue.json`에서 `review_state=escalate_review` 항목을 triage한다.
5. `null_coverage_trend_report.json`에 latest regression이 생기면 same-day follow-up issue를 연다.
6. `report_bundle_metadata.json`과 downstream runtime artifacts bundle id가 맞는지 확인한다.

## 3. Weekly Owner Checklist

1. slow enrichment run 이후 `canonical_null_coverage_report.json`과 `historical_release_detail_coverage_report.json`을 같이 본다.
2. `recent` cohort Wave 1 miss가 2개 이상이면 blocker 후보로 승격한다.
3. `pre-2024` coverage가 내려갔으면 enrichment regression으로 기록한다.
4. `canonical_null_recheck_queue.json`에서 `retry_count`가 높은 historical item을 review queue / override / source rule 중 어디로 보낼지 결정한다.
5. `migration_readiness_scorecard.json`의 `catalog_completeness` summary가 null-hygiene reason으로 막히는지 확인한다.

## 4. Monthly Checklist

1. field family taxonomy가 실제 데이터와 맞지 않는 false positive를 만들고 있지 않은지 검토한다.
2. `conditional_null`과 `true_optional` 분류가 여전히 방어 가능한지 확인한다.
3. retry cadence가 너무 빠르거나 느린 cohort가 없는지 본다.
4. owner handoff 문구와 artifact 목록이 workflow 실제 산출물과 일치하는지 점검한다.

## 5. Escalation Rules

- latest Wave 1 family floor miss: same-day blocker 후보
- latest Wave 1 regression budget 초과: blocker
- recent Wave 1 floor miss 1건: `needs_review`
- recent Wave 1 floor miss 2건 이상: blocker
- fake default detection: source fix 또는 override provenance 확인 전까지 reopen 금지
- historical regression: weekly review에서 triage, 필요 시 slow enrichment follow-up

## 6. Artifact Handoff Contract

daily / weekly run이 끝나면 아래 순서를 유지한다.

1. DB sync
2. projection refresh
3. null coverage
4. null recheck queue
5. null trend
6. report bundle
7. parity / shadow / runtime / readiness

이 순서가 깨지면 downstream gate가 stale artifact를 읽을 수 있으므로, 운영자는 freshness보다 sequence를 먼저 확인한다.
