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
- 백엔드 migration runtime gate 스펙: `docs/specs/backend/migration-runtime-gates.md`
- 웹 cutover rollback drill 스펙: `docs/specs/backend/web-cutover-rollback-drills.md`
- JSON snapshot demotion 스펙: `docs/specs/backend/json-snapshot-demotion.md`
- 백엔드 shared read API 스펙: `docs/specs/backend/shared-read-api-contracts.md`
- 백엔드 mobile adoption readiness review: `docs/specs/backend/mobile-adoption-readiness-review.md`
- 백엔드 rollout plan 스펙: `docs/specs/backend/phased-rollout-plan.md`
- 백엔드 migration epic 스펙: `docs/specs/backend/backend-migration-epic.md`
- 백엔드 structured logging policy: `docs/specs/backend/structured-backend-logging-policy.md`
- 백엔드 backup/restore recovery drill: `docs/specs/backend/neon-backup-restore-recovery-drill.md`
- 백엔드 projection query-plan regression check: `docs/specs/backend/projection-query-plan-regression-check.md`
- 백엔드 secret inventory / rotation ownership: `docs/specs/backend/backend-secret-inventory-and-rotation.md`
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
- `tracking_watchlist.json`
  전체 추적 대상 그룹 목록
- `upcoming_release_candidates.json`
  미래 컴백 후보 스캔 결과
  `scheduled_date`(exact only), `scheduled_month`, `date_precision`, `date_status`를 함께 가진다.
- `manual_review_queue.json`
  수동 검토가 필요한 그룹/예정 후보 큐
- `web/src/data/releases.json`
  exact date hydration 대상의 최신 release 상태
- `web/src/data/releaseHistory.json`
  팀 페이지 yearly timeline / album history용 full verified release history
- `web/src/data/releaseArtwork.json`
  hydration으로 보강되는 커버 이미지 데이터
- `web/src/data/releaseDetails.json`
  hydration으로 보강되는 트랙/링크/MV 데이터
- `web/src/data/youtubeChannelAllowlists.json`
  팀 채널과 label-owned MV 업로드 채널을 함께 담는 official YouTube allowlist
- `release_detail_overrides.json`
  MusicBrainz relation만으로 찾지 못한 canonical YouTube Music release object URL과 official YouTube MV watch URL을 보존하는 curated override
- `mv_manual_review_queue.json`
  ambiguous 또는 unresolved MV row를 수동 검토 대상으로 분리한 큐
- `youtube_mv_candidate_scoring.py`
  official channel, title, date, view-count, negative keyword를 함께 보는 MV candidate scoring model
- `mv_coverage_report.json`
  canonical MV backfill 전후 coverage와 unresolved remainder를 요약한 리포트
- `web/src/data/*.json`
  transitional export / debug / emergency fallback용 정적 데이터

### Historical Release Detail Builder Contract

- entrypoint: `build_release_details_musicbrainz.py`
- input contract:
  - `web/src/data/releaseHistory.json`의 `releases[]`를 full catalog source로 순회한다.
  - `web/src/data/releases.json`의 `latest_song` / `latest_album`는 baseline comparison 용도로만 읽고, detail generation source of truth로는 더 이상 쓰지 않는다.
- stable release-detail key:
  - `group + release_title + release_date + stream`
  - lower-cased exact key를 `release_detail_overrides.json` lookup과 canonical import 연결 기준으로 유지한다.
- compatibility rule:
  - 기존 richer detail row가 exact key로 안 잡히더라도 같은 `group + normalized title + stream` 조합에서 날짜가 `7일` 이내로만 어긋난 경우 relaxed match로 이어받는다.
  - output row key는 항상 현재 full catalog row의 exact key를 따른다.
- coverage / contract evidence:
  - `backend/reports/historical_release_detail_coverage_report.json`
  - `backend/reports/historical_release_detail_coverage_summary.md`
  - 여기서 `latest_snapshot_input_rows`, `full_catalog_input_rows`, `historical_input_gain_rows`, `breakdowns.by_year`, `breakdowns.by_release_kind`, `top_gap_entities`, `cutover_gates`, `override_sample_matches`, `legacy_spot_checks`를 같이 본다.
- title-track inference contract:
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

python build_tracking_watchlist.py
python scan_upcoming_candidates.py
python build_manual_review_queue.py

cp tracking_watchlist.json web/src/data/watchlist.json
cp upcoming_release_candidates.json web/src/data/upcomingCandidates.json
python youtube_channel_allowlists.py
python backfill_release_detail_mvs.py
python hydrate_release_windows.py
python build_mv_manual_review_queue.py
python build_release_change_log.py
python -m unittest test_youtube_mv_candidate_scoring.py
```

Neon canonical DB까지 같이 최신화하려면 아래를 이어서 실행한다.

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

python3 -m pip install -r backend/requirements-import.txt
python3 sync_upcoming_pipeline_to_neon.py
python3 sync_release_pipeline_to_neon.py
```

### 백엔드 migration baseline

- migration location: `backend/sql/migrations/`
- run note: `backend/sql/README.md`
- upcoming dual-write report: `backend/reports/upcoming_pipeline_db_sync_summary.json`
- projection refresh report: `backend/reports/projection_refresh_summary.json`
- endpoint shadow-read report: `backend/reports/backend_shadow_read_report.json`
- backup/restore drill artifact: `backend/reports/neon_backup_restore_drill_2026-03-08.json`
- backend secret rotation tabletop artifact: `backend/reports/backend_secret_rotation_tabletop_2026-03-08.md`

### 모바일 워크스페이스 baseline

- workspace entry: `mobile/README.md`
- Expo Router route scaffold: `mobile/app/`
- shared module scaffold: `mobile/src/`
- package/runtime baseline: `mobile/package.json`, `mobile/app.config.ts`, `mobile/eas.json`, `mobile/tsconfig.json`
- env/runtime config layer: `mobile/.env.example`, `mobile/src/config/runtime.ts`
- failure-policy layer: `mobile/src/services/datasetFailurePolicy.ts`
- debug metadata helper/surface: `mobile/src/config/debugMetadata.ts`, `mobile/app/debug/metadata.tsx`
- feature-gate layer: `mobile/src/config/featureGates.ts`
- dataset-source layer: `mobile/src/services/datasetSource.ts`, `mobile/assets/datasets/README.md`
- storage/cache layer: `mobile/src/services/storage.ts`, `mobile/src/services/datasetCache.ts`, `mobile/src/services/recentQueries.ts`
- external handoff layer: `mobile/src/services/handoff.ts`
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
- `.github/workflows/deploy-pages.yml`은 GitHub repository variable `VITE_API_BASE_URL`을 읽을 수 있게 열려 있다.

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
- 프론트엔드 빌드 검증
- 데이터 변경 시 자동 커밋

### Deploy Pages

파일: `.github/workflows/deploy-pages.yml`

- `web/` 앱을 빌드
- `web/dist`를 GitHub Pages에 배포
- `main` 브랜치의 웹 변경 사항을 자동 반영

### Deploy Backend

파일: `.github/workflows/backend-deploy.yml`

- preview backend는 `main`의 backend 관련 변경 시 자동 deploy
- production backend는 `workflow_dispatch`에서 수동 승격
- 두 경로 모두 backend `npm ci`, `npm run build`, `npm run test`를 선행한 뒤 Railway CLI deploy를 실행
- GitHub Environment `preview`, `production`에 `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID`, `BACKEND_PUBLIC_URL`를 설정해야 함

backend deploy topology와 rehearsal 규칙은 `docs/specs/backend/preview-staging-backend-path.md`, public read rate-limit 정책은 `docs/specs/backend/public-read-rate-limit-policy.md`, 운영 entrypoint는 `backend/README.md`에 정리돼 있습니다.

## 현재 방향

이 저장소는 `K-pop 발매 캘린더`에서 끝나는 프로젝트가 아니라, 앞으로 아래 방향으로 확장할 수 있습니다.

1. Weverse, 기획사 공지, 공식 SNS 파서 추가
2. 선공개곡, 타이틀곡, OST, 협업곡 분리
3. 그룹/솔로/유닛 통합 일정 뷰
4. 앱 푸시 알림 또는 외부 캘린더 구독 연동
