# backend API-only end-state tracker local note (2026-03-12)

- purpose: close the remaining umbrella issue for the true API-only runtime / pipeline end state
- branch: `codex/632-api-only-end-state-umbrella`

## local checks

- confirmed open p1 blocker issues:
  - `#525`
  - `#624`
  - `#625`
  - `#626`
  - `#627`
- confirmed current backend spec docs already state:
  - web cut-over surfaces are API-only
  - mobile preview / production runtime is backend-primary
  - scheduled workflows are DB-first and `web/src/data` is demoted export/mirror only

## files updated

- `docs/specs/backend/api-only-end-state-tracker.md`
- `docs/specs/backend/json-snapshot-demotion.md`
- `docs/specs/backend/README.md`
- `README.md`

## outcome

- `#632` no longer needs to stay open as a catch-all umbrella.
- remaining work is explicitly tracked by the linked blocker issues above.
