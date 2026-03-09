# Pages Read Bridge Fix Report

Date: 2026-03-09
Issue: [#388](https://github.com/iAmSomething/idol-song-app/issues/388)

## Root Cause

The shipped GitHub Pages bundle could be built with an empty `VITE_API_BASE_URL`.

When that happened, cut-over web surfaces still generated root-relative API paths:

- `/v1/calendar/month?month=2026-02`
- `/v1/radar`
- `/v1/releases/lookup?...`
- `/v1/releases/:id`

On GitHub Pages those requests terminate at the Pages origin itself, so the response is a static `404/not_found` before the request ever reaches the backend. Because the request never entered the backend runtime, there is no backend `request_id` to inspect for the failing path.

## Fix

Two changes were applied together:

1. Build-time read bridge generation
   - `web/scripts/build-pages-read-bridge.mjs`
   - emits `web/public/__bridge/v1/**`

2. Runtime path rewrite when `VITE_API_BASE_URL` is empty
   - calendar month -> `__bridge/v1/calendar/months/<month>.json`
   - radar -> `__bridge/v1/radar.json`
   - release lookup/detail -> `__bridge/v1/releases/lookups/*.json`, `__bridge/v1/releases/details/*.json`

## Prevention

Deploy-time regression gate:

- `.github/workflows/deploy-pages.yml`
- runs `npm run verify:pages-read-bridge` before `npm run build`

The verification step asserts that:

- populated month `2026-02` exists
- `radar.json` exists and contains expected sections
- known release detail lookup/detail for `BLACKPINK / DEADLINE / 2026-02-26 / album` resolves and includes tracks

## Before / After Trace Evidence

### Before fix

| Surface | Failing request target | Result | Backend request_id |
| --- | --- | --- | --- |
| calendar month | `/v1/calendar/month?month=2026-02` | Pages same-origin `404/not_found` | unavailable |
| radar | `/v1/radar` | Pages same-origin `404/not_found` | unavailable |
| release lookup | `/v1/releases/lookup?entity_slug=blackpink&title=DEADLINE&date=2026-02-26&stream=album` | Pages same-origin `404/not_found` | unavailable |

`unavailable` here is expected because the request never crossed the backend boundary.

### After fix

`npm run verify:pages-read-bridge` output:

- `calendarRequestId = bridge-calendar-2026-02`
- `radarRequestId = bridge-radar`
- `lookupRequestId = bridge-release-lookup-lookup-cb0b3325`
- `detailRequestId = bridge-release-detail-bridge-release-84119c6c`
- `releaseId = bridge-release-84119c6c`
- `trackCount = 5`

The known release detail example is `BLACKPINK / DEADLINE`, and the bridge lookup resolves to a non-empty detail payload.

## Verification Summary

- `npm run build:pages-read-bridge`
- `npm run verify:pages-read-bridge`
- `npm run lint`
- `npm run build`
- `git diff --check`

All passed on 2026-03-09.
