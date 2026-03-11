# RN Handoff / Visual / Copy Polish Local Note (2026-03-11)

## Scope
- GitHub issues: `#505`, `#506`, `#507`
- Branch: `codex/rn-handoff-copy-polish`

## What changed
- Service handoff buttons now expose Korean-first mode hints:
  - `앱 우선`
  - `검색 결과`
- Canonical vs search fallback behavior is surfaced through accessibility hints on:
  - calendar release actions
  - search release actions
  - team detail latest release actions
  - release detail album, track, MV actions
- Shared mobile copy now centralizes:
  - handoff failure title/body
  - partial-data title
  - short surface labels for `검색`, `레이더`
  - compact summary labels such as `이달 발매`, `예정 일정`, `가까운 일정`
- Shared surface primitives were tightened for large-text legibility:
  - compact hero
  - inset section
  - tonal panel
  - release/upcoming summary rows

## Local verification
- `cd mobile && npm test -- --runInBand src/features/calendarControls.test.tsx src/features/searchTab.test.tsx src/features/radarTab.test.tsx src/features/entityDetailScreen.test.tsx src/features/releaseDetailScreen.test.tsx`
- `cd mobile && npm test -- --runInBand src/services/handoff.test.ts src/components/layout/SummaryStrip.test.tsx src/components/surfaces/SurfacePrimitives.test.tsx src/components/actions/ServiceButtonGroup.test.tsx src/components/identity/TeamIdentityRow.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `git diff --check`

## Notes
- `npm run lint` remains green with the pre-existing warning in `mobile/.expo/types/router.d.ts`.
- This pass validates handoff semantics through canonical/search-fallback resolution and rendered button hints. It does not claim real-device third-party app install QA beyond those runtime contracts.
