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
- 백엔드 canonical model 스펙: `docs/specs/backend/canonical-backend-data-model.md`
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
  프론트엔드에서 직접 읽는 정적 데이터

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

## 현재 방향

이 저장소는 `K-pop 발매 캘린더`에서 끝나는 프로젝트가 아니라, 앞으로 아래 방향으로 확장할 수 있습니다.

1. Weverse, 기획사 공지, 공식 SNS 파서 추가
2. 선공개곡, 타이틀곡, OST, 협업곡 분리
3. 그룹/솔로/유닛 통합 일정 뷰
4. 앱 푸시 알림 또는 외부 캘린더 구독 연동
