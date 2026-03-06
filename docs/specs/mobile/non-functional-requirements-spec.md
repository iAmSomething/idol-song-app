# Non-Functional Requirements Spec

## 1. 목적
이 문서는 모바일 앱의 비기능 요구사항을 정의한다.
화면 구현 자체가 되더라도, 성능/접근성/신뢰성/유지보수성이 기준에 못 미치면 완료로 보지 않는다.

## 2. 성능
- 첫 진입 시 핵심 구조가 빠르게 보여야 한다.
- 캘린더 월 전환은 사용자가 즉각적인 반응을 느낄 수 있어야 한다.
- Search 입력 중 과도한 recompute로 타이핑 지연이 생기면 안 된다.
- 큰 리스트는 virtualization 고려가 가능해야 한다.

## 3. 상태 보존
- 탭 전환 후 이전 탭 상태가 유지되어야 한다.
- back 시 월, 선택 날짜, 검색어, Team Detail scroll position이 유지되어야 한다.
- external open 후 앱 복귀 시 컨텍스트가 유지되어야 한다.

## 4. 신뢰성
- partial data가 있어도 화면이 깨지면 안 된다.
- canonical 링크가 없을 때 검색 fallback이 일관되게 동작해야 한다.
- 중복 예정 기사나 모호한 날짜 데이터가 있어도 UI는 안정적으로 렌더링되어야 한다.

## 5. 접근성
- 아이콘 버튼은 모두 접근성 라벨을 가져야 한다.
- 최소 터치 영역을 만족해야 한다.
- Dynamic Type 확대 시 핵심 CTA가 잘리면 안 된다.
- 색상만으로 상태를 구분하면 안 된다.

## 6. 국제화
- 기본 언어는 한국어, 보조 언어는 영어다.
- 서비스명과 고유 릴리즈명은 필요 시 원문 유지 가능해야 한다.
- 날짜/상태/버튼 문구는 언어별 정책을 따라야 한다.

## 7. 유지보수성
- raw JSON parsing은 UI 컴포넌트가 직접 하지 않는다.
- 공통 selector/adapter를 재사용해야 한다.
- 공통 컴포넌트와 화면 조합 책임을 분리해야 한다.

## 8. 테스트성
- selector/adapter는 unit test 가능 구조여야 한다.
- 핵심 shared component는 독립 테스트가 가능해야 한다.
- screen smoke와 manual QA 흐름이 문서와 1:1로 대응되어야 한다.

## 9. 데이터 품질
- alias, badge, cover, release detail이 일부 누락돼도 fallback이 동작해야 한다.
- source type과 confidence는 가능한 한 표시 모델로 정규화되어야 한다.
- latest_song / latest_album 분리는 유지되어야 한다.

## 10. 완료 기준
- 기능 구현뿐 아니라 위 요구사항을 위반하지 않아야 한다.
- 위반 항목이 남아 있으면 polish/QA 단계에서 차단 이슈로 본다.
