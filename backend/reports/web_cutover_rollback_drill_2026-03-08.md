# Web Cutover Rollback Drill 2026-03-08

## Scope

- environment: local
- target surface: `search`
- global mode: `VITE_PRIMARY_SURFACE_SOURCE=api`
- rollback mode: `VITE_SEARCH_SOURCE=json`

## Trigger Condition

`/v1/search` incident를 가정했다.

- alias/parity drift
- degraded backend latency
- temporary backend outage

목표는 backend-primary baseline을 유지한 채 search만 JSON fallback으로 되돌리는 것이다.

## Commands

Baseline:

```bash
cd web
/usr/bin/time -p env VITE_PRIMARY_SURFACE_SOURCE=api npm run build
```

Rollback drill:

```bash
cd web
/usr/bin/time -p env VITE_PRIMARY_SURFACE_SOURCE=api VITE_SEARCH_SOURCE=json npm run build
```

## Timing

| step | result |
| --- | --- |
| backend-primary baseline build | `real 3.38s` |
| search-only rollback build | `real 3.44s` |

## Observed Effect

- search surface만 JSON selector path로 강제된다.
- entity detail, release detail, calendar/month, radar는 여전히 global API baseline을 따를 수 있다.
- rollback 범위가 surface-local임을 확인했다.

## Manual Cleanup

1. `VITE_SEARCH_SOURCE=json` 제거
2. `/v1/search` parity / shadow 원인 수리
3. 필요 시 `backend_json_parity_report.json`, `backend_shadow_read_report.json`, `runtime_gate_report.json` 재확인
4. search surface를 `api`로 복귀

## Notes

- 이번 drill은 deploy-time env rollback 기준으로 측정했다.
- runtime incident triage에서는 query override `?searchSource=json` 경로를 더 빠른 임시 우회 수단으로 사용할 수 있다.
