# RN iOS Backend Runtime Polish Local Note (2026-03-11)

## Scope
- Issue target: `#544`
- Related but not fully closed in this note: `#545`

## Implemented
- backend read client now applies:
  - `GET` timeout `4.5s`
  - retry `1`
  - retry delay `350ms`
  - retryable status handling for `408/429/502/503/504`
- cached/bundled fallback disclosure now includes clearer Korean copy for:
  - live request failed -> cached snapshot retained
  - live request failed -> bundled fallback used
- backend request id is appended to runtime-facing failure copy when available.
- calendar/search/entity detail/release detail surfaces now expose an explicit retry CTA from degraded-state disclosure.
- iPhone density polish included:
  - calendar summary strip moved into the month header panel
  - compact hero stacks vertically on narrow iPhone widths / large-text mode
  - summary strip full-width stacking threshold tightened so regular iPhone widths stay denser
  - search submit dismisses keyboard and focus state more cleanly

## Automated verification
- `cd mobile && npm test -- --runInBand src/services/backendReadClient.test.ts src/features/useActiveDatasetScreen.test.tsx src/config/debugMetadata.test.ts`
- `cd mobile && npm test -- --runInBand src/features/calendarControls.test.tsx src/features/searchTab.test.tsx src/features/radarTab.test.tsx src/features/entityDetailScreen.test.tsx src/features/releaseDetailScreen.test.tsx src/components/layout/SummaryStrip.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `git diff --check`

All commands passed. `npm run lint` still reports the existing generated-file warning in `mobile/.expo/types/router.d.ts` only.

## iOS runtime check
- Local backend was started with:
  - `source ~/.config/idol-song-app/neon.env && PORT=3213 APP_TIMEZONE=Asia/Seoul npm run start`
- Preview dev client was launched on `iPhone 16e` simulator with:
  - `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3213 npm run qa:preview:ios:sim`
  - `APP_ENV=preview EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3213 npx expo start --dev-client --port 8082`
- Backend logs confirmed preview client traffic against the local API, including:
  - `GET /v1/calendar/month`
  - `GET /v1/search`
  - `GET /v1/radar`
  - `GET /v1/entities/:slug`

## Limitation observed
- `simctl openurl` based route-driving still hit iOS confirmation modal / dev-client home inconsistently, so stable full-surface screenshots were not reliable from automation alone.
- Because of that, this note is sufficient to support the runtime hardening issue `#544`, but not a full visual sign-off for `#545`.
