# Same-day Release Acceptance Loop

`P1Harmony` same-day release path는 partial improvement를 허용하지 않는다.
이 문서는 `#671`, `#672`, `#673`, `#674`, `#675`를 묶는 실행 규칙과
실패 상태 기록 형식을 고정한다.

## Scheduling Policy

same-day release verification은 daily upcoming discovery와 분리된 workflow를 사용한다.

- daily discovery:
  - workflow: `.github/workflows/weekly-kpop-scan.yml`
  - cadence: `09:00 KST` once per day
  - role: new upcoming/news discovery
- release-day verification:
  - workflow: `.github/workflows/release-day-verification.yml`
  - cadence: `hourly`
  - role: exact-date same-day release promotion and hydration

release-day verification window rules:

1. exact-date upcoming이 `today(KST)`인 경우만 대상이다.
2. explicit release time이 기사/공식 evidence에 있으면 `release_time - 1h`부터 hourly verification을 시작한다.
3. explicit release time이 없으면 `12:00 KST`부터 hourly verification을 시작한다.
4. verification window는 same-day `24:00 KST` 직전까지 유지한다.

## Fixture Set

같은-day release track은 아래 두 fixture를 같이 본다.

1. `YENA / LOVE CATCHER / 2026-03-11`
   - 이미 release-side row가 있는 상태에서 stale upcoming presentation이 남지 않는지 본다.
   - 목적: suppression regression guard
2. `P1Harmony / 2026-03-12`
   - same-day trusted evidence가 들어왔을 때 release-side usability가 다 채워졌는지 본다.
   - 목적: promotion + hydration acceptance

## Repeat-until-pass Rule

이 track은 아래 순서를 strict loop로 반복한다.

1. 코드 또는 data-path를 한 번 수정한다.
2. 즉시 same-day acceptance report를 다시 만든다.
3. runtime gate / bundle / readiness artifact를 다시 만든다.
4. 실패한 fixture와 missing requirement를 기록한다.
5. 남아 있는 가장 앞 blocker를 다음 iteration에서 고친다.
6. `P1Harmony` five-field acceptance가 green이 될 때까지 멈추지 않는다.

`#675`는 이 loop 자체를 유지하는 parent issue다.
`#671`, `#672`, `#673`, `#674`는 `#674`가 fully green이 되기 전에는 닫지 않는다.

## Acceptance Conditions

`P1Harmony` fixture는 아래 여섯 항목이 모두 `pass`여야 complete다.

1. `released_row_present`
2. `album_cover_attached`
3. `track_list_attached`
4. `official_mv_attached`
5. `title_track_attached`
6. `user_facing_not_upcoming_only`

하나라도 빠지면 same-day track은 still failing이다.

## Report Artifacts

canonical report pair:

- `backend/reports/same_day_release_acceptance_report.json`
- `backend/reports/same_day_release_acceptance_report.md`

post-sync verification bundle과 runtime gate는 이 artifact를 함께 읽는다.
즉, same-day acceptance가 fail이면 runtime gate도 `same_day_release_acceptance` dependency에서 fail해야 한다.

## Failed-cycle Update Format

failed verification cycle을 기록할 때는 아래 형식을 그대로 사용한다.

```md
## same-day acceptance status
- reference date: 2026-03-12
- status: FAIL
- fixture: P1Harmony same-day release acceptance
  - missing: released_row, album_cover, track_list, official_mv, title_track, user_surface_suppression
```

이 형식은 `same_day_release_acceptance_report.md`의 `Failed-cycle update template` 섹션에도 항상 같이 남는다.

## Local Verification Sequence

```bash
cd backend
node --test ./scripts/lib/sameDayReleaseAcceptance.test.mjs
npm run same-day:acceptance -- --reference-date 2026-03-12
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
npm run runtime:gate -- --bundle-path ./reports/report_bundle_metadata.json
```

필요하면 이후에 parity / scorecard까지 같은 bundle path로 다시 돌린다.

## Workflow Integration

scheduled verification chain은 `report:bundle` 전에 반드시 `npm run same-day:acceptance`를 실행해야 한다.
그래야 failed cycle이 artifact, runtime gate, readiness report에 같은 run timestamp로 남는다.

hourly workflow는 `same_day_release_targets.py`로 active window를 먼저 계산한 뒤,
eligible group만 `hydrate_release_windows.py`에 넘긴다.

## Trusted Promotion Evidence

same-day provisional promotion은 generic 기사 링크를 그대로 믿지 않는다.
promotion evidence는 아래 kind로 분류된 경우에만 guarded provisional release를 만들 수 있다.

1. `official_notice`
   - `agency_notice`, `weverse_notice`
2. `official_social`
   - `official_social` + `x.com`, `instagram.com`, `facebook.com`, `tiktok.com`
3. `official_youtube`
   - `youtube.com`, `youtu.be`, `music.youtube.com`
4. `trusted_catalog`
   - `musicbrainz.org`, `open.spotify.com`, `spotify.com`, `melon.com`

promotion row는 `detail_provenance`에 evidence kind를 남긴다.

- `trusted_upcoming_signal.same_day_official_notice`
- `trusted_upcoming_signal.same_day_official_social`
- `trusted_upcoming_signal.same_day_official_youtube`
- `trusted_upcoming_signal.same_day_trusted_catalog`

`news_rss` 일반 기사 링크만 있는 경우에는 same-day provisional promotion을 만들지 않고, 기존 review / delayed catalog path로 남긴다.
