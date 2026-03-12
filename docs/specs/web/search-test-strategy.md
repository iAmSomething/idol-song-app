# Search Test Strategy

이 문서는 검색 기능을 `backend /v1/search`, `web runtime`, `mobile backend-primary` 세 층으로 나눠서 검증하는 기준을 정리한다.

## 목적

- 정확한 팀명, 한글 alias, 릴리즈명 검색이 regression 없이 유지되는지 확인한다.
- `same-day release`가 verified로 승격된 뒤에도 stale upcoming/search 결과가 남지 않게 한다.
- backend unavailable / timeout / invalid request 같은 실패가 조용한 fallback이 아니라 명시적 상태로 노출되는지 확인한다.

## 범위

1. `backend`
   - `/v1/search` route contract
   - exact display-name / alias / release-title match
   - unknown query empty envelope
   - same-day verified release가 있으면 upcoming suppression
2. `web`
   - bridge search matcher
   - bridge asset coverage
   - search index가 entity/detail/calendar asset과 끊기지 않는지
   - search upcoming이 same-day stale row를 다시 노출하지 않는지
3. `mobile`
   - backend-primary search tab
   - exact alias / exact release-title / route sync
   - loading chrome 유지
   - backend failure 시 explicit retry state

## 핵심 시나리오

| 시나리오 | backend | web | mobile |
| --- | --- | --- | --- |
| 정확한 팀명 검색 | `display_name_exact` | entity row 렌더 가능 | result open + analytics |
| 한글 alias 검색 | `alias_exact` | bridge matcher exact hit | recent query / submit flow |
| 릴리즈명 exact 검색 | direct release row | release row exact hit | release detail route 이동 |
| unknown query | `200 + empty arrays` | empty search result | partial/fallback 없이 idle/empty 유지 |
| same-day verified suppression | upcoming 0 | search/calendar bridge stale row 금지 | backend-primary 결과에 stale upcoming 없음 |
| backend unavailable | `timeout/invalid_request` envelope | runtime status 표시 | explicit retry state |

## 자동 검증 경로

### Backend

- 파일: `/Users/gimtaehun/Desktop/idol-song-app/backend/src/route-contract.test.ts`
- 실행:

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/backend
node --import tsx --test ./src/route-contract.test.ts
```

### Web

- bridge matcher unit:

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/web
npm run test:search-runtime
```

- bridge coverage / asset audit:

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/web
npm run test:pages-read-bridge
npm run verify:pages-read-bridge
```

### Mobile

- search UI regression:

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm test -- --runInBand src/features/searchTab.test.tsx src/features/searchTabLoading.test.tsx
```

## 운영 규칙

- search unknown query는 `404`가 아니라 `200 + empty arrays`여야 한다.
- same-day verified release가 있으면 search 결과에 exact upcoming이 다시 보이면 안 된다.
- backend-primary mobile/web runtime은 실패 시 stale local fallback을 계속 보여주지 않는다.
- bridge runtime이 유지되는 동안은 search index, entity asset, release detail lookup, calendar month가 모두 coverage audit에 포함돼야 한다.
