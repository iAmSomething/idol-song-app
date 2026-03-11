# Mobile Search Debounce Local Verification

- Date: 2026-03-12
- Issue: #618

## Summary

- Added a reusable `useDebouncedValue` hook for backend-primary search reads.
- Mobile search now debounces non-empty query changes for backend-primary mode only.
- Empty query clears immediately, and bundled/local mode remains immediate.

## Verification

- `cd mobile && npm test -- --runInBand src/hooks/useDebouncedValue.test.tsx src/features/searchTab.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `git diff --check`

## Notes

- Search tab regression stayed green with the current non-backend test runtime.
- The debounce hook regression covers:
  - initial render immediate
  - delayed non-empty updates when enabled
  - immediate clear on empty query
  - disabled mode immediate updates
