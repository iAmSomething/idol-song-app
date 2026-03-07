# Mobile Workspace

이 디렉터리는 `Expo + React Native + Expo Router` 기반 모바일 앱 워크스페이스다.

현재 단계는 workspace bootstrap만 포함한다.

- route/layout expectations는 `docs/specs/mobile/expo-implementation-guide.md`를 따른다.
- route/param 계약은 `docs/specs/mobile/route-param-contracts.md`를 따른다.
- 세부 모듈 구조는 `docs/specs/mobile/implementation-work-breakdown.md`를 따른다.

## 현재 포함 범위

- `app/`
  - Expo Router 기준 route shell 위치
- `src/`
  - components / features / selectors / services / tokens / types / utils 구역
- `package.json`
  - Expo / Expo Router dependency baseline
- `app.config.ts`
  - development / preview / production profile split
- `eas.json`
  - Expo build profile baseline
- `tsconfig.json`
  - TypeScript baseline

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

profile config 확인:

```bash
cd mobile
npm run config:development
npm run config:preview
npm run config:production
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

라우팅 구조, 화면 contract, field shape는 profile에 따라 달라지지 않는다.

## 아직 없는 것

- 실제 screen/layout 구현
- backend integration

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
    features/
    selectors/
    services/
    tokens/
    types/
    utils/
```
