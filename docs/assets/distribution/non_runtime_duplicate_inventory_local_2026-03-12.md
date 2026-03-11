# Non-runtime Duplicate Inventory Local Note (2026-03-12)

## Goal

- close `#616`
- add repo-wide non-runtime duplicate inventory
- exclude runtime-facing duplicate scope already handled by `#540`
- document quarantine policy instead of deleting user scratch files

## Local checks

```bash
cd backend
node --test ./scripts/lib/nonRuntimeDuplicateInventory.test.mjs ./scripts/lib/runtimeArtifactRetention.test.mjs
npm run duplicate:inventory
npm run build
cd ..
git diff --check
```

## Notes

- non-runtime duplicate scanner excludes runtime-facing canonical duplicates by reusing the runtime retention resolver.
- generated cache directories like `__pycache__` are excluded from the inventory.
- duplicate files are grouped by area (`workflow`, `backend`, `docs`, `mobile`, `web`, `repo root misc`).
- policy source-of-truth is `docs/non-runtime-duplicate-quarantine-policy.md`.
- current clean-branch inventory reports one remaining tracked non-runtime duplicate: `web/public/release-placeholder 2.svg`.
