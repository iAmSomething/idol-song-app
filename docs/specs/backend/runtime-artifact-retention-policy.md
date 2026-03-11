# Runtime Artifact Retention Policy

이 문서는 runtime-facing JSON / pipeline script가 suffix copy (` 2`, ` 3`, ` 4`)로 분기되는 것을 금지하고, canonical 보존 경로를 고정한다.

닫는 문제:

- `#540`: Remove duplicate generated artifacts and define one canonical retention policy for runtime-facing JSON and pipeline scripts

## 1. Scope

이 정책은 아래 두 영역만 대상으로 본다.

1. repo root의 runtime-facing pipeline script / generated data
2. `web/src/data`의 shipped runtime export

mobile asset draft, docs scratch copy, 개인 메모는 이 정책의 직접 대상이 아니다. 다만 runtime-facing path 옆에 suffix copy를 두는 식의 작업 방식은 금지한다.

## 2. Canonical Runtime-facing Paths

### Repo Root Pipeline Scripts

- `build_release_details_musicbrainz.py`
- `build_manual_review_queue.py`
- `build_release_change_log.py`
- `build_release_history_musicbrainz.py`
- `build_release_rollup_from_history.py`
- `build_tracking_watchlist.py`
- `scan_upcoming_candidates.py`
- `hydrate_release_windows.py`
- `build_canonical_entity_metadata.py`
- `build_release_artwork_catalog.py`

### Repo Root Generated Data

- `tracking_watchlist.json`
- `upcoming_release_candidates.json`
- `upcoming_release_candidates.csv`
- `manual_review_queue.json`
- `manual_review_queue.csv`
- `canonical_entity_metadata.json`
- `verified_release_history_mb.json`
- `verified_release_history_mb.csv`
- `group_latest_release_since_2025-06-01_mb.json`
- `group_latest_release_since_2025-06-01_mb.csv`

### Web Runtime Data Exports

- `web/src/data/artistProfiles.json`
- `web/src/data/releaseArtwork.json`
- `web/src/data/releaseDetails.json`
- `web/src/data/releaseHistory.json`
- `web/src/data/releases.json`
- `web/src/data/unresolved.json`
- `web/src/data/upcomingCandidates.json`
- `web/src/data/watchlist.json`
- `web/src/data/youtubeChannelAllowlists.json`

## 3. Forbidden Retention Pattern

아래 패턴은 runtime-facing path에서 금지한다.

- `artistProfiles 2.json`
- `releaseDetails 3.json`
- `build_release_details_musicbrainz 2.py`

즉 suffix copy (` * 2.*`, ` * 3.*`, ` * 4.*`)는 canonical runtime-facing directory 안에 남기지 않는다.

이유는 단순하다.

- import / build / runtime audit가 어떤 파일이 canonical인지 헷갈리게 만든다.
- 사람 리뷰 때 stale copy가 source-of-truth처럼 오해된다.
- gap audit / readiness / report bundle이 실제 blocker가 아닌 filesystem noise를 읽게 된다.

## 4. Allowed Temporary Paths

비교용 임시 산출물은 아래에만 둔다.

- `docs/assets/distribution/`
- `backend/reports/`
- `/tmp`
- gitignored 개인 scratch path

runtime-facing canonical directory 옆에 직접 suffix copy를 두는 방식은 허용하지 않는다.

## 5. Retention Decision Rule

suffix copy를 발견했을 때 decision은 아래 중 하나만 쓴다.

1. `delete_duplicate`
   - canonical file이 이미 있고 suffix copy가 비교/임시본일 때
2. `promote_to_canonical_then_delete_duplicate`
   - suffix copy만 최신이고 canonical file이 stale여서 내용 승격이 먼저 필요할 때
3. `archive_outside_runtime_path`
   - review evidence로 남겨야 하지만 runtime-facing path에 두면 안 될 때

현재 운영 기본값은 `delete_duplicate`다. runtime-facing path 안의 suffix copy는 source-of-truth가 아니라고 가정한다.

## 6. Operator Loop

운영자는 아래 순서로 본다.

1. `npm run artifact:retention`
2. `backend/reports/runtime_artifact_retention_report.json`
3. `backend/reports/backend_gap_audit_report.json`

판정:

- duplicate count `0`
  - pass
- duplicate count `> 0`
  - cleanup required
- duplicate가 실제 canonical import/build path와 겹치면
  - same-day fix

## 7. Relationship To Gap Audit

`backend gap audit`는 runtime-facing duplicate artifact count를 계속 요약하지만,
세부 inventory / canonical list / delete rule은 `runtime_artifact_retention_report.*`가 정본이다.

즉:

- policy source-of-truth: 이 문서
- machine-readable inventory: `backend/reports/runtime_artifact_retention_report.json`
- human-readable summary: `backend/reports/runtime_artifact_retention_report.md`

## 8. Acceptance Target

`#540` 이후 기준선은 아래다.

- runtime-facing canonical path는 문서화돼 있어야 한다.
- suffix copy는 runtime-facing import/build path에 남지 않아야 한다.
- duplicate inventory는 script로 재생성 가능해야 한다.
