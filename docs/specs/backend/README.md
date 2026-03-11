# Backend Spec Index

이 디렉터리는 현재 JSON-first 산출물을 장기적인 source-of-truth에서 분리하고,
향후 웹/모바일이 함께 의존할 백엔드 계약을 정의하는 스펙 문서 세트다.

## 문서 구성

1. `canonical-backend-data-model.md`
   - canonical write model / projection read model 구분
   - entity, release, upcoming, official link, review, override 저장 모델
   - 현재 JSON 산출물과 백엔드 모델 사이의 매핑
2. `phased-rollout-plan.md`
   - JSON-first 파이프라인에서 backend-backed persistence / read로 넘어가는 단계별 전환 계획
   - phase별 gate, rollback, parity metric, ownership split
3. `runtime-and-service-boundaries.md`
   - Neon / Fastify / Railway worker / GitHub Pages 기준의 runtime baseline
   - database, read API, worker, transitional GitHub delivery의 boundary
4. `preview-staging-backend-path.md`
   - preview Neon / API / worker rehearsal 경로
   - preview와 production에서 달라도 되는 것과 안 되는 것
5. `backend-deploy.yml` + `backend/scripts/deploy-backend.mjs`
   - preview 자동 deploy / production 수동 deploy 경로
   - GitHub Environment와 Railway target ID baseline
6. `migration-runtime-gates.md`
   - latency / error / freshness / cadence gate 정의
   - cutover go/no-go에 쓰는 combined runtime report 규칙
7. `migration-operations-runbook.md`
   - schema/import/dual-write/projection/verification/fallback 운영 절차
   - high-risk cutover / rollback checklist
8. `web-cutover-rollback-drills.md`
   - search/entity/release/calendar/radar surface별 rollback drill 계획
   - representative drill timing과 user-facing effect 요약
9. `json-snapshot-demotion.md`
   - cut-over surface에서 JSON을 fallback/debug/export로 강등하는 runtime / delivery 규칙
   - Pages build, query override, emergency fallback window 운영 기준
10. `public-read-api-contract-v1.md`
   - web / mobile consumer가 보는 canonical versioned public read contract
   - stable field, transitional/internal detail, compatibility expectation 고정
11. `shared-read-api-contracts.md`
   - detailed payload examples와 server-side derived semantics working note
   - `public-read-api-contract-v1.md`를 보조하는 상세 reference
12. `deploy-environment-contract.md`
   - preview / production deploy 전 environment completeness / drift gate
   - example env, Railway runtime env, GitHub deploy input 사이의 contract
13. `backend-migration-epic.md`
   - cross-platform migration용 backend platform 전체 방향
   - child issue 분해, dependency, target architecture, implementation order
14. `mobile-adoption-readiness-review.md`
   - backend contract가 mobile screen 구현을 바로 받을 수 있는지 surface별 readiness 검토
   - blocker / non-blocker / follow-up issue 기준의 gate decision
15. `public-read-rate-limit-policy.md`
   - public read endpoint의 bucket별 rate-limit 기준
   - preview / production 기대치와 `429 rate_limited` contract
16. `structured-backend-logging-policy.md`
   - request/error/runtime-fatal log field shape와 redaction 규칙
   - env별 verbosity와 routine-noise budget
17. `neon-backup-restore-recovery-drill.md`
   - isolated schema clone 기준 backup / restore / recovery rehearsal 절차
   - representative read-path usable state 판정 기준
18. `projection-query-plan-regression-check.md`
   - projection-backed lookup query의 required index / explain probe gate
   - controlled degraded scenario로 failure detection을 증명하는 방법
19. `backend-secret-inventory-and-rotation.md`
   - GitHub / Railway / Neon 기준 backend secret / variable inventory
   - owner role, rotation trigger, rollback baseline, current audit snapshot
20. `migration-readiness-scorecard.md`
   - migration readiness category, weight, blocker threshold rubric
   - machine-readable / human-readable scorecard artifact contract
21. `canonical-null-hygiene-operating-model.md`
   - canonical nullable field taxonomy, provenance/status/source-pointer convention
   - backfill wave, recency SLA, source precedence, readiness null gate 기준
22. `canonical-null-hygiene-cadence.md`
   - daily / weekly / monthly null hygiene cadence와 owner checklist
   - artifact handoff order, escalation rule, review ritual
   - service-link/title-track/entity-identity gap workbench artifact contract

## 읽는 순서

1. `canonical-backend-data-model.md`
2. `runtime-and-service-boundaries.md`
3. `preview-staging-backend-path.md`
4. `.github/workflows/backend-deploy.yml`
5. `migration-operations-runbook.md`
6. `migration-runtime-gates.md`
7. `web-cutover-rollback-drills.md`
8. `json-snapshot-demotion.md`
9. `public-read-api-contract-v1.md`
10. `shared-read-api-contracts.md`
11. `deploy-environment-contract.md`
12. `mobile-adoption-readiness-review.md`
13. `phased-rollout-plan.md`
14. `backend-migration-epic.md`
15. `public-read-rate-limit-policy.md`
16. `structured-backend-logging-policy.md`
17. `neon-backup-restore-recovery-drill.md`
18. `projection-query-plan-regression-check.md`
19. `backend-secret-inventory-and-rotation.md`
20. `migration-readiness-scorecard.md`
21. `canonical-null-hygiene-operating-model.md`
22. `canonical-null-hygiene-cadence.md`

## 원칙

- cut-over된 웹 surface는 backend-primary로 운영하고, committed JSON은 transitional fallback/debug artifact로 강등한다.
- `releases.json`, `watchlist.json`, `releaseDetails.json` 같은 파일은 읽기용 projection으로 본다.
- alias, official link, date precision, MV override, review state는 모두 durable storage를 가진다.
- 제품 날짜 의미론은 `Asia/Seoul`을 유지하고, DB timestamp는 UTC 저장을 기본으로 한다.
