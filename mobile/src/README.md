# Mobile Source Modules

이 디렉터리는 화면 구현과 분리된 재사용 모듈 구역이다.

- `components/`: 표시 컴포넌트
- `config/`: validated runtime config accessor
  - `featureGates.ts`: gate registry / fallback metadata / helper
  - `runtime.ts`: mobile profile / env validation
- `features/`: 화면 composition / binding
- `selectors/`: display model selector / adapter
- `services/`: data source / external handoff / helper
  - `datasetSource.ts`: bundled-static vs preview-remote source selector
- `tokens/`: design token / theme
- `types/`: shared TypeScript model
- `utils/`: framework-agnostic helper
  - `assetRegistry.ts`: bundled placeholder/service/badge asset entrypoint

현재는 bootstrap 단계지만 config/service foundation은 실제 모듈로 열어둔다.
