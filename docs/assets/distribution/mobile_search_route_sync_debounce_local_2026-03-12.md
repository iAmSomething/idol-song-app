# Mobile Search Route Sync Debounce Local Verification

- Date: 2026-03-12
- Issue: #620

## Summary

- Search tab route param sync now debounces non-empty query updates while the input is focused.
- Clear, cancel, submit, and segment changes still flush route state immediately.
- This reduces `router.setParams` churn during active typing without changing search semantics.

## Verification

- `cd mobile && npm test -- --runInBand src/features/searchTab.test.tsx`
- `cd mobile && npm run typecheck`
- `cd mobile && npm run lint`
- `git diff --check`

## Notes

- Regression test covers:
  - focused typing does not immediately call `setParams`
  - debounce flush after `250ms`
  - segment switch flushes immediately
  - clear button resets route params immediately
