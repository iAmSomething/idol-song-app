# Layout Constraint Spec

## 1. 목적
이 문서는 각 화면과 공통 블록의 레이아웃 한계값을 정의한다.
구현자는 이 문서를 기준으로 줄 수, 비율, 최소 높이, 고정 영역을 맞춘다.

## 2. 공통 규칙
- safe area 상단/하단 침범 금지
- 화면 최상단부터 첫 주요 콘텐츠까지 16~24 간격 유지
- 카드 내부 최소 padding 16
- 섹션 제목과 첫 카드 사이 간격 12~16

## 3. Calendar Screen

### 3.1 App Bar
- 최소 높이: 52
- trailing action 개수: 최대 2

### 3.2 Summary Strip
- 한 줄 유지 우선
- 카드 수: 최대 3
- 각 카드 label은 1줄, value는 1줄

### 3.3 Day Cell
- 셀 높이는 동일 행 내 동일해야 함
- 날짜 숫자는 상단에 고정
- 배지 영역은 최대 2줄 사용
- `+N`은 마지막 배지 슬롯 사용

### 3.4 Date Detail Sheet
- 기본 높이 약 78%
- empty 상태 약 45%
- 헤더 + summary는 sticky 허용
- 내부 리스트는 독립 스크롤 허용

## 4. Radar Screen
- Featured card는 첫 화면에 완전 노출
- 카드 간 간격 12~16
- 한 섹션당 카드 수가 많아도 내부 스크롤 금지

## 5. Search Screen
- Search Input과 Segment는 상단 고정 허용
- 결과 행 높이 최소 56
- release row에 secondary service action이 들어와도 2줄 이내 유지

## 6. Team Detail
- Hero 대표 이미지는 정사각 또는 4:5 이내 비율
- 공식 링크 그룹은 2줄 이내 wrap 허용
- 최신 발매 카드는 cover + meta + CTA가 한 카드 안에서 완결되어야 함
- 최근 앨범 캐러셀 카드 폭은 화면의 절반 이상 권장

## 7. Release Detail
- cover는 정사각 유지
- 앨범 레벨 서비스 그룹은 1줄 우선, 2줄 wrap 허용
- Track Row 최소 높이 52
- Track Row 제목은 2줄 초과 금지
- MV 영역은 video ratio 유지, 없으면 완전 제거

## 8. Empty / Error Blocks
- 화면 중앙 정렬 강제 금지
- 현재 컨텍스트 아래 자연스럽게 배치
- CTA는 최대 1개

## 9. Sticky 허용 범위
- App Bar: 허용
- Segment/Filter Bar: 화면에 따라 허용
- 카드 내부 action row: sticky 금지
- Team Detail Hero: sticky 금지
