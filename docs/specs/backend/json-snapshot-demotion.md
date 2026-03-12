# JSON Snapshot Demotion

이 문서는 web cutover 완료 이후 committed JSON snapshot의 최종 역할을 정의한다.

## 1. 목적

목표는 `main`에 커밋된 JSON을 더 이상 shipped web runtime dependency나 production read source로 취급하지 않는 것이다.

남겨 두는 이유는 세 가지뿐이다.

1. import / backfill seed
2. export/debug/parity artifact
3. 모바일 및 후속 consumer가 shared API로 넘어가기 전의 임시 입력

## 2. 현재 대상 surface

아래 web surface는 이미 backend-backed cutover 경로를 가진다.

- search
- entity detail
- release detail
- calendar month
- radar

이 surface들은 shipped web runtime에서 backend read만 사용한다.
과거의 `json` / `api` source switch와 per-surface rollback path는 더 이상 운영 계약이 아니다.

## 3. JSON artifact의 새 역할

`web/src/data/*.json`은 아래 역할로만 유지한다.

- import / backfill seed
- shadow / parity 비교 기준선
- export/debug inspection artifact
- transitional mobile/static consumer input

즉, cut-over surface에서 "정상 경로"는 API뿐이고, JSON은 shipped runtime의 실패 fallback이 아니다.

## 4. Pages / GitHub Delivery 책임

GitHub Pages build는 backend API base URL만 env로 주입받는다.

- `VITE_API_BASE_URL`
운영 원칙은 아래와 같다.

- production / preview web build는 API-only runtime을 전제로 `VITE_API_BASE_URL`만 설정한다.
- GitHub Actions가 JSON을 계속 커밋하더라도 그것은 data publishing이 아니라 transitional export 갱신으로 본다.
- 단, `VITE_API_BASE_URL`이 비어 있는 Pages build를 그대로 배포하면 same-origin `/v1/*`가 `404`로 무너질 수 있으므로, build 시점에 `web/public/__bridge/v1/**` read bridge를 생성한다.
- calendar month / radar / known release-detail는 API base가 비어 있을 때 broken root-relative `/v1/*` 대신 이 Pages read bridge를 사용한다.
- `.github/workflows/deploy-pages.yml`은 deploy 전에 `npm run verify:pages-read-bridge`를 실행해 `2026-02` calendar, `radar`, known release-detail lookup/detail bridge asset이 모두 있는지 gate로 확인한다.
- 같은 workflow는 `npm run verify:pages-backend-target`도 실행해서 build가 선언한 target env(`VITE_BACKEND_TARGET_ENV`)와 실제 Pages runtime target(`VITE_API_BASE_URL` 또는 bridge) 정합성을 검증한다.
- generated diagnostics artifact는 `/__bridge/v1/meta/backend-target.json`이며, 앱에서는 `?inspect=backend-target` query로 같은 정보를 내부 inspection panel에서 확인할 수 있다.

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

- shipped web cut-over surface는 API-only runtime이다.
- Pages build에서 API base가 비어 있을 때는 generated Pages read bridge가 runtime target이 된다.
- local dev도 cut-over surface에서는 JSON primary/source switch를 제공하지 않는다.
- query override는 남아 있다면 debug/repro 목적에만 한정한다.
- user-facing copy는 backend availability/error만 설명하고 JSON fallback을 광고하지 않는다.

## 6.1 Regression Guards

API-only runtime 정책이 다시 local dataset 의존으로 미끄러지지 않도록 아래 guard를 같이 유지한다.

- web
  - `web/scripts/verify-runtime-policy.mjs`
  - `web/src/App.tsx`만 현재 transitional snapshot import boundary로 허용한다.
  - `web/src/**`의 다른 shipped runtime file이 `./data/*.json`을 직접 import하면 CI가 실패한다.
  - `App.tsx`에서도 허용된 snapshot set 밖의 새 import를 추가하면 CI가 실패한다.
- mobile
  - `npm run verify:runtime-policy`
  - preview / production profile은 반드시 `backend-api`여야 한다.
  - `bundled-static` active mode는 development 기본값 또는 explicit degraded mode에서만 허용한다.
  - live backend failure 시 cache가 없으면 현재는 `bundled-static-fallback`으로만 내려갈 수 있고, 이 경로도 explicit notice와 test coverage가 있어야 한다.

이 guard는 현재 transitional boundary를 고정하는 것이고, boundary 자체를 제거하는 일은 `#633`, `#636`, `#637`, `#638`에서 계속 진행한다.

## 7. Exit Criteria

JSON demotion이 완료됐다고 보려면 아래가 필요하다.

1. cut-over surface들이 shipped build에서 API-only로 정상 동작한다.
2. runtime gate와 shadow/parity 증적이 rollback-only 상태가 아님을 보여 준다.
3. 운영 문서가 GitHub commit을 production data publish가 아니라 import/export artifact로 설명한다.
4. deploy rollback과 backend repair 절차가 문서화돼 있다.
