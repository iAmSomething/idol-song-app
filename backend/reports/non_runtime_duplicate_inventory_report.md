# Non-runtime Duplicate Inventory Report

- generated_at: 2026-03-11T19:32:30.073Z
- quarantine_policy_version: v1

## Summary

- non-runtime duplicate files detected: 1
- quarantine status: move scratch duplicates out of tracked workspace before treating the worktree as operator-clean
- groups with duplicates: 1

## Duplicate Inventory

| Duplicate | Canonical | Group | Decision |
| --- | --- | --- | --- |
| web/public/release-placeholder 2.svg | web/public/release-placeholder.svg | Web workspace scratch | quarantine_outside_runtime_scope |

## Groups

### Workflow drafts

- duplicate_count: 0
- quarantine_rule: Move draft workflow copies to /tmp or a gitignored scratch path before the next PR.

### Backend workspace scratch

- duplicate_count: 0
- quarantine_rule: Keep only the canonical backend source file in-repo; move experiments to /tmp or gitignored local scratch.

### Docs distribution evidence

- duplicate_count: 0
- quarantine_rule: Keep one dated evidence file only; remove suffixed copies after choosing the canonical evidence artifact.

### Docs/spec variants

- duplicate_count: 0
- quarantine_rule: Promote one spec file to canonical or move the variant out of docs/specs before review.

### Mobile asset drafts

- duplicate_count: 0
- quarantine_rule: Keep active asset exploration outside the tracked asset tree or replace the canonical asset in a single step.

### Mobile workspace scratch

- duplicate_count: 0
- quarantine_rule: Move temporary mobile copies to a gitignored scratch location; leave only the canonical workspace file in-repo.

### Web workspace scratch

- duplicate_count: 1
- quarantine_rule: Move temporary web copies to a gitignored scratch location; do not keep suffixed copies under web/.
- duplicate: web/public/release-placeholder 2.svg -> web/public/release-placeholder.svg

### Repo root misc scratch

- duplicate_count: 0
- quarantine_rule: Move root-level scratch copies out of the repo root once the canonical file is identified.
