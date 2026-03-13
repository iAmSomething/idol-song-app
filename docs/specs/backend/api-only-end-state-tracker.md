# API-only End-state Tracker

## 1. 목적

이 문서는 `true API-only end state`가 무엇인지, 현재 코드베이스가 어디까지 도달했는지,
그리고 남아 있는 blocker issue가 무엇인지 한 장으로 묶어 관리한다.

이 문서의 목적은 두 가지다.

1. shipped client runtime과 pipeline이 더 이상 committed JSON snapshot에 의존하지 않는다는 점을 명시한다.
2. 아직 cutover sign-off를 막고 있는 남은 blocker를 별도 issue로 정확하게 연결한다.

## 2. End State Definition

`true API-only end state`는 아래 조건을 동시에 만족하는 상태를 뜻한다.

### 2.1 Web client

- shipped web surface는 backend read API만 primary runtime source로 사용한다.
- committed JSON snapshot과 bridge export는 inspection/debug/export/reference artifact 역할만 가진다.
- runtime regression guard가 local dataset direct import 회귀를 막는다.
- Pages production deploy는 backend freshness handoff가 가리키는 production API URL을 우선 target으로 해석하고, target이 healthy할 때만 active runtime target으로 사용한다.

관련 근거:

- `web/src/App.tsx`
- `web/scripts/verify-runtime-policy.mjs`
- `docs/specs/backend/json-snapshot-demotion.md`

### 2.2 Mobile client

- preview / production mobile profile은 `backend-api`만 active runtime mode로 쓴다.
- bundled static dataset은 debug/test fixture 또는 degraded fallback boundary 밖에 남지 않는다.
- runtime regression guard가 bundled-primary 회귀를 막는다.

관련 근거:

- `mobile/src/services/datasetSource.ts`
- `mobile/src/config/runtime.ts`
- `mobile/src/features/useActiveDatasetScreen.ts`
- `mobile/package.json`의 `verify:runtime-policy`

### 2.3 Pipelines / workflows

- daily / weekly workflow는 Neon-first를 기본 운영 경로로 사용한다.
- `web/src/data/*.json`는 commit 대상 production truth가 아니라 secondary mirror / export artifact다.
- collection / enrichment script의 primary input/output은 root canonical snapshot과 canonical DB다.

관련 근거:

- `.github/workflows/weekly-kpop-scan.yml`
- `.github/workflows/catalog-enrichment-refresh.yml`
- `non_runtime_dataset_paths.py`
- `backend/scripts/build-non-runtime-web-snapshot-export.mjs`

## 3. Current State

현재 repo는 implementation 관점에서 아래까지 도달했다.

- web cut-over surface는 backend-primary runtime으로 정리되어 있다.
- Pages deploy는 production backend API를 우선 target으로 해석한다. 다만 target이 unhealthy하면 broken live runtime 대신 bridge mode로 내려간다.
- mobile preview / production profile은 backend-primary runtime으로 정리되어 있다.
- scheduled workflow는 `web/src/data`를 운영 truth로 커밋하지 않는다.
- committed JSON snapshot과 bridge export는 demoted artifact로만 남는다.

즉, 남아 있는 blocker는 더 이상 "client가 JSON을 primary runtime source로 쓴다"만이 아니다.
남아 있는 문제는 production API health / live runtime evidence / data completeness 같은 운영/품질 blocker다.

## 4. Remaining Linked Blockers

아래 열린 issue들이 현재 이 end state의 남은 blocker 전부다.

| issue | blocker class | why it is still open |
| --- | --- | --- |
| [#626](https://github.com/iAmSomething/idol-song-app/issues/626) | runtime health evidence | first real daily cadence window 이후 refreshed runtime bundle로 남은 runtime-health blocker를 재판정해야 한다. |
| [#625](https://github.com/iAmSomething/idol-song-app/issues/625) | catalog completeness (MV) | latest / recent cohort의 canonical MV floor가 readiness threshold를 아직 못 넘겼다. |
| [#627](https://github.com/iAmSomething/idol-song-app/issues/627) | catalog completeness (title-track) | latest / recent cohort의 title-track floor가 readiness threshold를 아직 못 넘겼다. |

## 5. What Completion Means

위 5개 issue가 모두 닫히면 다음을 동시에 만족한다.

- runtime-health / readiness bundle이 first scheduled cadence evidence까지 포함한 최신 상태로 고정된다.
- latest / recent user-facing cohort의 title-track / canonical MV blocker가 readiness threshold 아래에 더 이상 남지 않는다.

그 상태에서는 shipped client runtime과 scheduled pipeline 관점에서
"committed JSON snapshot에 의존하는 major remaining class"가 남지 않는다.

## 6. Exit Checklist

`#632`를 close 가능한 상태로 보려면 아래 질문 모두에 `yes`여야 한다.

1. web shipped runtime이 committed JSON direct dependency 없이 backend/API-only로 동작하는가?
2. mobile preview / production runtime이 backend-primary로 고정되어 있는가?
3. scheduled workflow가 DB-first + non-runtime export contract를 따르는가?
4. 남은 blocker가 이 문서의 linked issue 집합 밖에 더 남아 있지 않은가?

현재 answer:

- `1`: yes
- `2`: yes
- `3`: yes
- `4`: yes

따라서 `#632`는 implementation umbrella 역할을 다했고,
이제 remaining blocker는 개별 linked issue에서 추적하면 된다.
