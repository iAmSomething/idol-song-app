# Visual Design Spec

## 1. 목적
이 문서는 모바일 앱의 공통 시각 규칙을 정의한다.
구현자는 화면별 임의 스타일링 대신 이 문서의 spacing, radius, hierarchy 규칙을 우선 적용한다.

## 2. 디자인 톤
- 기본 방향: 도구형 70, 에디토리얼형 30
- 목적: 빠른 스캔과 명확한 이동
- 금지: 과한 장식, 큰 히어로, 버튼과 칩의 시각적 혼동

launch-grade visual identity의 표면 계층과 child issue 분리는 `launch-grade-visual-identity-system.md`를 우선 참조한다.

## 3. Spacing Scale
- `4`: 아이콘과 텍스트의 최소 내부 간격
- `8`: chip 내부, 아주 짧은 그룹 간격
- `12`: 카드 내부 소블록 간격
- `16`: 기본 카드 padding, 섹션 내부 기본 간격
- `20`: 카드와 카드 사이, 요약 블록 간격
- `24`: 화면 상하 주요 섹션 간격
- `32`: 화면 최상단과 첫 주요 섹션 간격

## 4. Radius Scale
- `10`: chip, 작은 badge
- `14`: service button, segmented control
- `18`: 기본 카드, summary tile
- `24`: hero-style image wrapper, modal top corners

## 5. Elevation
- 기본 카드: low elevation 또는 hairline border
- primary 카드: 기본 카드보다 한 단계 높은 elevation
- bottom sheet: 배경 dim + 명확한 separation shadow
- 금지: 카드마다 높은 shadow를 중첩 적용

규칙:
- 하나의 화면에서 강한 elevation 표면은 최대 1개
- summary/notice/context는 카드보다 `tonal panel` 또는 `strip`로 먼저 해결한다.
- 카드 3장 이상이 같은 depth로 반복되면 non-card surface 재구성을 먼저 검토한다.

## 6. Typography Roles
- Screen Title: 화면 최상단 제목
- Section Title: 섹션 제목
- Card Title: 팀명, 릴리즈명
- Body: 설명, notes, source summary
- Meta: 날짜, 출처, 보조 라벨
- Chip Label: 상태/형식

규칙:
- 한 카드 내에서 Title 계층은 최대 2개까지만 사용
- Meta 텍스트는 Body보다 항상 약해야 함
- 서비스 버튼 라벨은 Body보다 강하지만 Primary 버튼보다는 약해야 함

## 7. Button and Chip Rules

### 7.1 Primary Button
- 높이: 최소 44pt
- 내부 padding: 좌우 14 이상
- 카드 안에서 최대 1개
- 배치: 콘텐츠 정보 바로 아래, 서비스 버튼 그룹보다 앞

### 7.2 Secondary Button
- 높이: 40~44pt
- Primary보다 대비가 낮아야 함
- 동일 카드에서 1개 이하 권장

### 7.3 Service Button
- 높이: 36~40pt
- 아이콘 좌측, 라벨 우측
- 전체 fill보다 soft tint 배경 우선
- 모든 서비스 버튼은 동일 구조 유지

### 7.4 Meta Link
- 텍스트형 또는 아주 약한 outline형
- 카드 하단 마지막 줄에 배치
- Primary/Service와 시각적으로 경쟁하면 안 됨

### 7.5 Informational Chip
- 고정 높이 24~28pt
- pressable처럼 보이는 drop shadow 금지
- 상태/형식 표현만 담당

## 8. Service Branding
- Spotify: 아이콘 mark + neutral container + subtle brand tint
- YouTube Music: 아이콘 mark + neutral container + subtle brand tint
- YouTube MV: play/video semantic이 드러나야 함
- 금지: 브랜드 원색 배경을 카드마다 과하게 사용

## 9. List and Card Density
- 캘린더 하위 리스트: compact
- 레이더 카드: medium density
- 팀 상세: mixed density
- 릴리즈 상세 트랙 리스트: dense but tappable

## 10. Icon Sizing
- 탭 아이콘: 22~24
- 카드 메타 아이콘: 14~16
- 서비스 아이콘: 16~18
- 큰 빈 상태 아이콘: 28~32

## 11. Image Rules
- 팀 대표 이미지: square 또는 soft portrait crop, 강한 장식 프레임 금지
- 앨범 커버: square 고정
- 이미지 없음: placeholder는 정보 밀도를 해치지 않게 neutral 처리
- fallback asset source of truth는 `mobile/assets/**/*-source.svg`, runtime binding은 export PNG만 사용
- splash foreground와 fallback visuals는 `docs/specs/mobile/launch-visual-asset-handoff.md` 기준으로 이름을 고정한다.

## 12. Sticky and Scroll Rules
- 상단 앱 바는 sticky 허용
- 세그먼트와 필터 바는 화면 성격에 따라 sticky 허용
- 카드 자체 내부에 독립 스크롤 영역은 최소화
- 긴 목록은 화면 스크롤 하나로 처리하고, sheet 내부 목록만 예외적으로 독립 스크롤 허용

## 13. 참조 토큰 문서
- semantic naming과 구현용 token 이름은 `design-token-spec.md`를 따른다.

## 9. 성능/상태 복원 참조
- 체감 성능 예산은 `performance-budget-spec.md`를 따른다.
- 탭/시트/복귀 상태 보존은 `state-restoration-spec.md`를 따른다.
