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

## 읽는 순서

1. `canonical-backend-data-model.md`
2. `phased-rollout-plan.md`

## 원칙

- 현재 웹은 계속 정적 JSON을 읽지만, 장기 정본은 백엔드 canonical model로 옮긴다.
- `releases.json`, `watchlist.json`, `releaseDetails.json` 같은 파일은 읽기용 projection으로 본다.
- alias, official link, date precision, MV override, review state는 모두 durable storage를 가진다.
- 제품 날짜 의미론은 `Asia/Seoul`을 유지하고, DB timestamp는 UTC 저장을 기본으로 한다.
