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
  - `icon-launch-mark-dark.png`
  - `icon-legibility-preview.png`
- `splash/`
  - `splash-foreground-source.svg`
  - `splash-foreground-dark-source.svg`
  - `splash-foreground.png`
  - `splash-foreground-dark.png`
- `placeholders/`
  - `cover-fallback-source.svg`
  - `cover-fallback-dark-source.svg`
  - `team-fallback-source.svg`
  - `team-fallback-dark-source.svg`
  - `empty-state-fallback-source.svg`
  - `empty-state-fallback-dark-source.svg`
  - `cover-fallback.png`
  - `cover-fallback-dark.png`
  - `team-fallback.png`
  - `team-fallback-dark.png`
  - `empty-state-fallback.png`
  - `empty-state-fallback-dark.png`
- `services/`
  - `spotify-source.svg`
  - `youtube-music-source.svg`
  - `youtube-mv-source.svg`
  - `spotify.png`
  - `youtube-music.png`
  - `youtube-mv.png`
- `badges/`
  - `group-fallback-source.svg`
  - `group-fallback-dark-source.svg`
  - `solo-fallback-source.svg`
  - `solo-fallback-dark-source.svg`
  - `label-fallback-source.svg`
  - `label-fallback-dark-source.svg`
  - `group-fallback.png`
  - `group-fallback-dark.png`
  - `solo-fallback.png`
  - `solo-fallback-dark.png`
  - `label-fallback.png`
  - `label-fallback-dark.png`
- `launch-visual-export-manifest.json`

## 규칙

- core UI fallback asset은 모두 `mobile/assets/` 아래에 둔다.
- source of truth는 `*-source.svg`, runtime binding은 export PNG를 쓴다.
- light export를 덮어쓰지 말고 dark variant는 `*-dark-source.svg`, `*-dark.png` suffix로 추가한다.
- final polished art가 없어도 local fallback path는 먼저 고정한다.
- later screen work는 raw relative path를 직접 쓰지 말고 `src/utils/assetRegistry.ts`를 통해 참조한다.
- placeholder asset은 neutral tone을 유지한다.
- service mark는 monochrome glyph + semantic tint 조합으로 유지한다.
- app icon source of truth는 `app-icon/*.svg`, splash source of truth는 `splash/*.svg`이다.
- implementation handoff note는 `docs/specs/mobile/launch-visual-asset-handoff.md`를 본다.

## 현재 포함 범위

- album/team image fallback
- empty state fallback
- Spotify / YouTube Music / YouTube MV service mark export
- group / solo / label badge fallback export
- iOS / Android adaptive app icon export
- dedicated splash foreground export
- dark splash / placeholder / badge export
- launch handoff manifest
