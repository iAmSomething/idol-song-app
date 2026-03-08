# Neon Backup / Restore Recovery Drill

## 목적

이 문서는 canonical Neon-backed backend에서 bad migration 또는 destructive sync 이후
"어떤 순서로 백업 snapshot을 만들고, 어디에 restore rehearsal을 띄우고, 무엇으로 usable state를 판정하는가"를 고정한다.

이번 baseline drill은 별도 preview DB가 없는 로컬 환경을 전제로,
현재 Neon database 안의 isolated schema clone을 `backup -> restore` 경로로 사용한다.
즉 production-facing `public` schema는 건드리지 않고,
임시 `recovery_backup_*`, `recovery_restore_*` schema를 만들어 read-path recovery를 연습한다.

## 전제 조건

- `DATABASE_URL` direct Neon connection string
- `backend/dist/server.js`
- representative read endpoint smoke contract
- local operator가 schema create / drop 권한을 가진 상태

## Drill Strategy

1. `public`의 canonical tables + projection objects를 isolated `backup schema`로 clone
2. `backup schema`를 다시 isolated `restore schema`로 clone
3. backend를 `restore schema,public` search path로 기동
4. representative read endpoint live smoke 수행
5. usable state가 확인되면 임시 schema cleanup

현재 baseline에서 clone하는 object는 아래다.

- canonical tables 15개
- projection objects 5개

즉 drill은 "usable backend read state를 복구할 수 있는가"에 초점을 둔다.
full PITR 또는 separate Neon branch failover까지 대체하는 것은 아니다.

## Command

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm run build
npm run recovery:drill -- --report-path ./reports/neon_backup_restore_drill_2026-03-08.json
```

옵션:

- `--port <n>`
- `--timeout-ms <n>`
- `--report-path <path>`
- `--keep-schemas`

`--keep-schemas`는 디버깅 목적 외에는 사용하지 않는다.

## Success Criteria

- backup schema clone 성공
- restore schema clone 성공
- restored schema 대상 backend `/health` 성공
- restored schema 대상 live smoke 성공
- restored schema 대상 `/ready` diagnostic 확보
- restore 후 representative endpoint가 아래 contract를 만족
  - `/ready`
    - success gate가 아니라 diagnostic artifact
    - `database.status = ready` 여부와 `status/reasons`를 기록
    - projection/parity/shadow artifact를 restored schema 기준으로 다시 생성하지 않으면 `not_ready`일 수 있음
  - `/v1/search?q=최예나`
    - `YENA` entity hit 존재
  - `/v1/entities/yena`
    - identity payload 존재
  - `/v1/releases/lookup?...IVE / REVIVE+...`
    - stable `release_id` resolve
  - `/v1/radar`
    - `weekly_upcoming`, `rookie` array 존재

## Artifact

drill artifact는 `backend/reports/neon_backup_restore_drill_<date>.json`에 남긴다.

최소 포함 항목:

- generated timestamp
- strategy / limitations
- backup schema / restore schema name
- object-level row counts
- diagnostic `/ready` response
- live smoke summary
- cleanup 결과

## 한계와 후속

이 baseline은 local toolchain에 `pg_dump/pg_restore`, separate preview DB가 없을 때도 연습할 수 있는 최소 recovery rehearsal이다.

후속 강화 방향:

- separate preview Neon branch에 restore rehearsal
- `pg_dump` 또는 vendor snapshot export artifact 포함
- restore 후 write-path integrity와 dual-write repair rehearsal까지 확장
