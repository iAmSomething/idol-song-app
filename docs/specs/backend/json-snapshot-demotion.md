# JSON Snapshot Demotion

이 문서는 staged web cutover 이후 committed JSON snapshot을 어떻게 강등할지 정의한다.

## 1. 목적

Phase 5의 목표는 `main`에 커밋된 JSON을 더 이상 production read source나 source-of-truth로 취급하지 않는 것이다.

남겨 두는 이유는 세 가지뿐이다.

1. transitional emergency fallback
2. export/debug/parity artifact
3. 모바일 및 후속 consumer가 shared API로 넘어가기 전의 임시 입력

## 2. 현재 대상 surface

아래 web surface는 이미 backend-backed cutover 경로를 가진다.

- search
- entity detail
- release detail
- calendar month
- radar

이 surface들은 `VITE_PRIMARY_SURFACE_SOURCE=api`가 켜진 build에서는 backend read를 기본값으로 사용한다.
각 surface는 개별 `VITE_*_SOURCE` 또는 query override로 `json` / `api`를 강제할 수 있다.

## 3. JSON artifact의 새 역할

`web/src/data/*.json`은 아래 역할로만 유지한다.

- bundled fallback snapshot
- shadow / parity 비교 기준선
- export/debug inspection artifact
- transitional mobile/static consumer input

즉, cut-over surface에서 "정상 경로"는 API고, JSON은 실패 시 내려가는 fallback이다.

## 4. Pages / GitHub Delivery 책임

GitHub Pages build는 backend-primary build를 받을 수 있게 env 주입 지점을 가진다.

- `VITE_API_BASE_URL`
- `VITE_PRIMARY_SURFACE_SOURCE`
운영 원칙은 아래와 같다.

- backend-primary production을 열 때는 `VITE_API_BASE_URL`과 `VITE_PRIMARY_SURFACE_SOURCE=api`를 함께 설정한다.
- GitHub Actions가 JSON을 계속 커밋하더라도 그것은 data publishing이 아니라 transitional export 갱신으로 본다.

## 5. 남아 있는 JSON inventory

현재 계속 유지되는 대표 JSON은 아래와 같다.

- `web/src/data/releases.json`
- `web/src/data/releaseHistory.json`
- `web/src/data/releaseDetails.json`
- `web/src/data/releaseArtwork.json`
- `web/src/data/watchlist.json`
- `web/src/data/upcomingCandidates.json`
- `web/src/data/artistProfiles.json`
- `web/src/data/youtubeChannelAllowlists.json`

이 파일들은 삭제 대상이 아니라 "강등된 artifact"다.
삭제 여부는 mobile/shared consumer 전환과 emergency fallback window 종료 이후 별도 결정한다.

## 6. Web Runtime Rules

- default local dev는 여전히 `json` primary일 수 있다.
- backend rehearsal / preview / production은 `VITE_PRIMARY_SURFACE_SOURCE=api`를 켠다.
- query override는 coexistence 동안만 유지한다.
- fallback copy는 "local JSON primary"가 아니라 "transitional JSON fallback"으로 표기한다.

## 7. Exit Criteria

JSON demotion이 완료됐다고 보려면 아래가 필요하다.

1. cut-over surface들이 backend-primary build에서 정상 동작한다.
2. runtime gate와 shadow/parity 증적이 rollback-only 상태가 아님을 보여 준다.
3. 운영 문서가 GitHub commit을 production data publish가 아니라 fallback/export로 설명한다.
4. emergency fallback 절차가 문서화돼 있다.
