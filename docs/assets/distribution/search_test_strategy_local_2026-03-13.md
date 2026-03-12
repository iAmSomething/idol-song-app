# Search Test Strategy Local Verification (2026-03-13)

## Scope

- backend `/v1/search`
- web bridge/runtime search coverage
- mobile backend-primary search tab

## Commands

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/backend
node --import tsx --test ./src/route-contract.test.ts

cd /Users/gimtaehun/Desktop/idol-song-app/web
npm run test:search-runtime
npm run test:pages-read-bridge
npm run verify:pages-read-bridge
npm run lint
npm run build

cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm test -- --runInBand src/features/searchTab.test.tsx src/features/searchTabLoading.test.tsx
npm run typecheck
npm run lint
```

## Expected Acceptance

- backend exact display-name query returns `200`
- backend unknown query returns `200 + empty arrays`
- web bridge matcher resolves `하투하`, `REVIVE+`, unknown query correctly
- web bridge coverage blocks stale same-day upcoming search rows
- mobile search shows explicit retry state on backend error
