# Backend Schedule Delivery Root Cause Local Verification

- Date: 2026-03-12
- Scope: `#660`

## Root cause

Both scheduled worker workflows were still failing as `workflow file issue` on push-derived validation runs.
The offending pattern was direct `secrets.*` usage inside workflow `if:` conditionals:

- `.github/workflows/weekly-kpop-scan.yml`
- `.github/workflows/catalog-enrichment-refresh.yml`

GitHub Actions requires secret-dependent conditionals to read from `env`, not directly from `secrets` in `if:`.

## Fix

- Moved `DATABASE_URL` to job-level `env`
- Changed install step conditionals from:
  - `if: ${{ secrets.DATABASE_URL != '' }}`
- To:
  - `if: ${{ env.DATABASE_URL != '' }}`
- Added a repo guard:
  - `cd backend && npm run workflow:verify`

## Verification

```bash
cd backend
node --test ./scripts/lib/workflowConditionGuard.test.mjs
npm run workflow:verify
npm run build
```

## Observed result

- `workflow_condition_guard_report.json.status = pass`
- `workflow_condition_guard_report.json.violation_count = 0`
- backend build passes

## Remaining blocker

This fixes the workflow-file root cause and adds a regression guard, but it does not fabricate a real
`event=schedule` sample. `#660` still needs the next actual scheduled delivery before cadence/runtime
artifacts can fully clear.
