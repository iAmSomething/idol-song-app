# Backend Secret Rotation Tabletop 2026-03-08

## Scenario

- 대상: backend credential / deploy chain
- tabletop focus: `DATABASE_URL` + `DATABASE_URL_POOLED` rotation
- 범위: GitHub Actions, Railway runtime, Neon source-of-truth

## Walkthrough

1. current dependency points를 repository 기준으로 다시 확인했다.
   - `.github/workflows/backend-deploy.yml`
   - `.github/workflows/weekly-kpop-scan.yml`
   - `backend/.env.example`
   - `backend/.env.preview.example`
   - `backend/.env.production.example`
2. GitHub CLI로 environment / variable visibility를 확인했다.
   - visible environments: `github-pages`, `preview`
   - `production` environment: 현재 API에서 확인되지 않음
   - repo variable list: empty
   - preview environment variable list: empty
   - visible secret names: empty
3. replacement direct / pooled URL 발급 후 반영 순서를 문서 기준으로 검토했다.
   - preview Railway runtime
   - preview GitHub `DATABASE_URL`
   - preview backend deploy + smoke
   - production Railway runtime
   - production GitHub `DATABASE_URL`
   - production deploy + smoke
4. rollback path도 같이 검토했다.
   - GitHub secret 원복
   - Railway runtime env 원복
   - deploy 재실행
   - `/ready` + representative read smoke 재확인

## Result

- 문서화된 순서만으로 rotation / rollback 절차를 설명할 수 있었다.
- secret 값 없이도 owner, scope, change order, rollback order를 명시할 수 있었다.
- 다만 GitHub provisioning 상태는 repo contract와 실제 visible environment 상태 사이에 차이가 있었다.

## Findings

1. `production` GitHub environment가 현재 API에서 보이지 않는다.
2. backend deploy / Pages build가 요구하는 variable 이름은 workflow에 존재하지만, current visible variable lists는 비어 있었다.
3. 따라서 current repo는 "rotation 절차 문서화"는 됐지만, "platform provisioning drift 없음"까지 보장되지는 않는다.

## Recommended Operator Follow-up

1. GitHub `preview`, `production`, `github-pages` scope에서 required secret / variable 이름이 실제로 채워져 있는지 UI 또는 admin-auth CLI로 확인한다.
2. Railway preview / production service env가 `.env.preview.example`, `.env.production.example`과 같은 이름 계약을 유지하는지 확인한다.
3. production cutover 전에 `DATABASE_URL`, `RAILWAY_TOKEN`, `BACKEND_PUBLIC_URL`, `VITE_API_BASE_URL` 4개는 존재 여부를 checklist로 다시 확인한다.
