# Migration Operations Runbook

이 문서는 backend migration 기간에 운영자가 실제로 따라야 하는 절차를 한 곳에 모은 runbook이다.
목표는 architecture 설명이 아니라 "지금 무엇을 실행하고, 어떤 산출물을 보고, 언제 fallback/rollback 하는가"를 빠르게 판단하게 하는 것이다.

## 1. 적용 범위

이 runbook은 아래 상황을 다룬다.

- schema / import / dual-write / projection refresh
- read API, worker, Pages build의 운영 책임
- parity / shadow / runtime gate 확인
- staged cutover 중 source switch 운영
- review queue / override / debug touchpoint
- JSON artifact가 아직 남아 있는 동안의 emergency fallback

## 2. Operator Preflight

작업 전 항상 아래를 먼저 확인한다.

1. 어떤 환경에서 작업하는지 확인한다.
   - local
   - preview
   - production
2. 현재 DB target과 env file이 맞는지 확인한다.
   - preview: `~/.config/idol-song-app/neon.preview.env`
   - production: `~/.config/idol-song-app/neon.env`
3. 이번 작업이 아래 중 어느 종류인지 결정한다.
   - bootstrap / repair import
   - normal refresh
   - cutover rehearsal
   - rollback / fallback
4. committed JSON은 source-of-truth가 아니라 fallback/export artifact라는 점을 전제로 시작한다.

## 3. Command Map

| task | command | primary artifact |
| --- | --- | --- |
| schema apply | `cd backend && npm run migrate:apply` | DB schema |
| schema verify | `cd backend && npm run schema:verify` | console verify output |
| baseline import / repair | `python3 import_json_to_neon.py` | `backend/reports/json_to_neon_import_summary.json` |
| release dual-write | `python3 sync_release_pipeline_to_neon.py` | `backend/reports/release_pipeline_db_sync_summary.json` |
| upcoming dual-write | `python3 sync_upcoming_pipeline_to_neon.py` | `backend/reports/upcoming_pipeline_db_sync_summary.json` |
| projection refresh | `cd backend && npm run projection:refresh` | `backend/reports/projection_refresh_summary.json` |
| report bundle metadata | `cd backend && npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming` | `backend/reports/report_bundle_metadata.json` |
| backend freshness handoff | `cd backend && npm run freshness:handoff -- --target production --backend-public-url <url>` | `backend/reports/backend_freshness_handoff.json` |
| backend-vs-JSON parity | `python3 build_backend_json_parity_report.py` | `backend/reports/backend_json_parity_report.json` |
| endpoint shadow verify | `cd backend && npm run shadow:verify` | `backend/reports/backend_shadow_read_report.json` |
| runtime latency / error sample | `cd backend && npm run runtime:measure -- --base-url <url>` | `backend/reports/read_api_runtime_measurements.json` |
| worker cadence sample | `cd backend && npm run worker:cadence` | `backend/reports/worker_cadence_report.json` |
| combined runtime gate | `cd backend && npm run runtime:gate` | `backend/reports/runtime_gate_report.json` |
| migration readiness scorecard | `cd backend && npm run migration:scorecard` | `backend/reports/migration_readiness_scorecard.json`, `backend/reports/migration_readiness_scorecard.md` |

## 4. Responsibility Split

| concern | owned by | operator expectation |
| --- | --- | --- |
| canonical write model | importer / sync scripts | idempotent write summary 확인 |
| projection read model | backend projection refresh | refresh lag와 row count 확인 |
| read API runtime | Fastify service | `/health`, `/ready`, representative endpoint smoke |
| worker cadence | daily fast path + slow enrichment workflow | fast freshness와 slow catalog enrichment cadence를 각각 확인 |
| user-facing read path | Pages build + source switch | cut-over surface 기본값과 rollback 경로 확인 |
| review/debug state | JSON queues + review endpoints + override files | unresolved를 triage하고 provenance 유지 |

## 5. Normal Refresh Flow

이 흐름은 "현재 canonical DB와 projection을 정상 운영 상태로 갱신"하는 가장 일반적인 순서다.

1. env 로드

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a
```

2. schema apply / verify

```bash
cd backend
npm run migrate:apply
npm run schema:verify
cd ..
```

3. data write

bootstrap / repair import가 필요하면:

```bash
python3 import_json_to_neon.py
```

일상 refresh에서는 dual-write만 돌린다.

```bash
python3 sync_release_pipeline_to_neon.py
python3 sync_upcoming_pipeline_to_neon.py
```

4. projection refresh

```bash
cd backend
npm run projection:refresh
cd ..
```

5. verification

```bash
cd backend
npm run worker:cadence
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
cd ..
python3 build_backend_json_parity_report.py
cd backend
npm run shadow:verify -- --bundle-path ./reports/report_bundle_metadata.json
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
npm run freshness:handoff -- --target production --backend-public-url <url> --bundle-path ./reports/report_bundle_metadata.json
npm run migration:scorecard -- --bundle-path ./reports/report_bundle_metadata.json
cd ..
```

6. interpretation

- parity clean이 아니면 canonical write나 projection semantics를 먼저 고친다.
- shadow clean이 아니면 cutover advance를 멈춘다.
- runtime gate가 `fail`이면 refresh는 끝났더라도 cutover 근거로 쓰지 않는다.
- migration readiness scorecard에서 blocker-grade category가 `fail`이면 milestone / cutover decision을 advance하지 않는다.

## 6. Representative Refresh Path

runbook을 따라 한 번 실제로 걷는 최소 경로는 아래다.

1. `npm run schema:verify`
2. `npm run projection:refresh`
3. `python3 build_backend_json_parity_report.py`
4. 필요 시 `npm run runtime:gate`

이 네 단계만으로도 현재 schema, projection freshness, parity artifact, cutover gate 연결이 살아 있는지 확인할 수 있다.

## 7. Cutover Checklist

고위험 작업이다. 아래를 모두 체크하지 못하면 advance하지 않는다.

- [ ] preview 또는 local rehearsal에서 endpoint contract가 깨지지 않았다.
- [ ] `backend_json_parity_report.json`이 허용 범위 안이다.
- [ ] `backend_shadow_read_report.json`이 target surface 기준 clean 또는 승인된 drift만 가진다.
- [ ] `runtime_gate_report.json`에서 해당 stage gate가 `pass` 또는 승인된 `needs_review`다.
- [ ] `migration_readiness_scorecard.json`에서 overall이 blocker-free이고, blocker-grade category가 모두 허용 범위 안이다.
- [ ] `report_bundle_metadata.json`과 derived artifact의 bundle id가 일치한다.
- [ ] Pages / local build에 `VITE_API_BASE_URL`이 올바르게 들어간다.
- [ ] `backend_freshness_handoff.json`이 latest sync / projection 순서와 target binding을 `pass`로 증명한다.
- [ ] shipped web cut-over surface가 API-only runtime으로 동작한다.
- [ ] operator가 JSON rollback이 아니라 deploy rollback / backend repair 절차를 알고 있다.

실행 메모:

- global cutover baseline: web cut-over surface는 API-only runtime

## 8. Fallback / Rollback Checklist

현재 shipped web cut-over surface에는 runtime JSON fallback이 없다.
따라서 fallback은 "명시적 오류 표시"이고, rollback은 "이전 정상 Pages/preview build로 되돌리거나 backend를 수리"하는 것이다.

- [ ] incident 범위가 global인지 surface-specific인지 분류했다.
- [ ] parity / shadow / runtime 중 어떤 gate가 깨졌는지 확인했다.
- [ ] query override로 재현 가능한 debug path만 남았는지 확인했다.
- [ ] 장기 문제면 이전 정상 Pages build 또는 preview deployment로 되돌릴지 결정했다.
- [ ] committed JSON artifact는 import/parity/debug 용도로만 유지된다는 점을 다시 확인했다.
- [ ] issue / report / PR에 rollback 원인과 다시 advance하기 위한 조건을 남겼다.

권장 순서:

1. query override로 현상 재현
2. backend parity / projection / worker repair
3. 필요 시 이전 정상 deployment로 rollback
4. runtime gate 재측정
5. 최신 build 재배포

## 9. Review / Debug Touchpoints

운영 중 unresolved state를 볼 때 참고하는 위치는 아래다.

| concern | touchpoint |
| --- | --- |
| upcoming review queue | `manual_review_queue.json`, `GET /v1/review/upcoming` |
| MV review queue | `mv_manual_review_queue.json`, `GET /v1/review/mv` |
| YouTube allowlist | `web/src/data/youtubeChannelAllowlists.json`, `GET /v1/entities/:slug/channels` |
| manual override | `release_detail_overrides.json` |
| source-timeline / surface drift | `backend/reports/backend_shadow_read_report.json` |
| canonical-vs-export drift | `backend/reports/backend_json_parity_report.json` |
| bundle/source snapshot drift | `backend/reports/report_bundle_metadata.json`, `backend/reports/runtime_gate_report.json`, `backend/reports/migration_readiness_scorecard.json` |

운영 원칙:

- override는 provenance가 없는 상태로 추가하지 않는다.
- review queue를 단순 삭제하지 않고 resolved reason이 남게 처리한다.
- canonical mismatch는 JSON 쪽이 맞는지, backend 쪽이 맞는지 먼저 판별한 뒤 수정한다.

## 10. Emergency Fallback While JSON Still Exists

JSON snapshot이 아직 남아 있는 동안 emergency fallback은 허용된다.
다만 이 fallback은 "정상 운영 모드"가 아니라 "임시 안전장치"다.

허용되는 기대치:

- cut-over surface가 API 실패 시 committed JSON snapshot으로 내려간다.
- export/debug artifact가 user-facing continuity를 잠시 지킨다.
- fallback window 동안 operator는 parity / projection / worker / API 원인을 수리한다.

허용되지 않는 기대치:

- committed JSON을 다시 source-of-truth로 취급
- drift를 무시한 채 JSON commit만으로 운영 문제를 덮기
- override provenance 없이 임시 데이터만 추가하고 끝내기

## 11. Related References

- `backend/README.md`
- `backend/sql/README.md`
- `docs/specs/backend/phased-rollout-plan.md`
- `docs/specs/backend/preview-staging-backend-path.md`
- `docs/specs/backend/migration-runtime-gates.md`
- `docs/specs/backend/json-snapshot-demotion.md`
