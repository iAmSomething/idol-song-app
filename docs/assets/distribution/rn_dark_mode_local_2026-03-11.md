# RN Dark Mode Local Evidence (2026-03-11)

## Scope
- `#519` dark mode umbrella
- `#520` semantic token / theme mapping
- `#521` shared components and main screens
- `#522` splash / loading / placeholder dark assets
- `#523` dark-mode accessibility and contrast QA

## Runtime changes
- theme-aware asset registry:
  - `mobile/src/utils/assetRegistry.ts`
- dark asset consumers:
  - `mobile/src/components/visual/FallbackArt.tsx`
  - `mobile/src/components/launch/LaunchGate.tsx`
  - `mobile/app.config.ts`
- dark chrome:
  - `mobile/app/(tabs)/_layout.tsx`
  - `mobile/app/debug/metadata.tsx`

## Added dark assets
- `mobile/assets/app-icon/icon-launch-mark-dark.png`
- `mobile/assets/splash/splash-foreground-dark.png`
- `mobile/assets/placeholders/cover-fallback-dark.png`
- `mobile/assets/placeholders/team-fallback-dark.png`
- `mobile/assets/placeholders/empty-state-fallback-dark.png`
- `mobile/assets/badges/group-fallback-dark.png`
- `mobile/assets/badges/solo-fallback-dark.png`
- `mobile/assets/badges/label-fallback-dark.png`

## Export sanity
- all dark PNG exports were regenerated from SVG source with `qlmanage`
- dimension check:
  - launch mark dark: `1024x1024`
  - splash foreground dark: `1024x1024`
  - cover/team/empty placeholder dark: `1024x1024`
  - group/solo/label badge dark: `1024x1024`

## QA gates
- contrast regression test added:
  - `mobile/src/tokens/darkModeContrast.test.ts`
- asset resolution regression test added:
  - `mobile/src/utils/assetRegistry.test.ts`
- launch gate dark-asset regression test added:
  - `mobile/src/components/launch/LaunchGate.test.tsx`

## Verification commands
- `cd mobile && npm run test -- --runInBand src/utils/assetRegistry.test.ts src/tokens/theme.test.tsx src/tokens/darkModeContrast.test.ts src/components/launch/LaunchGate.test.tsx src/features/calendarControls.test.tsx src/features/searchTab.test.tsx src/features/radarTab.test.tsx src/features/entityDetailScreen.test.tsx src/features/releaseDetailScreen.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview`
- `git diff --check`

## Notes
- service glyph exports remain shared between light/dark; contrast comes from semantic tint tokens, not duplicate PNGs.
- debug metadata surface was moved onto theme tokens so it no longer hardcodes light-only colors.
