# Non-runtime Duplicate Quarantine Policy

이 문서는 runtime-facing canonical path 밖에 남는 suffix copy (` 2`, ` 3`, ` 4`) scratch file를 어떻게 inventory하고 격리할지 정리한다.

닫는 문제:

- `#616`: Inventory non-runtime duplicate scratch artifacts and define quarantine policy

## 1. 목적

`#540`에서 runtime-facing duplicate는 별도 정책으로 정리했다. 그 뒤에도 아래 같은 scratch copy는 계속 생길 수 있다.

- mobile asset draft
- docs evidence duplicate
- workflow experiment copy
- backend / web / repo-root local scratch file

이 파일들은 import/build path를 직접 깨지는 않더라도 `git status` noise와 operator confusion을 만든다. 이 문서는 이 잔여 duplicate를 `삭제 대상`이 아니라 `quarantine 대상`으로 다룬다.

## 2. Scope

이 정책은 runtime-facing canonical path를 제외한 repo-wide suffix duplicate를 대상으로 본다.

제외:

- repo root runtime-facing generated data
- repo root runtime-facing pipeline script
- `web/src/data` runtime export

위 범위는 `docs/specs/backend/runtime-artifact-retention-policy.md`가 정본이다.

## 3. Detection Rule

inventory 규칙:

- filename pattern: `* 2.*`, `* 3.*`, `* 4.*`
- canonical sibling이 같은 디렉터리에 실제로 존재해야 한다.
- runtime-facing duplicate로 판정되면 이 inventory에서는 제외한다.
- dependency/build output directory는 제외한다.
- `.git`
- `.venv`
- `__pycache__`
- `node_modules`
  - `dist`
  - `.expo`
  - `.next`
  - `Pods`
  - `build`

실행:

```bash
cd backend
npm run duplicate:inventory
```

산출물:

- `backend/reports/non_runtime_duplicate_inventory_report.json`
- `backend/reports/non_runtime_duplicate_inventory_report.md`

## 4. Group Taxonomy

duplicate는 아래 group으로 분류한다.

1. `workflow_drafts`
   - `.github/workflows/`
2. `backend_workspace_scratch`
   - `backend/`
3. `docs_distribution_evidence`
   - `docs/assets/distribution/`
4. `docs_specs_variants`
   - `docs/specs/`
5. `mobile_asset_drafts`
   - `mobile/assets/`
6. `mobile_workspace_scratch`
   - `mobile/`의 나머지
7. `web_workspace_scratch`
   - `web/`의 나머지
8. `repo_root_misc`
   - root level scratch file

## 5. Quarantine Rule

원칙은 `tracked workspace 밖으로 이동`이다.

- workflow draft
  - `/tmp` 또는 gitignored local scratch path로 이동
- docs evidence duplicate
  - canonical dated evidence 1개만 남기고 suffix copy는 제거
- docs/spec variant
  - canonical로 승격하거나 repo 밖 scratch로 이동
- mobile/web/backend scratch
  - repo 안에 suffix copy를 누적하지 말고 local scratch path에서만 유지
- repo root misc
  - root에 남기지 말고 `/tmp` 또는 별도 scratch 폴더로 이동

즉, non-runtime duplicate는 source-of-truth가 아니라 `active local scratch`로 본다.

## 6. Operator Interpretation

- duplicate count `0`
  - operator-clean
- duplicate count `> 0`
  - repo가 깨진 것은 아니지만, local scratch quarantine이 안 된 상태
- 특정 group count가 급증
  - 같은 area에서 ad hoc working-copy 습관이 누적되고 있다는 신호

## 7. Relationship To Runtime Retention

- runtime-facing duplicate
  - `runtime-artifact-retention-policy.md`
- non-runtime duplicate
  - 이 문서

두 스캐너는 서로 겹치지 않아야 한다.

## 8. Recommended Local Scratch Locations

repo 밖에서 작업할 때는 아래를 권장한다.

- `/tmp/idol-song-app-scratch`
- `~/tmp/idol-song-app-scratch`
- 사용 중인 shell profile에 맞는 gitignored local workspace

repo 안에 suffix copy를 남긴 뒤 나중에 골라 지우는 방식은 권장하지 않는다.
