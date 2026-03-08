# Mobile Workspace

이 디렉터리는 `Expo + React Native + Expo Router` 기반 모바일 앱 워크스페이스다.

현재 단계는 workspace bootstrap과 router shell, 그리고 calendar / search / radar tab의 data-backed container까지 포함한다.

- route/layout expectations는 `docs/specs/mobile/expo-implementation-guide.md`를 따른다.
- route/param 계약은 `docs/specs/mobile/route-param-contracts.md`를 따른다.
- 세부 모듈 구조는 `docs/specs/mobile/implementation-work-breakdown.md`를 따른다.

## 현재 포함 범위

- `app/`
  - Expo Router root layout / tab shell / detail placeholder route
  - `calendar` tab은 active dataset + shared selector 기반 container까지 연결됨
  - `radar` tab은 shared radar snapshot 기반 section stack까지 연결됨
  - `search` tab은 query state + recent query persistence + segmented result container까지 연결됨
  - hidden `debug/metadata` route for internal metadata inspection
- `assets/`
  - placeholder / service icon / badge fallback asset inventory
- `src/`
  - components / features / selectors / services / tokens / types / utils 구역
- `.env.example`
  - env/runtime config 예시값
- `package.json`
  - Expo / Expo Router dependency baseline
  - lint / typecheck / test script baseline
- `app.config.ts`
  - development / preview / production profile split
  - env 로딩 + runtime config validation entrypoint
- `src/config/runtime.ts`
  - 앱 런타임에서 쓰는 validated config accessor
- `src/config/debugMetadata.ts`
  - debug-only build version / dataset version / commit hash helper
- `src/config/featureGates.ts`
  - gate registry / helper / off fallback definition
- `src/services/datasetSource.ts`
  - bundled static data vs preview remote data selection layer
- `src/services/activeDataset.ts`
  - active dataset source resolution + dataset load entrypoint
- `src/services/datasetFailurePolicy.ts`
  - runtime misconfiguration / remote dataset unavailable fallback policy
- `src/services/storage.ts`
  - `AsyncStorage` 기반 key-value storage adapter / namespace / shared key convention
- `src/services/datasetCache.ts`
  - static dataset artifact reuse용 cache entry helper
- `src/services/recentQueries.ts`
  - search recent-query persistence helper
- `src/services/handoff.ts`
  - canonical-open / search-fallback / browser-fallback handoff service layer
- `src/tokens/`
  - semantic token constants + theme provider + `useAppTheme()` access convention
- `src/selectors/`
  - raw dataset -> display model selector/adapter scaffold
- `src/types/`
  - raw dataset contract type + display model type baseline
- `src/utils/assetRegistry.ts`
  - local bundled asset lookup entrypoint
- `eas.json`
  - Expo build profile baseline
- `tsconfig.json`
  - TypeScript baseline
- `.github/workflows/mobile-quality.yml`
  - mobile lint / typecheck / test CI gate

## 로컬 시작 기준

```bash
cd mobile
npm install
npm run start
```

profile별 시작:

```bash
cd mobile
npm run start:development
npm run start:preview
npm run start:production
```

타입 체크:

```bash
cd mobile
npm run typecheck
```

lint:

```bash
cd mobile
npm run lint
```

test:

```bash
cd mobile
npm run test
```

profile config 확인:

```bash
cd mobile
npm run config:development
npm run config:preview
npm run config:production
```

env 예시는 아래 파일을 기준으로 잡는다.

```bash
cd mobile
cp .env.example .env
```

## profile split 원칙

- `development`
  - bundled static data 기준
  - verbose logging 허용
  - 내부 개발용 app name / slug / scheme 사용
- `preview`
  - preview static dataset 기준
  - debug logging 허용
  - production과 같은 field contract 유지
- `production`
  - known-good production static dataset 기준
  - error-level logging만 허용
  - user-facing app identity 사용

profile 차이는 아래 범위로만 제한한다.

- data source mode
- logging intensity
- feature gate metadata
- app identity 구분용 name / slug / scheme

## token / theme baseline

- token source of truth는 `src/tokens/` 아래에 둔다.
- 현재 baseline
  - `colors.ts`
    - `surface`, `text`, `border`, `status`, `service`
  - `spacing.ts`
    - `space/4` ~ `space/32`
  - `radii.ts`
    - `chip`, `button`, `card`, `sheet`
  - `typography.ts`
    - `screenTitle`, `sectionTitle`, `cardTitle`, `body`, `meta`, `chip`, `buttonPrimary`, `buttonService`
  - `sizes.ts`
    - icon / button / row size baseline
  - `elevation.ts`
    - `card`, `cardProminent`, `sheet`, `floating`
  - `motion.ts`
    - press / fade / sheet / navigation duration baseline
  - `theme.tsx`
    - `MobileThemeProvider`
    - `useAppTheme()`
- later components/screens는 raw visual constant 대신 `useAppTheme()` 또는 token module을 통해 값에 접근한다.

## selector / adapter baseline

- entrypoint는 `src/selectors/index.ts`에 둔다.
- 역할 분리
  - `src/types/rawData.ts`
    - 현재 static JSON contract type
  - `src/types/displayModels.ts`
    - 화면이 직접 받는 display model type
  - `src/selectors/context.ts`
    - raw dataset index/context 생성
  - `src/selectors/adapters.ts`
    - nullable field, fallback, derived rule을 display model로 변환
  - `src/selectors/index.ts`
    - later screen이 재사용할 shared selector 함수
- 현재 scaffold selector
  - `selectTeamSummaryBySlug`
  - `selectLatestReleaseSummaryBySlug`
  - `selectRecentReleaseSummariesBySlug`
  - `selectUpcomingEventsBySlug`
  - `selectReleaseDetailById`
  - `selectMonthReleaseSummaries`
  - `selectMonthUpcomingEvents`
  - `selectCalendarMonthSnapshot`
  - `selectRadarSnapshot`
  - `selectSearchResults`
- 규칙
  - 화면은 raw JSON shape를 직접 읽지 않는다.
  - selector는 fallback을 포함한 최종 display model만 반환한다.
  - 공통 normalize/id 생성 규칙은 `src/selectors/normalize.ts`에서 공유한다.

## env / validation 규칙

- `APP_ENV`
  - `development`, `preview`, `production`만 허용한다.
- `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_REMOTE_DATASET_URL`
  - 값이 있으면 absolute `http(s)` URL이어야 한다.
- `EXPO_PUBLIC_REMOTE_DATASET_URL`
  - `APP_ENV=preview`에서만 허용한다.
- `EXPO_PUBLIC_ENABLE_REMOTE_REFRESH=true`
  - 이 경우 `EXPO_PUBLIC_REMOTE_DATASET_URL`이 필수다.
  - preview profile에서만 허용한다.
- `EXPO_PUBLIC_ENABLE_ANALYTICS=true`
  - 이 경우 `EXPO_PUBLIC_ANALYTICS_WRITE_KEY`가 필수다.
- `EXPO_PUBLIC_ENABLE_SHARE_ACTIONS`
  - share CTA 노출 여부를 제어한다.
- `EXPO_PUBLIC_BUILD_VERSION`
  - debug metadata와 Expo config version에 쓰는 explicit build version override다.
- invalid config
  - `app.config.ts` 단계에서는 invalid env를 명시적으로 fail-fast 시킨다.
  - 앱 runtime에서는 `src/config/runtime.ts`의 safe degraded mode로 내려가서 bundled-only config를 쓴다.
  - later UI는 degraded state와 issue message를 표시할 수 있어야 한다.

## mobile failure policy baseline

- entrypoint는 `src/config/runtime.ts`와 `src/services/datasetFailurePolicy.ts`다.
- runtime config payload가 없거나 invalid면:
  - app crash 대신 `mode = degraded`
  - `remoteRefresh = false`
  - `analytics = false`
  - bundled/static dataset path만 허용
- preview remote dataset이 unavailable/invalid면:
  - 가능한 경우 `last-known-good` cache로 fallback
  - cache가 불완전하면 bundled dataset으로 fallback
- later UI는 `normal`과 `degraded`를 명시적으로 구분해 badge/banner/toast를 붙일 수 있어야 한다.

## debug metadata surface

- internal metadata route는 `app/debug/metadata.tsx`에 둔다.
- build version / dataset version / commit hash는 `src/config/debugMetadata.ts`를 통해 읽는다.
- runtime degraded 여부와 runtime issue message도 같은 route에서 확인 가능해야 한다.
- main tab이나 user-facing surface에는 진입 링크를 두지 않는다.
- production profile에서는 route가 열려도 debug-only 안내만 보여준다.

## external handoff baseline

- shared handoff entrypoint는 `src/services/handoff.ts`에 둔다.
- 지원 서비스
  - `spotify`
  - `youtubeMusic`
  - `youtubeMv`
- 규칙
  - canonical URL이 안전하고 지원되는 경우 `mode = canonical`
  - canonical URL이 없거나 지원되지 않으면 `mode = searchFallback`
  - browser-safe fallback이 있으면 `browserFallback` target을 같이 유지한다.
  - handoff 실패는 silent drop이 아니라 retryable failure result로 반환한다.
  - later service button / detail screen은 `Linking.openURL`을 직접 호출하지 않고 이 service layer를 통해 연다.

## dataset-source baseline

- selector entrypoint는 `src/services/datasetSource.ts`에 둔다.
- single-source rule
  - 한 build/runtime 조합은 하나의 dataset source만 고른다.
  - bundled static과 preview remote를 동시에 섞지 않는다.
- bundled source
  - 기본값이다.
  - v1 계약 경로는 `mobile/assets/datasets/v1/` 기준으로 잡는다.
- preview remote source
  - `APP_ENV=preview`
  - `EXPO_PUBLIC_ENABLE_REMOTE_REFRESH=true`
  - `EXPO_PUBLIC_REMOTE_DATASET_URL` provided
  - 위 3조건이 모두 맞을 때만 선택된다.
- field contract
  - bundled source와 preview remote source는 같은 artifact id / field contract를 유지해야 한다.

## storage / cache baseline

- lightweight storage choice는 `@react-native-async-storage/async-storage`로 고정한다.
- 공통 namespace는 `idol-song-app/mobile/v1`이다.
- shared foundation entrypoint
  - `src/services/storage.ts`
    - storage adapter binding
    - namespaced key builder
    - JSON read/write/remove helper
  - `src/services/datasetCache.ts`
    - dataset artifact cache entry
    - source kind / dataset version 분리 key
  - `src/services/recentQueries.ts`
    - recent query read/write/clear
- 규칙
  - 화면은 `AsyncStorage`를 직접 호출하지 않는다.
  - static dataset reuse cache는 dataset contract id + source kind + dataset version + artifact id 기준으로 분리한다.
  - recent query persistence는 같은 namespace/key 규칙을 재사용한다.
  - later search/calendar/entity screen은 ad hoc local-storage key를 새로 만들지 않는다.

## feature-gate baseline

- gate registry는 `src/config/featureGates.ts`에 둔다.
- 현재 지원 gate
  - `radar_enabled`
  - `analytics_enabled`
  - `remote_dataset_enabled`
  - `mv_embed_enabled`
  - `share_actions_enabled`
- off fallback
  - radar: 탭 숨김 또는 read-only placeholder
  - analytics: 이벤트 미발행, UI 변화 없음
  - remote dataset: bundled dataset only
  - MV embed: embed 숨김, external watch CTA 유지
  - share actions: 공유 버튼 비노출

라우팅 구조, 화면 contract, field shape는 profile에 따라 달라지지 않는다.

## 아직 없는 것

- 실제 screen/layout 구현
- selector/adapter binding
- backend integration

## asset baseline

- `mobile/assets/placeholders/`
  - cover/team/empty-state fallback
- `mobile/assets/services/`
  - Spotify / YouTube Music / YouTube MV icon baseline
- `mobile/assets/badges/`
  - group / solo / label fallback
- `mobile/assets/datasets/`
  - bundled dataset path contract 문서
- later screen work는 raw asset path 대신 `src/utils/assetRegistry.ts`를 우선 사용한다.

## verification baseline

- `npm run lint`
  - Expo workspace 기준 ESLint baseline
- `npm run typecheck`
  - strict TypeScript gate
- `npm run test`
  - runtime config unit test + route shell smoke test baseline
- `.github/workflows/mobile-quality.yml`
  - `mobile/**` 변경과 workflow 변경에만 반응하는 CI gate

현재 test 범위는 얇게 시작한다.

- unit
  - runtime config validation / normalization
- smoke
  - root redirect
  - tab shell render
  - artist/release detail placeholder render

device/e2e automation은 아직 포함하지 않는다.

위 항목은 후속 모바일 foundation 이슈에서 추가한다.

## 기대 폴더 구조

```text
mobile/
  app/
    (tabs)/
    artists/
    releases/
  src/
    components/
    config/
    features/
    selectors/
    services/
    tokens/
    types/
    utils/
```
