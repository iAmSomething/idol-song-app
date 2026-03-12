# Web Pages API Runtime Local Verification (2026-03-13)

## Goal

- GitHub Pages production build가 더 이상 `bridge`를 active runtime target으로 쓰지 않도록 검증
- `VITE_API_BASE_URL`이 비어 있어도 `backend_freshness_handoff.json`의 production backend URL로 Pages runtime target을 해석하는지 확인

## Commands

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/web
node --test ./scripts/lib/pagesApiRuntimeConfig.test.mjs
node ./scripts/resolve-pages-api-runtime.mjs
npm run test:runtime-policy
VITE_API_BASE_URL=https://api.idol-song-app.example.com VITE_BACKEND_TARGET_ENV=production npm run build:pages-read-bridge
VITE_API_BASE_URL=https://api.idol-song-app.example.com VITE_BACKEND_TARGET_ENV=production npm run verify:pages-backend-target
VITE_API_BASE_URL=https://api.idol-song-app.example.com VITE_BACKEND_TARGET_ENV=production npm run verify:pages-backend-handoff
VITE_API_BASE_URL=https://api.idol-song-app.example.com VITE_BACKEND_TARGET_ENV=production npm run build
npm run lint

cd /Users/gimtaehun/Desktop/idol-song-app
git diff --check
```

## Observed

- `resolve-pages-api-runtime.mjs` fallback source: `backend_freshness_handoff`
- resolved `apiBaseUrl`: `https://api.idol-song-app.example.com`
- `build-pages-read-bridge` output:
  - `runtimeMode = api`
  - `targetEnvironment = production`
  - `effectiveTarget = https://api.idol-song-app.example.com`
- `verify-pages-backend-target` passed with `runtimeMode = api`
- `verify-pages-backend-handoff` passed against production handoff artifact
- `npm run build`, `npm run lint`, `git diff --check` all passed
