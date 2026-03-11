# RN Public Preview Backend Docs Local 2026-03-11

## Scope
- target issues: `#526`, `#527`
- purpose: lock the external-device QA entrypoint for the stable public preview backend and document a temporary tunnel fallback

## Commands

### Stable public preview env sanity
```bash
cd mobile
set -a
source .env.preview.example
set +a
npm run config:preview
```

### Temporary tunnel env sanity
```bash
cd mobile
set -a
source .env.preview.tunnel.example
set +a
npm run config:preview
```

### Type and lint checks
```bash
cd mobile
npm run typecheck
npm run lint
```

## Expected metadata contract
- stable preview env
  - `Backend target = Public preview backend`
  - `API host = api.idol-song-app.example.com`
- tunnel fallback env
  - `Backend target = Temporary tunnel backend`
  - `API host` resolves to the tunnel host

## Notes
- tunnel fallback is documented as emergency QA-only and not as the default sign-off path.
- stable external-device baseline remains the public preview backend URL.
