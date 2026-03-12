# K-pop Release Calendar

K-pop 그룹의 최근 음원 발매 이력과 미래 컴백 후보 일정을 함께 추적하는 캘린더형 프론트엔드 프로젝트입니다.  
한 번 발매가 뜸했던 팀도 추적 대상에서 빼지 않고, 주간 스캔 파이프라인으로 다시 컴백 신호를 찾아내는 구조를 목표로 합니다.

## 주요 주소

- 서비스 페이지: https://iamsomething.github.io/idol-song-app/
- GitHub 저장소: https://github.com/iAmSomething/idol-song-app
- 주 3회 스캔 워크플로: https://github.com/iAmSomething/idol-song-app/actions/workflows/weekly-kpop-scan.yml
- Pages 배포 워크플로: https://github.com/iAmSomething/idol-song-app/actions/workflows/deploy-pages.yml
- 웹 액션 시스템 스펙: `docs/specs/web/ui-action-system-v1.md`
- 웹 서비스 버튼 스펙: `docs/specs/web/service-button-system-v1.md`
- 웹 모바일 handoff QA matrix: `docs/specs/web/mobile-web-handoff-qa-matrix.md`
- 백엔드 canonical model 스펙: `docs/specs/backend/canonical-backend-data-model.md`
- 백엔드 runtime boundary 스펙: `docs/specs/backend/runtime-and-service-boundaries.md`
- 백엔드 preview/staging rehearsal 경로: `docs/specs/backend/preview-staging-backend-path.md`
- 백엔드 migration 운영 runbook: `docs/specs/backend/migration-operations-runbook.md`
- 백엔드 migration runtime gate / readiness scorecard 스펙: `docs/specs/backend/migration-runtime-gates.md`, `docs/specs/backend/migration-readiness-scorecard.md`
- 백엔드 canonical null hygiene / enrichment 운영 모델: `docs/specs/backend/canonical-null-hygiene-operating-model.md`
- 백엔드 canonical null hygiene cadence / owner checklist: `docs/specs/backend/canonical-null-hygiene-cadence.md`
- 백엔드 runtime artifact retention policy: `docs/specs/backend/runtime-artifact-retention-policy.md`
- 백엔드 JSON snapshot demotion / runtime regression guard: `docs/specs/backend/json-snapshot-demotion.md`
- API-only end-state tracker: `docs/specs/backend/api-only-end-state-tracker.md`
- non-runtime duplicate quarantine policy: `docs/non-runtime-duplicate-quarantine-policy.md`
- 백엔드 trusted upcoming notification event / operator alert 스펙: `docs/specs/backend/trusted-upcoming-notification-events.md`
- 백엔드 same-day release acceptance loop 스펙: `docs/specs/backend/same-day-release-acceptance-loop.md`
- 웹 cutover rollback drill 스펙: `docs/specs/backend/web-cutover-rollback-drills.md`
- JSON snapshot demotion 스펙: `docs/specs/backend/json-snapshot-demotion.md`
- 백엔드 public read API contract: `docs/specs/backend/public-read-api-contract-v1.md`
- 백엔드 shared read API 스펙: `docs/specs/backend/shared-read-api-contracts.md`
- 백엔드 deploy env contract / drift gate: `docs/specs/backend/deploy-environment-contract.md`
- 백엔드 mobile adoption readiness review: `docs/specs/backend/mobile-adoption-readiness-review.md`
- 백엔드 rollout plan 스펙: `docs/specs/backend/phased-rollout-plan.md`
- 백엔드 migration epic 스펙: `docs/specs/backend/backend-migration-epic.md`
- 백엔드 structured logging policy: `docs/specs/backend/structured-backend-logging-policy.md`
- 백엔드 backup/restore recovery drill: `docs/specs/backend/neon-backup-restore-recovery-drill.md`
- 백엔드 projection query-plan regression check: `docs/specs/backend/projection-query-plan-regression-check.md`
- 백엔드 secret inventory / rotation ownership: `docs/specs/backend/backend-secret-inventory-and-rotation.md`
- 모바일 launch-grade visual identity 스펙: `docs/specs/mobile/launch-grade-visual-identity-system.md`
- 모바일 app icon 시스템 스펙: `docs/specs/mobile/app-icon-system.md`
- 모바일 launch visual asset handoff: `docs/specs/mobile/launch-visual-asset-handoff.md`
- 모바일 iOS personal-team signing 가이드: `docs/specs/mobile/ios-preview-signing-personal-team.md`
- 알림 이벤트 모델 스펙: `docs/notification-event-model.md`
- 플레이리스트 연구 메모: `docs/playlist-research.md`

## 프로젝트 개요

이 프로젝트는 단순한 발매 목록이 아니라, 아래 두 층을 함께 관리합니다.

1. 검증된 최근 발매 데이터
2. 미래 시점 컴백 가능성을 보여주는 후보 데이터

즉, `최근에 곡을 낸 팀`만 보여주는 앱이 아니라, `지금은 잠잠하지만 다시 돌아올 수 있는 팀`까지 감시하는 릴리즈 인텔리전스 도구에 가깝습니다.

## 핵심 기능

### 1. 월간 캘린더 UI

- 2025년 6월 이후 검증된 발매곡을 월간 캘린더로 시각화
- 날짜를 누르면 해당 날짜 발매 그룹과 곡 제목을 바로 확인
- 최신 발매 피드를 우측 패널에서 함께 제공

### 2. 전체 추적 워치리스트

- 최근 발매가 있었던 팀만이 아니라, 조건에서 걸러진 팀도 계속 감시
- `recent_release`, `filtered_out`, `needs_manual_review`, `watch_only` 상태로 분리 관리
- 예시로 `WJSN` 같은 장기 공백 팀도 수동 워치 대상에 포함 가능

### 3. 주 3회 컴백 후보 스캔

- Google News RSS 기반으로 미래 날짜가 명시된 기사/발표를 수집
- 그룹별 검색어로 `comeback`, `new album`, `single`, `teaser`, `schedule` 등 키워드 탐색
- 기사 제목, 예정일, 출처 도메인, confidence 값을 후보로 저장

### 4. 자동 데이터 갱신

- GitHub Actions가 매주 월/수/금 오전 9시 KST 기준으로 스캔 실행
- exact date가 있는 예정 컴백은 `D-1` / `D-day` / `D+1` hydration window로 release 산출물을 보강
- 결과 JSON/CSV와 `manual_review_queue.json`/`.csv`, `releaseChangeLog.json`을 함께 갱신
- 변경이 있을 때만 저장소에 자동 커밋

## 데이터 구조

프로젝트는 크게 네 종류의 데이터를 사용합니다.

장기적으로는 아래 JSON 산출물 일부가 정본이 아니라 projection/read model로 이동합니다.
정본 모델 방향은 `docs/specs/backend/canonical-backend-data-model.md`를 기준으로 잡습니다.

- `group_latest_release_since_2025-06-01_mb.json`
  최근 검증된 발매 데이터
- `verified_release_history_mb.json`
  팀 페이지 과거 디스코그래피용 전체 verified release history
- `artist_profiles_seed.json`
  entity seed의 primary canonical snapshot
- `team_badge_assets.json`
  representative image / badge asset의 primary canonical snapshot
- `tracking_watchlist.json`
  전체 추적 대상 그룹 목록
- `upcoming_release_candidates.json`
  미래 컴백 후보 스캔 결과
  `scheduled_date`(exact only), `scheduled_month`, `date_precision`, `date_status`를 함께 가진다.
- `manual_review_queue.json`
  수동 검토가 필요한 그룹/예정 후보 큐
- `group_latest_release_since_2025-06-01_mb.json`
  latest verified release rollup의 primary canonical snapshot
- `release_artwork_catalog.json`
  hydration으로 보강되는 artwork의 primary canonical snapshot
- `canonical_entity_metadata.json`
  canonical entity metadata field export
  `official_youtube`, `official_x`, `official_instagram`, `agency_name`, `debut_year`, `representative_image`
  각각에 `status`, `provenance`, `source_url`, `review_notes`를 함께 가진다.
- `entity_metadata_acquisition.json`
  latest/recent cohort 중심의 reviewed social / agency acquisition overlay
  `build_canonical_entity_metadata.py`가 canonical field selection 전에 먼저 반영한다.
- `release_detail_catalog.json`
  hydration으로 보강되는 track / service link / MV state의 primary canonical snapshot
- `youtube_channel_allowlists.json`
  팀 채널과 label-owned MV 업로드 채널을 함께 담는 official YouTube allowlist의 primary canonical snapshot
- `release_detail_overrides.json`
  MusicBrainz relation만으로 찾지 못한 canonical YouTube Music release object URL과 official YouTube MV watch URL을 보존하는 curated override
- `mv_manual_review_queue.json`
  ambiguous 또는 unresolved MV row를 수동 검토 대상으로 분리한 큐
- `youtube_mv_candidate_scoring.py`
  official channel, title, date, view-count, negative keyword를 함께 보는 MV candidate scoring model
- `mv_coverage_report.json`
  canonical MV backfill 전후 coverage와 unresolved remainder를 요약한 리포트
- `web/src/data/*.json`
  위 primary snapshot에서 파생되는 secondary mirror / transitional export / debug / emergency fallback용 정적 데이터
- `backend/reports/runtime_artifact_retention_report.json`
  runtime-facing suffix duplicate inventory와 canonical retention 판정 리포트
- `backend/reports/non_runtime_duplicate_inventory_report.json`
  runtime-facing scope 밖 duplicate scratch inventory와 quarantine 판정 리포트

### Historical Release Detail Builder Contract

- entrypoint: `build_release_details_musicbrainz.py`
- input contract:
  - `verified_release_history_mb.json`의 `releases[]`를 full catalog source로 순회한다.
  - `group_latest_release_since_2025-06-01_mb.json`의 `latest_song` / `latest_album`는 baseline comparison 용도로만 읽고, detail generation source of truth로는 더 이상 쓰지 않는다.
- stable release-detail key:
  - `group + release_title + release_date + stream`
  - lower-cased exact key를 `release_detail_overrides.json` lookup과 canonical import 연결 기준으로 유지한다.
- compatibility rule:
  - 기존 richer detail row가 exact key로 안 잡히더라도 같은 `group + normalized title + stream` 조합에서 날짜가 `7일` 이내로만 어긋난 경우 relaxed match로 이어받는다.
  - output row key는 항상 현재 full catalog row의 exact key를 따른다.
- coverage / contract evidence:
  - `backend/reports/historical_release_detail_coverage_report.json`
  - `backend/reports/historical_release_detail_coverage_summary.md`
  - `historical_migration_priority_slice.json`
  - 여기서 `latest_snapshot_input_rows`, `full_catalog_input_rows`, `historical_input_gain_rows`, `breakdowns.by_year`, `breakdowns.by_release_kind`, `top_gap_entities`, `cutover_gates`, `migration_priority_slice`, `override_sample_matches`, `legacy_spot_checks`를 같이 본다.
- null acquisition contract:
  - detail row에 null이 남아 있으면 최소 5개 이상의 서로 다른 acquisition method를 기록한 뒤에만 manual review queue로 보낸다.
  - 현재 builder가 기록하는 method set은 `existing_exact_lookup`, `existing_relaxed_lookup`, `manual_override_lookup`, `musicbrainz_release_group_lookup`, `musicbrainz_release_group_release_lookup`, `musicbrainz_release_search_lookup`, `musicbrainz_release_search_release_lookup`, `youtube_music_pipeline_lookup`, `youtube_mv_pipeline_lookup`, `placeholder_seed_fallback` 이다.
  - 남은 null row는 `release_detail_manual_review_queue.json` / `release_detail_manual_review_queue.csv`에서 `attempted_methods_count`, `attempted_methods`, `compliant_min_attempts`로 확인한다.
- title-track inference contract:
  - `historical_migration_priority_slice.json`에 들어 있는 migration-critical first slice row는 explicit `title_tracks` manual seed로 먼저 고정한다.
  - `release_detail_overrides.json`의 explicit `title_tracks`가 최우선이다.
  - 기존 richer detail row에 이미 `is_title_track`가 있으면 그대로 보존한다.
  - 자동 추론은 아래 순서로만 수행한다:
    - single-track release
    - exact `release_title == track title`
    - song row의 version/instrumental collapse
    - unique `release_title` substring match
    - 같은 group의 nearby song release(`0~180일 이전/동일일`)가 album track과 일치하는 경우
  - double-title는 아래 둘 중 하나일 때만 auto-resolve 한다:
    - two nearby song releases
    - slash-delimited release title 안에 두 track title이 같이 명시된 경우
  - 그 외 ambiguous/unresolved row는 `title_track_manual_review_queue.json` / `title_track_manual_review_queue.csv`로 빠진다.
- MV review dependency:
  - title-track metadata가 바뀌면 `build_mv_manual_review_queue.py`도 다시 실행해서 downstream MV queue를 동기화한다.

## 실행 방법

### 로컬 데이터 갱신

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install requests

python build_release_rollup_from_history.py
python build_tracking_watchlist.py
python scan_upcoming_candidates.py
python build_manual_review_queue.py
python build_entity_metadata_acquisition.py
python build_canonical_entity_metadata.py
python youtube_channel_allowlists.py
python build_release_artwork_catalog.py
python build_entity_asset_coverage_report.py
python backfill_release_detail_mvs.py
python hydrate_release_windows.py --upcoming-path upcoming_release_candidates.json --watchlist-path tracking_watchlist.json
python build_mv_manual_review_queue.py
python build_release_change_log.py --upcoming-path upcoming_release_candidates.json --releases-path group_latest_release_since_2025-06-01_mb.json
python -m unittest test_youtube_mv_candidate_scoring.py
```

scheduled workflow에서는 `web/src/data/*.json`를 commit 대상 운영 산출물로 더 이상 직접 올리지 않는다.
job 내부에서는 transition build/input 용도로 갱신될 수 있지만, commit 전에는 [backend/exports/non_runtime_web_snapshots](/Users/gimtaehun/Desktop/idol-song-app/backend/exports/non_runtime_web_snapshots)로 export하고 `web/src/data`는 restore한다.
collection/enrichment script의 primary input/output도 `artist_profiles_seed.json`, `release_detail_catalog.json`, `release_artwork_catalog.json`, `youtube_channel_allowlists.json` 같은 root canonical snapshot으로 맞췄고, `web/src/data`는 secondary mirror로만 유지한다.

historical migration slice처럼 기존 `releaseDetails` 위에 manual seed만 다시 입히고 싶을 때는 외부 acquisition 없이 아래처럼 빠르게 재생성할 수 있다.

```bash
python build_release_rollup_from_history.py
python build_release_details_musicbrainz.py --skip-acquisition
```

latest/recent blocker 코호트만 빠르게 다시 돌리고 싶다면 scoped rebuild를 쓴다. 이 모드는 전체 `release_detail_catalog.json`을 유지한 채 target cohort row만 재계산하고, review queue / coverage report도 같은 scope 기준으로 다시 만든다.

```bash
python build_release_details_musicbrainz.py --cohorts latest,recent
python build_mv_manual_review_queue.py
```

오래 걸리는 pass를 작게 확인할 때는 progress와 row limit를 같이 건다. progress는 `stderr`로만 찍히기 때문에 기존 JSON stdout consumer는 깨지지 않는다.

```bash
python build_release_details_musicbrainz.py --cohorts latest,recent --max-rows 25 --progress-every 5
python backfill_release_detail_mvs.py --cohorts latest,recent --max-rows 25 --progress-every 5
```

`backfill_release_detail_mvs.py`는 이제 첫 번째 title track만 보지 않고 최대 2개의 title track과 `official music video` / no-suffix fallback query까지 포함해서 candidate breadth를 넓힌다. 긴 latest/recent pass를 다시 돌리기 전에 이 경로를 우선 쓴다.

Neon canonical DB까지 같이 최신화하려면 아래를 이어서 실행한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 sync_upcoming_pipeline_to_neon.py
python3 sync_release_pipeline_to_neon.py
```

scheduled automation도 cadence를 둘로 나눠서 운영한다.

- `.github/workflows/weekly-kpop-scan.yml`
  - daily upcoming/news freshness path
- `.github/workflows/catalog-enrichment-refresh.yml`
  - weekly historical catalog enrichment path

### 백엔드 migration baseline

- migration location: `backend/sql/migrations/`
- run note: `backend/sql/README.md`
- upcoming dual-write report: `backend/reports/upcoming_pipeline_db_sync_summary.json`
- projection refresh report: `backend/reports/projection_refresh_summary.json`
- worker cadence topology report: `backend/reports/worker_cadence_report.json`
- canonical null coverage report: `backend/reports/canonical_null_coverage_report.json`
- canonical null recheck queue: `backend/reports/canonical_null_recheck_queue.json`
- null coverage trend report: `backend/reports/null_coverage_trend_report.json`
- prioritized service-link gap queues: `backend/reports/service_link_gap_queues.json`
- title-track cohort gap queue: `backend/reports/title_track_gap_queue.json`
- entity identity null workbench: `backend/reports/entity_identity_workbench.json`
- entity metadata / asset coverage report: `backend/reports/entity_asset_coverage_report.json`, `backend/reports/entity_asset_coverage_report.md`
- manual curation bundle contract: `docs/specs/backend/manual-curation-bundle-contract.md`
- parent backend gap audit report: `backend/reports/backend_gap_audit_report.json`, `backend/reports/backend_gap_audit_report.md`
- report bundle metadata: `backend/reports/report_bundle_metadata.json`
- backend freshness handoff artifact: `backend/reports/backend_freshness_handoff.json`
- endpoint shadow-read report: `backend/reports/backend_shadow_read_report.json`
- backup/restore drill artifact: `backend/reports/neon_backup_restore_drill_2026-03-08.json`
- backend secret rotation tabletop artifact: `backend/reports/backend_secret_rotation_tabletop_2026-03-08.md`

### 모바일 워크스페이스 baseline

- workspace entry: `mobile/README.md`
- iOS personal-team signing guide: `docs/specs/mobile/ios-preview-signing-personal-team.md`
- Expo Router route scaffold: `mobile/app/`
- shared module scaffold: `mobile/src/`
- package/runtime baseline: `mobile/package.json`, `mobile/app.config.ts`, `mobile/eas.json`, `mobile/tsconfig.json`
- env/runtime config layer: `mobile/.env.example`, `mobile/src/config/runtime.ts`
- failure-policy layer: `mobile/src/services/datasetFailurePolicy.ts`
- debug metadata helper/surface: `mobile/src/config/debugMetadata.ts`, `mobile/app/debug/metadata.tsx`
- feature-gate layer: `mobile/src/config/featureGates.ts`
- dataset-source layer: `mobile/src/services/datasetSource.ts`, `mobile/assets/datasets/README.md`
  - preview / production은 backend-api primary, bundled static은 explicit fallback로만 유지
- storage/cache layer: `mobile/src/services/storage.ts`, `mobile/src/services/datasetCache.ts`, `mobile/src/services/recentQueries.ts`
- external handoff layer: `mobile/src/services/handoff.ts`
- preview release-readiness artifact: `docs/specs/mobile/rn-release-readiness-gate-2026-03-11.md`
- runtime QA artifact: `docs/specs/mobile/rn-runtime-device-qa-2026-03-11.md`
- local iOS VoiceOver sign-off evidence: `docs/assets/distribution/rn_ios_voiceover_signoff_local_2026-03-11.md`
- local runtime QA evidence: `docs/assets/distribution/rn_runtime_device_qa_local_2026-03-11.md`
- backend public consumer contract: `docs/specs/backend/public-read-api-contract-v1.md`
- backend deploy env contract / drift gate: `docs/specs/backend/deploy-environment-contract.md`
- token/theme layer: `mobile/src/tokens/`, `mobile/src/tokens/theme.tsx`
- selector/adapter layer: `mobile/src/selectors/`, `mobile/src/types/displayModels.ts`, `mobile/src/types/rawData.ts`
- quality baseline: `mobile/eslint.config.js`, `mobile/jest.config.js`, `mobile/src/features/route-shell.smoke.test.tsx`, `mobile/src/config/runtime.test.ts`
- CI gate: `.github/workflows/mobile-quality.yml`
- bundled asset baseline: `mobile/assets/`, `mobile/assets/README.md`, `mobile/src/utils/assetRegistry.ts`
- implementation guide: `docs/specs/mobile/expo-implementation-guide.md`

Hydration dry-run 예시:

```bash
python hydrate_release_windows.py --today 2026-03-11 --group P1Harmony --dry-run
python hydrate_release_windows.py --today 2026-03-12 --group P1Harmony --dry-run
python hydrate_release_windows.py --today 2026-03-13 --group P1Harmony --dry-run
```

### 프론트엔드 실행

```bash
cd web
npm install
npm run dev
```

- backend 연결로 띄우려면 `VITE_API_BASE_URL=http://localhost:3213 npm run dev`
- browser에서 separate API base URL을 쓸 때 backend는 `APP_ENV`와 `WEB_ALLOWED_ORIGINS`를 같이 맞춰야 한다. production 기본 origin은 `https://iamsomething.github.io`다.
- committed JSON snapshot은 import/parity/debug artifact로 유지되지만, shipped web cut-over surface의 runtime source switch로는 더 이상 사용하지 않는다.
- `web/.env.example`에는 Pages / preview rehearsal에서 쓰는 API base env baseline이 들어 있다.
- `.github/workflows/deploy-pages.yml`은 GitHub Pages build에 `VITE_API_BASE_URL`과 `VITE_BACKEND_TARGET_ENV=production`을 함께 주입한다.
- `npm run build`는 Pages read bridge(`web/public/__bridge/v1/**`)를 먼저 생성하고, deploy workflow도 `npm run verify:pages-read-bridge`, `npm run verify:pages-backend-target`, `npm run verify:pages-backend-handoff`로 bridge completeness, active backend target wiring, latest backend freshness handoff를 같이 gate로 막는다.
- `backend/reports/backend_freshness_handoff.json`은 latest release sync, latest upcoming sync, projection refresh 순서와 Pages target URL 정합성을 요약한 deploy-time artifact다.
- 내부 inspection path는 `/__bridge/v1/meta/backend-target.json`이며, 앱에서는 `?inspect=backend-target` query로 현재 runtime target 진단 패널을 열 수 있다.

### 프로덕션 빌드

```bash
cd web
npm run build
```

## 자동화 구성

### Upcoming Comeback Scan

파일: `.github/workflows/weekly-kpop-scan.yml`

- 전체 워치리스트 재구성
- 미래 컴백 후보 스캔
- 수동 검토 큐 산출
- exact date 예정 컴백 기준 release hydration 수행
- 변경 로그 산출
- 웹 앱 데이터 동기화
- canonical DB sync / projection refresh 뒤 `backend/reports/backend_freshness_handoff.json` 생성
- 프론트엔드 빌드 검증
- 데이터 변경 시 자동 커밋

### Deploy Pages

파일: `.github/workflows/deploy-pages.yml`

- `web/` 앱을 빌드
- Pages target env / backend target / backend freshness handoff를 모두 검증한 뒤에만 publish
- `web/dist`를 GitHub Pages에 배포
- `main` 브랜치의 웹 변경 사항을 자동 반영

### Deploy Backend

파일: `.github/workflows/backend-deploy.yml`

- preview backend는 `main`의 backend 관련 변경 시 자동 deploy
- production backend는 `workflow_dispatch`에서 수동 승격
- 두 경로 모두 backend `npm ci`, `npm run build`, `npm run test`를 선행한 뒤 Railway CLI deploy를 실행
- GitHub Environment `preview`, `production`에 `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID`, `BACKEND_PUBLIC_URL`를 설정해야 함
- preview deploy는 Railway provided domain을 resolve한 뒤 `preview/BACKEND_PUBLIC_URL`을 다시 동기화하고, 같은 URL로 live smoke와 freshness handoff를 검증함

backend deploy topology와 rehearsal 규칙은 `docs/specs/backend/preview-staging-backend-path.md`, public read rate-limit 정책은 `docs/specs/backend/public-read-rate-limit-policy.md`, canonical live smoke fixture registry와 운영 entrypoint는 `backend/README.md`에 정리돼 있습니다.

## 현재 방향

이 저장소는 `K-pop 발매 캘린더`에서 끝나는 프로젝트가 아니라, 앞으로 아래 방향으로 확장할 수 있습니다.

1. Weverse, 기획사 공지, 공식 SNS 파서 추가
2. 선공개곡, 타이틀곡, OST, 협업곡 분리
3. 그룹/솔로/유닛 통합 일정 뷰
4. 앱 푸시 알림 또는 외부 캘린더 구독 연동
