# Web Cutover Rollback Drills

이 문서는 staged web cutover 시기에 수행했던 historical rollback drill 기록이다.
현재 shipped web runtime은 JSON fallback/source switch를 운영 계약으로 더 이상 제공하지 않으므로, 이 문서는 active runbook이 아니라 과거 증적으로만 유지한다.

## 1. 적용 Surface

- search
- entity detail
- calendar/month
- radar

당시 전제:

- backend-primary build는 `VITE_PRIMARY_SURFACE_SOURCE=api`
- surface-local rollback은 `VITE_*_SOURCE=json`
- runtime override는 query param `?*Source=json`

## 2. Source-Switch Precedence

당시 web runtime은 아래 우선순위로 source를 결정했다.

1. query override
2. per-surface env override
3. global primary env
4. bundled JSON fallback

현재는 이 우선순위를 운영에 사용하지 않는다.

## 3. Surface Rollback Plan

| surface | representative trigger | fastest rollback | deploy-time rollback | expected user-facing effect | manual cleanup |
| --- | --- | --- | --- | --- | --- |
이 표의 global JSON fallback은 historical mechanism이며, 현재는 이전 정상 deployment로 rollback하는 절차로 대체됐다.

## 4. Drill Checklist

### 4.1 Pre-Drill

- [ ] target surface와 trigger condition을 명시했다.
- [ ] global API baseline build가 성공한다.
- [ ] surface-local rollback env 또는 query key를 확인했다.
- [ ] drill 후 원복 조건을 기록했다.

### 4.2 During Drill

- [ ] global API baseline과 surface-local rollback build/route를 각각 실행했다.
- [ ] rollback에 걸린 시간을 기록했다.
- [ ] user-facing effect를 surface-local 범위로 설명할 수 있다.
- [ ] 다른 cut-over surface가 그대로 남는지 확인했다.

### 4.3 After Drill

- [ ] rollback action을 제거하고 원복 조건을 문서화했다.
- [ ] parity / shadow / runtime gate에 다시 연결할 다음 조치를 남겼다.

## 5. Representative Local Drill

당시 cycle에서는 `search` surface를 대표 drill로 실행했다.

### Trigger Condition

- backend-primary build를 기본으로 둔 상태에서 `/v1/search` incident가 발생했다고 가정
- 목표는 다른 cut-over surface는 그대로 두고 search만 JSON으로 되돌리는 것

### Drill Commands

Global API baseline:

```bash
cd web
/usr/bin/time -p env VITE_PRIMARY_SURFACE_SOURCE=api npm run build
```

Surface-local rollback:

```bash
cd web
/usr/bin/time -p env VITE_PRIMARY_SURFACE_SOURCE=api VITE_SEARCH_SOURCE=json npm run build
```

### Measured Time

- baseline build: `real 3.38s`
- search rollback build: `real 3.44s`

### Observed User-Facing Effect

- search만 `json` source로 강제되므로 `upcoming scan`, `recent feed`, `team directory` 검색 결과 블록은 JSON selector 기반 결과를 사용한다.
- 다른 surface는 여전히 global `api` baseline을 따를 수 있다.
- 즉 rollback은 all-or-nothing이 아니라 surface-local이다.

### Manual Cleanup

1. `VITE_SEARCH_SOURCE=json` 제거
2. `/v1/search` parity / shadow 원인 수리
3. 필요 시 runtime gate 재측정
4. search surface를 다시 `api`로 복귀

## 6. Runtime Query Rollback

env rollback은 deploy/build 단위 drill에 적합하고, query rollback은 즉시 재현/우회에 적합하다.

query rollback은 operator가 특정 incident를 빠르게 재현하거나 임시 우회할 때 쓴다.
지속 운영에는 env rollback을 우선한다.

## 7. Drill Exit Criteria

이 문서는 JSON demotion 전 증적으로는 유효하지만, 현재 운영 절차를 직접 설명하지는 않는다.
