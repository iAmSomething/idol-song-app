# Launch-Grade Visual Identity System

## 1. 목적
이 문서는 모바일 앱의 launch-grade visual identity를 별도 정본으로 고정한다.
기존 `visual-design-spec.md`가 spacing/radius/typography 같은 기본 규칙을 다룬다면, 이 문서는 `어떤 표면을 어떤 맥락에서 어떻게 써야 하는지`를 정의한다.

## 2. 제품 톤
- 기본 방향: `practical tool + editorial accent`
- 우선순위:
  1. 빠른 스캔
  2. 높은 대비의 정보 위계
  3. 기억에 남는 표면 리듬
- 금지:
  - 카드만 반복되는 단조로운 정보판
  - 팬페이지처럼 과장된 장식
  - 순수 브랜딩 색으로 화면을 덮는 처리

## 3. Surface Families

### 3.1 Utility Canvas
- 기본 screen background
- 정보의 대부분은 이 위에 떠야 한다.
- pure white / pure black 한 장 처리보다 `base`, `elevated`, `subtle` 레벨 차를 유지한다.

### 3.2 Tonal Panel
- 화면 상단 컨텍스트, 위험 고지, dataset disclosure용
- 기본 카드보다 넓고 덜 분절되어 보여야 한다.
- 예: calendar header context, degraded source notice, preview/runtime disclosure

### 3.3 Strip
- 숫자/짧은 메타를 빠르게 스캔시키는 얕은 요약 표면
- 카드보다 낮은 장식 강도, hero보다 높은 정보 밀도
- 예: summary strip, compact info strip, runtime/source strip

### 3.4 Inset Section
- 화면 중간의 의미 단위 섹션
- 강한 shadow보다 `border + tonal separation`을 우선한다.
- 예: release supporting info, radar section blocks, search recent query group

### 3.5 Compact Hero
- 팀/릴리즈 상단 식별 블록
- 마케팅형 giant hero가 아니라 `image/badge + title + 1~2줄 meta + 주요 CTA`만 담는다.
- 예: entity detail hero, release detail hero

### 3.6 Sheet Surface
- bottom sheet / filter sheet / date detail sheet
- overlay depth는 확실해야 하지만 내부는 dense tool UI여야 한다.
- drag handle, title, summary, close affordance가 경쟁하지 않아야 한다.

## 4. Screen-Level Surface Rhythm

### 4.1 Calendar
- `context header -> summary strip -> view toggle -> main content -> drill-in sheet`
- month title과 month actions가 첫 화면을 먹지 않아야 한다.
- summary strip은 dense summary 역할만 하고 hero처럼 커지면 안 된다.

### 4.2 Radar
- `app bar -> app actions -> strip -> featured panel -> stacked sections`
- featured comeback은 유일한 accent block이다.
- 이후 섹션은 동일한 density rhythm으로 이어져야 한다.

### 4.3 Search
- `input -> segment -> history/recommended or results`
- empty 검색 상태는 chip wall이 아니라 calm utility panel로 정리한다.
- 결과 rows는 row scanning이 우선이지 카드 장식이 우선이 아니다.

### 4.4 Team Detail
- `app bar -> compact hero -> next upcoming -> latest release -> recent albums -> optional extended sections`
- hero는 팀 식별에만 집중하고, heavy banner처럼 커지지 않는다.

### 4.5 Release Detail
- `app bar -> release hero -> album actions -> tracks -> supporting info -> MV`
- track list가 가장 긴 body 영역이고, hero나 action group이 이를 압도하면 안 된다.

## 5. Hierarchy Rules
- 한 화면에서 강한 시선 집중 블록은 최대 1개
- section title은 screen title보다 약하고, card title보다 약간만 강해야 한다.
- CTA 위계는 항상 `navigation > service > source/meta`
- status chip은 action처럼 보이면 안 된다.
- fallback/empty/error는 content를 대신하는 block이지 decorative break가 아니다.

## 6. Card-Heavy Layout에서 벗어나는 기준
- 같은 depth의 카드가 3개 이상 연속되면 strip / inset / divider 기반 재구성을 먼저 검토한다.
- 요약 정보는 summary strip이나 tonal panel로 이동한다.
- context 설명은 hero 또는 disclosure panel에 모으고, 각 카드에 반복하지 않는다.
- 한 화면에서 서로 다른 역할의 block은 `shape`, `padding`, `contrast` 중 최소 하나는 달라야 한다.

## 7. Asset and Motion Split
- visual identity는 아래 child issue로 분리 추적한다.
  - `#512` app icon system
  - `#513` splash + restrained launch animation
  - `#514` loading / skeleton / retry-feedback system
  - `#515` richer non-card components
  - `#516` placeholder / badge / fallback asset pack
  - `#517` motion system
  - `#518` export assets / implementation handoff
- dark mode는 별도 축으로 분리한다.
  - `#519` dark mode umbrella
  - `#520` semantic token / theme mapping
  - `#521` shared components and main screens
  - `#522` splash / loading / placeholder dark assets
  - `#523` dark-mode accessibility and contrast QA

## 8. Recommended Execution Order
1. `#511` visual identity system 고정
2. `#512`, `#515`, `#516`
3. `#513`, `#514`, `#517`
4. `#518`
5. `#519` 이후 dark-mode split (`#520`-`#523`)

## 9. Acceptance Mapping
- visual system이 아이콘/스플래시/로딩/공통 컴포넌트/모션으로 분리되어 추적되어야 한다.
- card 외 surface language가 `strip`, `tonal panel`, `inset section`, `compact hero`, `sheet`로 정의되어야 한다.
- practical tool tone을 해치지 않는 범위에서 세련된 accent가 유지되어야 한다.
- child issue order와 dependency가 문서에 남아야 한다.

## 10. 참조 문서
- `visual-design-spec.md`
- `component-catalog.md`
- `wireframe-block-diagrams.md`
- `design-token-spec.md`
- `accessibility-platform-spec.md`
