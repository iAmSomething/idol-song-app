# Backend Area

이 디렉터리는 backend migration 관련 자산을 둔다.

현재 포함 범위:

- `sql/migrations/`
  - Neon baseline schema migration
- `sql/README.md`
  - migration apply / verify run note
- `scripts/`
  - plain SQL migration apply / schema verify helper

원칙:

- ORM이나 무거운 migration framework는 도입하지 않는다.
- 정본 schema는 plain SQL로 관리한다.
- apply / verify 도구는 SQL 실행 보조에만 사용한다.
