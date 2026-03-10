# RN Selector and Contract Audit

## 목적
- RN selector, backend adapter, display-model naming이 모바일 glossary와 TS examples에서 벗어나지 않도록 고정한다.
- sample-data contract와 content-governance/data-binding rules가 테스트 가능한 체크리스트가 되게 만든다.

## 1. Naming Alignment Decisions

### 1.1 유지하는 이름
- `TeamSummaryModel`
  - glossary에서 `Team`은 그룹/솔로/유닛/프로젝트를 모두 포함하는 추적 단위다.
  - RN 코드에서는 `entity`보다 `team`을 화면 모델 이름으로 우선 사용한다.
- `ReleaseSummaryModel`, `ReleaseDetailModel`, `UpcomingEventModel`
  - `typescript-interface-examples.md`와 일치한다.
- `datePrecision`, `status`, `confidence`, `sourceType`
  - raw JSON 필드가 `date_precision`, `date_status`, `confidence`, `source_type`여도 selector/adaptor 단계에서 camelCase display model로 정규화한다.

### 1.2 의도적으로 남겨둔 bridge 이름
- raw payload 쪽의 `group`, `display_name`, `scheduled_date`, `source_type`
  - dataset/backend contract와의 1:1 매핑을 위해 raw layer에만 유지한다.
- backend route/result segment의 `entities`
  - shared read API contract를 따르기 위한 이름이며, RN display layer에서는 `team` 모델로 변환한다.

### 1.3 drift 방지 규칙
- UI 컴포넌트 prop은 raw snake_case를 직접 받지 않는다.
- selector/adaptor가 `display model` 경계다.
- 새 surface model을 추가할 때는 `domain-glossary.md`, `typescript-interface-examples.md`, `view-state-models.md` 3개 문서를 같이 대조한다.

## 2. Sample/Data-Binding Parity Checklist

| Surface | Contract anchor | Current parity check |
| --- | --- | --- |
| Calendar | `sample-data-contracts.md`, `data-binding-spec.md` 5.1 | `CalendarMonthSnapshotModel`이 `exactUpcoming`, `monthOnlyUpcoming`, `nearestUpcoming`를 분리하고 `nearestUpcoming`은 exact만 허용 |
| Search | `sample-data-contracts.md`, `data-binding-spec.md` 5.3 | `SearchResultsModel`이 `entities`, `releases`, `upcoming` 세그먼트를 유지하고 alias/partial 이유를 display model로 노출 |
| Team Detail | `data-binding-spec.md` 5.4 | `EntityDetailSnapshotModel`이 공식 링크/다음 예정/최근 앨범/source timeline을 raw JSON 없이 파생 |
| Release Detail | `sample-data-contracts.md`, `data-binding-spec.md` 5.5 | `ReleaseDetailModel`이 title-track, service links, MV state를 explicit field로 유지 |
| Fallback/Disclosure | `content-governance-spec.md`, `edge-case-catalog.md`, `state-feedback-spec.md` | missing image/link/detail/MV를 가짜 값으로 채우지 않고 disclosure/helper 경로로 드러냄 |

## 3. Content-Governance Decisions Confirmed
- official link가 없으면 버튼을 숨긴다.
- representative image가 없으면 placeholder/monogram fallback으로 내려가되, fake image URL을 만들지 않는다.
- release detail service link가 비면 검색 fallback 또는 quality disclosure로만 노출한다.
- `needs_review`, `unresolved`, `no_mv` 같은 MV 상태는 숨기지 않고 명시 상태로 유지한다.
- partial data는 전체 화면을 막지 않고 disclosure + usable subset을 우선 렌더링한다.

## 4. Test Evidence
- selector parity: [mobile/src/selectors/specParity.test.ts](/Users/gimtaehun/Desktop/idol-song-app/mobile/src/selectors/specParity.test.ts)
- backend adapter parity: [mobile/src/services/backendDisplayAdapters.test.ts](/Users/gimtaehun/Desktop/idol-song-app/mobile/src/services/backendDisplayAdapters.test.ts)
- screen source fallback: [mobile/src/features/useActiveDatasetScreen.test.tsx](/Users/gimtaehun/Desktop/idol-song-app/mobile/src/features/useActiveDatasetScreen.test.tsx)
- runtime/source selection: [mobile/src/services/datasetSource.test.ts](/Users/gimtaehun/Desktop/idol-song-app/mobile/src/services/datasetSource.test.ts), [mobile/src/services/datasetFailurePolicy.test.ts](/Users/gimtaehun/Desktop/idol-song-app/mobile/src/services/datasetFailurePolicy.test.ts)

## 5. Follow-up Triggers
- `SearchScreenState.selectedSegment`처럼 doc example과 runtime route/query naming이 다르면 next polish issue에서 일괄 정리한다.
- backend payload contract가 바뀌면 이 문서와 parity tests를 같이 업데이트한다.
- 새로운 screen model이 추가되면 traceability matrix에도 primary issue를 연결한다.
