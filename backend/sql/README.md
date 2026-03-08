# SQL Migration Run Note

이 디렉터리는 Neon canonical schema migration과 backend projection read-model migration을 둔다.

## 위치

- migration folder: `backend/sql/migrations/`
- canonical baseline: `backend/sql/migrations/0001_canonical_schema.sql`
- projection read model: `backend/sql/migrations/0002_projection_read_models.sql`

## 요구사항

- `DATABASE_URL` 환경 변수
- Node.js
- `backend/package.json`에 정의된 `pg` dependency

## 권장 실행 순서

```bash
set -a
source ~/.config/idol-song-app/neon.env
set +a

cd backend
npm install
npm run migrate:apply
npm run schema:verify
npm run projection:refresh
cd ..
python3 -m pip install -r backend/requirements-import.txt
python3 import_json_to_neon.py
python3 sync_upcoming_pipeline_to_neon.py
python3 sync_release_pipeline_to_neon.py
cd backend
npm run projection:refresh
cd ..
python3 build_backend_json_parity_report.py
cd backend
npm run shadow:verify
```

## 규칙

- migration은 plain SQL 파일을 추가 번호로 누적한다.
- apply helper는 `schema_migrations` 메타 테이블로 재적용을 막는다.
- direct connection string인 `DATABASE_URL`을 우선 사용한다.
- pooler URL은 migration보다 read traffic 용도에 가깝다.
- `schema:verify`는 canonical uniqueness constraint뿐 아니라 slug / alias / release / upcoming lookup에 필요한 required index도 같이 확인한다.
- first JSON baseline import summary는 `backend/reports/json_to_neon_import_summary.json`에 남긴다.
- upcoming pipeline dual-write summary는 `backend/reports/upcoming_pipeline_db_sync_summary.json`에 남긴다.
- release pipeline dual-write summary는 `backend/reports/release_pipeline_db_sync_summary.json`에 남긴다.
- projection refresh summary는 `backend/reports/projection_refresh_summary.json`에 남긴다.
- backend-vs-JSON parity report는 `backend/reports/backend_json_parity_report.json`에 남긴다.
- endpoint shadow-read report는 `backend/reports/backend_shadow_read_report.json`에 남긴다.
- backup / restore drill artifact는 `backend/reports/neon_backup_restore_drill_<date>.json`에 남긴다.
- recovery rehearsal 절차는 `docs/specs/backend/neon-backup-restore-recovery-drill.md`를 기준으로 본다.
