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
- `app.json`
  - Expo runtime baseline
- `tsconfig.json`
  - TypeScript baseline

## 로컬 시작 기준

```bash
cd mobile
npm install
npm run start
```

타입 체크:

```bash
cd mobile
npm run typecheck
```

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
