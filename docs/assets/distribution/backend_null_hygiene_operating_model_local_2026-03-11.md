# Backend Null Hygiene Operating Model Local Note

Date: 2026-03-11

## Scope

- `#566`
- `#567`
- `#569`
- `#571`
- `#577`
- `#579`
- `#582`

## What Was Added

- canonical null taxonomy (`required_backfill`, `conditional_null`, `true_optional`, `unresolved`)
- product-critical field family inventory and default bucket
- provenance / status / source-pointer contract
- source precedence and overwrite rules
- product-impact backfill waves
- latest / recent / historical cohort SLA
- readiness / runtime gate linkage for critical null coverage

## Files

- `docs/specs/backend/canonical-null-hygiene-operating-model.md`
- `docs/specs/backend/migration-readiness-scorecard.md`
- `docs/specs/backend/migration-runtime-gates.md`
- `docs/specs/backend/README.md`
- `backend/README.md`
- `README.md`

## Verification

- docs-only change
- `git diff --check`
