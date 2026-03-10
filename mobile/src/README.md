# Mobile Source Modules

이 디렉터리는 화면 구현과 분리된 재사용 모듈 구역이다.

- `components/`: 표시 컴포넌트
  - `feedback/`: screen-level loading/empty/error/retry + inline notice 공용 컴포넌트
  - `actions/`: service button / grouped action row 공용 컴포넌트
  - `calendar/`: day cell / date detail sheet 공용 컴포넌트
  - `release/`: track row 공용 컴포넌트
- `config/`: validated runtime config accessor
  - `featureGates.ts`: gate registry / fallback metadata / helper
  - `runtime.ts`: mobile profile / env validation + safe degraded runtime state
  - `debugMetadata.ts`: debug-only build/dataset/commit/runtime-state metadata helper
- `features/`: 화면 composition / binding
  - `useActiveDatasetScreen.ts`: dataset loading / degraded analytics / error state 공통 hook
  - `surfaceDisclosures.ts`: dataset risk / source confidence / external dependency notice helper
  - `selectors/`: display model selector / adapter
  - `context.ts`: dataset -> indexed selector context
  - `adapters.ts`: raw JSON -> display model 변환 규칙
  - `index.ts`: shared selectors entrypoint
    - team / entity detail / release detail selector 외에 calendar month snapshot / radar snapshot / search result selector 포함
- `services/`: data source / external handoff / helper
  - `datasetSource.ts`: backend-primary runtime selection + bundled fallback descriptor
  - `activeDataset.ts`: selector fallback용 bundled dataset payload loader
  - `datasetFailurePolicy.ts`: backend-primary runtime / degraded fallback policy
  - `storage.ts`: `AsyncStorage` adapter + namespaced key/value helper
  - `datasetCache.ts`: static dataset artifact cache entry helper
  - `recentQueries.ts`: recent-query persistence helper
  - `handoff.ts`: canonical-open / search-fallback / browser-fallback resolver + opener
  - `externalLinks.ts`: official/source external-link allowlist + safe opener
  - `analytics.ts`: env-gated event emitter + debug recent-event buffer + failure taxonomy helper
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

handoff 관련 규칙:

- later UI는 raw `Linking.openURL`을 직접 호출하지 않는다.
- canonical URL validation, search fallback URL builder, browser fallback choice는 `services/handoff.ts`에서 중앙화한다.
- official/source/meta link open은 `services/externalLinks.ts`에서 중앙화한다.
- 실패는 explicit result object로 돌려서 UI가 toast/inline feedback을 붙일 수 있게 한다.

analytics 관련 규칙:

- analytics는 `featureGates.analytics`가 꺼져 있으면 아무 이벤트도 내보내지 않는다.
- screen viewed / radar filter / source link / service handoff / degraded-or-error dataset state만 low-noise 기준으로 추적한다.
- failure는 `blocking / degraded / external_failure / data_quality` taxonomy로만 기록한다.
- 검색어와 에러 문구는 길이를 제한해 저장한다.
- 최근 이벤트 확인은 `config/debugMetadata.ts`와 hidden `debug/metadata` route를 통해서만 한다.

feedback state 관련 규칙:

- screen-level loading / empty / error / retry는 `components/feedback/FeedbackState.tsx`를 우선 사용한다.
- section 안의 empty / warning / retry copy도 가능하면 `InlineFeedbackNotice`로 통일한다.
- 화면이 직접 `ActivityIndicator + 문구 + retry button` 조합을 반복해서 만들지 않는다.

failure-policy 관련 규칙:

- runtime config parse failure는 crash 대신 degraded state로 내려간다.
- preview / production은 `backend-api`를 primary runtime source로 간주한다.
- bundled static dataset은 development 기본값이거나, backend failure/degraded state에서만 explicit fallback으로 사용한다.
- later UI는 `mode = normal | degraded`와 issue list를 직접 소비할 수 있어야 한다.
