# Mobile Asset Inventory

이 디렉터리는 모바일 앱이 네트워크 없이도 렌더링 가능한 fallback asset을 담는다.

## 구조

- `app-icon/`
  - `icon-primary-source.svg`
  - `icon-alternate-inverted-source.svg`
  - `icon-adaptive-foreground-source.svg`
  - `icon-adaptive-monochrome-source.svg`
  - `icon-app-store-1024.png`
  - `icon-adaptive-foreground.png`
  - `icon-adaptive-monochrome.png`
  - `icon-legibility-preview.png`
- `placeholders/`
  - `cover-fallback.png`
  - `team-fallback.png`
  - `empty-state-fallback.png`
- `services/`
  - `spotify.png`
  - `youtube-music.png`
  - `youtube-mv.png`
- `badges/`
  - `group-fallback.png`
  - `solo-fallback.png`
  - `label-fallback.png`

## 규칙

- core UI fallback asset은 모두 `mobile/assets/` 아래에 둔다.
- final polished art가 없어도 local fallback path는 먼저 고정한다.
- later screen work는 raw relative path를 직접 쓰지 말고 `src/utils/assetRegistry.ts`를 통해 참조한다.
- placeholder asset은 neutral tone을 유지한다.
- service icon은 service별 semantic 구분만 제공하고, 과한 branding polish는 후속 작업으로 남긴다.
- app icon source of truth는 `app-icon/*.svg`이고, Expo build에는 export PNG를 연결한다.

## 현재 포함 범위

- album/team image fallback
- empty state fallback
- Spotify / YouTube Music / YouTube MV service icon baseline
- group / solo / label badge fallback baseline
- iOS / Android adaptive app icon baseline
