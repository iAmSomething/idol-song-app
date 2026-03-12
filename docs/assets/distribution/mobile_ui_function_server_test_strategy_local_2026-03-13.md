# Mobile UI, Functional, and Server Communication Test Strategy Local Evidence 2026-03-13

## Purpose
- lock a single runnable verification path for iOS/Android mobile UI, functional flows, and backend communication
- prove the grouped suites and platform sanity entrypoints execute locally

## Commands run

### Server communication suite
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run test:qa:server
```

Result:
- PASS
- suites: `8`
- tests: `47`

### UI primitives suite
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run test:qa:ui
```

Result:
- PASS
- suites: `10`
- tests: `16`

### Functional surface suite
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run test:qa:functional
```

Result:
- PASS
- suites: `8`
- tests: `38`
- note: Jest printed the existing open-handle warning after completion, but all target suites passed

### Typecheck
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run typecheck
```

Result:
- PASS

### Lint
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run lint
```

Result:
- PASS with existing generated-file warning only
- warning file: `mobile/.expo/types/router.d.ts`

### Platform sanity
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run verify:qa:platforms
```

Result:
- PASS
- `config:preview` succeeded
- `config:production` succeeded
- preview iOS export generated: `/tmp/idol-song-app-mobile-export-ios`
- preview Android export generated: `/tmp/idol-song-app-mobile-export-android`

## Added coverage in this pass
- `backendReadClient.test.ts`
  - search request contract
  - radar request contract
  - entity detail request contract
- `calendarBottomSheet.test.tsx`
  - now uses the same API-first dataset harness style as other calendar tests
- `specParity.test.ts`
  - stale exact upcoming suppression expectation aligned with current same-day rules

## Outcome
- grouped strategy commands are runnable
- CI can call the same grouped suites instead of a generic single `npm test`
- iOS/Android platform sanity is now part of the documented local verification path
