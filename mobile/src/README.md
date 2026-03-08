# Mobile Source Modules

이 디렉터리는 화면 구현과 분리된 재사용 모듈 구역이다.

- `components/`: 표시 컴포넌트
- `config/`: validated runtime config accessor
  - `featureGates.ts`: gate registry / fallback metadata / helper
  - `runtime.ts`: mobile profile / env validation
- `features/`: 화면 composition / binding
- `selectors/`: display model selector / adapter
  - `context.ts`: dataset -> indexed selector context
  - `adapters.ts`: raw JSON -> display model 변환 규칙
  - `index.ts`: shared selectors entrypoint
- `services/`: data source / external handoff / helper
  - `datasetSource.ts`: bundled-static vs preview-remote source selector
  - `storage.ts`: `AsyncStorage` adapter + namespaced key/value helper
  - `datasetCache.ts`: static dataset artifact cache entry helper
  - `recentQueries.ts`: recent-query persistence helper
- `tokens/`: design token / theme
  - `theme.tsx`: theme provider + `useAppTheme()` access convention
  - `colors.ts`, `spacing.ts`, `radii.ts`, `typography.ts`, `sizes.ts`, `elevation.ts`, `motion.ts`
- `types/`: shared TypeScript model
  - `displayModels.ts`: screen-facing display model types
  - `rawData.ts`: current static dataset contract types
- `utils/`: framework-agnostic helper
  - `assetRegistry.ts`: bundled placeholder/service/badge asset entrypoint

현재는 bootstrap 단계지만 config/service foundation은 실제 모듈로 열어둔다.

storage 관련 규칙:

- `AsyncStorage`를 직접 화면에서 호출하지 않는다.
- dataset cache와 recent query는 모두 `services/storage.ts` namespace 규칙을 공유한다.
- later feature는 raw storage key를 직접 만들지 않고 service helper를 통해 접근한다.
