# Mobile Workspace

이 디렉터리는 `Expo + React Native + Expo Router` 기반 모바일 앱 워크스페이스다.

현재 단계는 workspace bootstrap과 router shell까지만 포함한다.

- route/layout expectations는 `docs/specs/mobile/expo-implementation-guide.md`를 따른다.
- route/param 계약은 `docs/specs/mobile/route-param-contracts.md`를 따른다.
- 세부 모듈 구조는 `docs/specs/mobile/implementation-work-breakdown.md`를 따른다.

## 현재 포함 범위

- `app/`
  - Expo Router root layout / tab shell / detail placeholder route
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

## env / validation 규칙

- `APP_ENV`
  - `development`, `preview`, `production`만 허용한다.
- `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_REMOTE_DATASET_URL`
  - 값이 있으면 absolute `http(s)` URL이어야 한다.
- `EXPO_PUBLIC_ENABLE_REMOTE_REFRESH=true`
  - 이 경우 `EXPO_PUBLIC_REMOTE_DATASET_URL`이 필수다.
- `EXPO_PUBLIC_ENABLE_ANALYTICS=true`
  - 이 경우 `EXPO_PUBLIC_ANALYTICS_WRITE_KEY`가 필수다.
- invalid config
  - `app.config.ts` 단계와 `src/config/runtime.ts` 단계에서 둘 다 명시적으로 실패시킨다.
  - silent fallback으로 숨기지 않는다.

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
