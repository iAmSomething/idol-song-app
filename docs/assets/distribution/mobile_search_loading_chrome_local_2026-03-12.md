# Mobile Search Loading Chrome Local Verification

- Date: 2026-03-12
- Issue: #622

## Summary

- Initial empty search load still uses the existing full-screen loading state.
- Non-empty in-flight query refresh now keeps the search chrome visible and shows a compact loading notice instead of replacing the entire screen.

## Verification

- `cd mobile && npm test -- --runInBand src/features/searchTabLoading.test.tsx src/features/searchTab.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `git diff --check`

## Notes

- Loading-specific regression covers:
  - query-present loading keeps search input visible
  - compact loading notice renders in the results section
  - empty initial load still renders the full-screen loading state
