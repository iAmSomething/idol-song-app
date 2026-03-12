# Backend Release Detail Scoped Rerun Local Verification (2026-03-12)

## Scope

- issue: `#658`
- branch: `codex/658-cohort-scoped-release-detail-rebuild`
- objective:
  - add `--cohorts` to `build_release_details_musicbrainz.py`
  - keep full `release_detail_catalog.json` intact while recomputing only scoped rows
  - keep review queue / coverage report generation valid under scoped execution

## Commands

```bash
source .venv/bin/activate
python -m unittest test_build_release_details_musicbrainz.py
python -m py_compile build_release_details_musicbrainz.py test_build_release_details_musicbrainz.py
python build_release_details_musicbrainz.py --skip-acquisition --cohorts latest,recent > /tmp/idol-song-app-scoped-release-detail-report.json
python build_mv_manual_review_queue.py > /tmp/idol-song-app-scoped-mv-queue-report.json
git diff --check
```

## Observations

- scoped latest/recent rebuild completed without rewriting unrelated release rows
- scoped coverage report exposed:
  - `execution_scope.targeted_rebuild = true`
  - `execution_scope.cohorts = ["latest", "recent"]`
  - `full_catalog_input_rows = 815`
- scoped queue counts observed during verification:
  - `title_track_review_queue_rows = 236`
  - `release_detail_review_queue_rows = 799`
- generated report/queue snapshots were restored after verification so this issue only ships tooling/docs changes

## Result

- status: `pass`
