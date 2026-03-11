# Backend Shadow Detail Parity Local Check (2026-03-12)

## Scope
- Issue: #601
- Goal: close remaining backend-only shadow drift on web `entity detail` and `release detail` surfaces

## Local verification
- `cd backend && npm run build`
- `cd backend && npx tsx --test ./src/route-contract.test.ts`
- `cd backend && source ~/.config/idol-song-app/neon.env && npm run shadow:verify`
- `cd backend && source ~/.config/idol-song-app/neon.env && npm run migration:scorecard`
- `git diff --check`

## Result
- `entity_detail`: `clean 4/4`, `drift 0/4`
- `release_detail`: `clean 3/3`, `drift 0/3`
- `backend_shadow_read_report.json`: `clean=true`

## Notes
- Final release-detail mismatch was `BLACKPINK / DEADLINE / 2026-02-26` artwork only.
- Fix applied in shadow harness so release detail comparison follows shipped web fallback semantics when backend detail artwork is absent.
- `migration_readiness_scorecard.json` still reports overall `fail`, but the remaining blockers are outside `#601` scope (`runtime/null/historical` gate families).
