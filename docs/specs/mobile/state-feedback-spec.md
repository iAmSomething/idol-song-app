# State and Failure Feedback Spec

## 1. 목적
이 문서는 loading, empty, partial, error, external-open failure 상황에서 어떤 UI 피드백을 보여줄지 정의한다.

## 2. Loading
- skeleton 우선
- loading 동안 destructive shift 금지
- 버튼은 disabled 또는 skeleton 대체
- loading이 길어질 경우 빈 화면처럼 보이지 않게 최소 구조 유지
- screen-level loading은 surface 문맥을 반영한 skeleton layout을 사용한다.
  - calendar: month header + summary + day/list rhythm
  - search: search bar + segment rail + result row rhythm
  - radar: featured block + feed row rhythm
  - detail: artwork/header + meta row rhythm
- skeleton은 soft pulse까지만 허용하고 shimmer sweep는 기본값으로 쓰지 않는다.
- skeleton은 아주 짧은 fetch에서는 즉시 번쩍이지 않도록 짧은 reveal delay를 둔다.

## 3. Empty
- empty는 오류가 아니다.
- 문구는 직접적으로 현재 상태를 설명해야 한다.
- 필요 시 CTA 1개까지 허용

## 4. Partial Data
- 일부 링크/이미지/메타만 있어도 화면은 렌더링한다.
- 누락 필드는 숨기되 레이아웃이 깨지면 안 된다.
- `일부 정보만 표시됩니다.` 같은 보조 문구는 필요한 화면에서만 제한적으로 사용

## 5. Error
- fetch error와 external-open error를 구분한다.

### 5.1 Fetch Error
- 기본 문구: `정보를 불러오지 못했습니다.`
- CTA: `다시 시도`
- 심각하지 않으면 이전 데이터 유지 가능
- retry CTA는 primary prominence를 갖되 destructive 톤으로 과장하지 않는다.
- degraded cache가 있으면 즉시 구조를 유지하고, cache도 없으면 explicit error 상태로 전환한다.

### 5.2 External Open Error
- 기본 문구: `앱을 열 수 없습니다.` 또는 `링크를 열 수 없습니다.`
- fallback: 브라우저 열기 또는 검색 링크 재시도
- toast/snackbar 우선

## 6. Toast / Snackbar 사용 규칙
- 서비스 링크 실패
- 복사 완료
- 필터 적용 완료 같은 짧은 피드백에만 사용
- 핵심 오류 상태를 toast 하나로 끝내면 안 됨

## 7. 화면별 상태 우선순위
1. 구조 유지
2. 핵심 CTA 유지 가능 여부 판단
3. 누락 필드 숨김
4. 최후에 empty/error block 노출

## 8. 버튼 상태
- loading: spinner보다 skeleton/disabled 우선
- partial link absence: 해당 버튼 숨김
- error: retry CTA 우선, 무의미한 service button 노출 금지
- retry 버튼은 `busy / disabled / restored` 흐름을 설명 가능한 상태로 유지한다.

## 9. 서비스 링크 실패
- canonical URL 실패 시 검색 fallback 재시도 가능
- 검색 fallback도 실패하면 external-open error 표시
- 실패 사실을 강한 경고로 과장하지 않는다

## 10. 오프라인 고려
- v1 필수 구현은 아니지만, 네트워크 의존 외부 열기 실패 시 메시지 필요
- 정적 데이터가 로컬에 있으면 화면 자체는 최대한 유지
