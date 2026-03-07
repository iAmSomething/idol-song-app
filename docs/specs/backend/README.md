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
5. `migration-runtime-gates.md`
   - latency / error / freshness / cadence gate 정의
   - cutover go/no-go에 쓰는 combined runtime report 규칙
6. `migration-operations-runbook.md`
   - schema/import/dual-write/projection/verification/fallback 운영 절차
   - high-risk cutover / rollback checklist
7. `json-snapshot-demotion.md`
   - cut-over surface에서 JSON을 fallback/debug/export로 강등하는 runtime / delivery 규칙
   - Pages build, query override, emergency fallback window 운영 기준
8. `shared-read-api-contracts.md`
   - calendar, search, entity detail, release detail, radar용 shared read contract
   - server-side derived field와 client-side allowed logic 구분
9. `backend-migration-epic.md`
   - cross-platform migration용 backend platform 전체 방향
   - child issue 분해, dependency, target architecture, implementation order

## 읽는 순서

1. `canonical-backend-data-model.md`
2. `runtime-and-service-boundaries.md`
3. `preview-staging-backend-path.md`
4. `migration-operations-runbook.md`
5. `migration-runtime-gates.md`
6. `json-snapshot-demotion.md`
7. `shared-read-api-contracts.md`
8. `phased-rollout-plan.md`
9. `backend-migration-epic.md`

## 원칙

- cut-over된 웹 surface는 backend-primary로 운영하고, committed JSON은 transitional fallback/debug artifact로 강등한다.
- `releases.json`, `watchlist.json`, `releaseDetails.json` 같은 파일은 읽기용 projection으로 본다.
- alias, official link, date precision, MV override, review state는 모두 durable storage를 가진다.
- 제품 날짜 의미론은 `Asia/Seoul`을 유지하고, DB timestamp는 UTC 저장을 기본으로 한다.
