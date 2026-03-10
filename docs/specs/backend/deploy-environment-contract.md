# Deploy Environment Contract

## Purpose

preview / production backend deploy 전에 두 target의 config contract를 명시적으로 검사한다.
핵심 목표는 아래를 분리하는 것이다.

- 의도된 target 차이
- 누락된 critical config
- repo example / workflow / runtime env 사이의 우발적 drift

## Contract Sources

정본 입력은 세 군데다.

1. `backend/.env.preview.example`
2. `backend/.env.production.example`
3. deploy workflow env
   - `RAILWAY_TOKEN`
   - `RAILWAY_PROJECT_ID`
   - `RAILWAY_ENVIRONMENT_ID`
   - `RAILWAY_SERVICE_ID`
   - `BACKEND_PUBLIC_URL`
   - `DATABASE_URL`

runtime env 실제값은 Railway service variable list를 읽어 확인한다.

## Required Runtime Keys

- `APP_ENV`
- `DATABASE_URL_POOLED`
- `DATABASE_URL`
- `PORT`
- `APP_TIMEZONE`
- `DB_CONNECTION_TIMEOUT_MS`
- `DB_READ_TIMEOUT_MS`
- `WEB_ALLOWED_ORIGINS`
- `LOG_LEVEL`
- `WORKER_CADENCE_LABEL`

## Shared Invariants

preview와 production이 같아야 하는 것:

- `APP_TIMEZONE = Asia/Seoul`
- `DB_CONNECTION_TIMEOUT_MS = 3000`
- `DB_READ_TIMEOUT_MS = 5000`
- `LOG_LEVEL = info`

## Intentional Target Differences

preview:
- `APP_ENV = preview`
- `PORT = 3213`
- `WORKER_CADENCE_LABEL = preview-manual`
- `WEB_ALLOWED_ORIGINS` non-empty preview origin list

production:
- `APP_ENV = production`
- `PORT = 3000`
- `WORKER_CADENCE_LABEL = production-scheduled`
- `WEB_ALLOWED_ORIGINS` may be empty if default production origin fallback is used

connection strings:
- `DATABASE_URL`
- `DATABASE_URL_POOLED`

위 두 값은 secret이므로 raw value 비교는 하지 않는다.
대신 presence와 PostgreSQL URL shape만 검사한다.

## Verification Entry Point

- script: [verify-deploy-env-contract.ts](/Users/gimtaehun/Desktop/idol-song-app/backend/scripts/verify-deploy-env-contract.ts)
- npm script: `cd backend && npm run deploy:env:verify -- --target preview`

이 스크립트는 기본적으로 Railway CLI를 통해 target runtime env를 읽고,
report artifact를 `backend/reports/deploy_env_contract_<target>.json`에 남긴다.

테스트나 dry-run에서는 `--runtime-env-kv-path <file>`로 fixture KV input을 주입할 수 있다.

## Failure Policy

deploy workflow는 아래 경우 즉시 실패한다.

- required deploy input missing
- preview / production example key-set mismatch
- shared invariant drift
- target-specific expected value drift
- Railway runtime env missing required key
- runtime secret malformed

로그에는 secret raw value를 남기지 않는다.
secret류는 `present` 여부와 URL shape만 남긴다.
