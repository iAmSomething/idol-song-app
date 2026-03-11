# Launch Visual Asset Handoff

## 목적
launch 시점에 필요한 icon, splash, fallback visual을 구현팀이 바로 붙일 수 있도록 path, naming, variant, update rule을 한 문서로 고정한다.

## Export Set

### Icon
- app icon: `mobile/assets/app-icon/icon-app-store-1024.png`
- Android adaptive foreground: `mobile/assets/app-icon/icon-adaptive-foreground.png`
- Android adaptive monochrome: `mobile/assets/app-icon/icon-adaptive-monochrome.png`
- source of truth:
  - `mobile/assets/app-icon/icon-primary-source.svg`
  - `mobile/assets/app-icon/icon-adaptive-foreground-source.svg`
  - `mobile/assets/app-icon/icon-adaptive-monochrome-source.svg`
  - `mobile/assets/app-icon/icon-alternate-inverted-source.svg`

### Splash
- foreground export: `mobile/assets/splash/splash-foreground.png`
- source of truth: `mobile/assets/splash/splash-foreground-source.svg`
- app binding:
  - iOS/Android splash image path는 `mobile/app.config.ts`에서 관리한다.

### Fallback Visuals
- placeholder exports:
  - `mobile/assets/placeholders/cover-fallback.png`
  - `mobile/assets/placeholders/team-fallback.png`
  - `mobile/assets/placeholders/empty-state-fallback.png`
- badge exports:
  - `mobile/assets/badges/group-fallback.png`
  - `mobile/assets/badges/solo-fallback.png`
  - `mobile/assets/badges/label-fallback.png`
- service marks:
  - `mobile/assets/services/spotify.png`
  - `mobile/assets/services/youtube-music.png`
  - `mobile/assets/services/youtube-mv.png`

## Runtime Wiring
- asset registry entrypoint: `mobile/src/utils/assetRegistry.ts`
- badge / placeholder renderer: `mobile/src/components/visual/FallbackArt.tsx`
- service mark usage: `mobile/src/components/actions/ServiceButton.tsx`
- team badge fallback usage: `mobile/src/components/identity/TeamIdentityRow.tsx`
- empty-state fallback usage: `mobile/src/components/feedback/FeedbackState.tsx`
- compact hero / inset section rollout:
  - `mobile/src/components/surfaces/CompactHero.tsx`
  - `mobile/src/components/surfaces/InsetSection.tsx`
  - `mobile/src/components/surfaces/TonalPanel.tsx`

## iOS / Android 적용 단위
- iOS app icon / Android adaptive icon: `mobile/app.config.ts`
- splash foreground + background color: `mobile/app.config.ts`
- placeholder/badge/service assets: RN bundle static asset (`require(...)`)로 읽는다.

## Naming Rule
- export PNG 이름은 stable contract다.
- source SVG는 `*-source.svg` suffix를 유지한다.
- runtime code는 source SVG가 아니라 export PNG만 직접 참조한다.

## Update Policy
1. visual 수정은 source SVG부터 바꾼다.
2. 같은 basename의 PNG export를 다시 생성한다.
3. `mobile/assets/launch-visual-export-manifest.json`을 갱신한다.
4. `mobile/assets/README.md`와 이 문서의 path/naming이 달라졌으면 같이 고친다.
5. `mobile/app.config.ts`를 쓰는 icon/splash 경로가 바뀌면 config smoke를 다시 돌린다.

## Inventory Contract
- 기계 확인용 manifest: `mobile/assets/launch-visual-export-manifest.json`
- human-readable inventory: `mobile/assets/README.md`

## 검증
- `npm run config:preview`
- `npm run typecheck`
- `npm run lint`
- asset export dimension sanity
