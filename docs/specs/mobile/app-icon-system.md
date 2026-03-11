# App Icon System

## 1. 목적
- 모바일 launch-grade visual identity의 첫 번째 실물 자산으로 app icon 방향을 고정한다.
- 실제 Expo build에 바로 연결 가능한 iOS primary icon과 Android adaptive icon 세트를 유지한다.

## 2. 콘셉트
- 방향: `practical tool + editorial accent`
- 핵심 비유: `release planner card + play/release tile`
- 유지해야 하는 주형:
  - dark field
  - light planning card
  - warm copper header
  - lower-right media tile

이 구조는 캘린더/릴리즈 도구 느낌을 먼저 만들고, K-pop release app이라는 맥락은 media tile로만 보조한다.

## 3. 선택안

### 3.1 Primary
- 파일: `mobile/assets/app-icon/icon-primary-source.svg`
- 특징:
  - charcoal outer field
  - ivory card
  - copper header strip
  - copper media tile + white play glyph
- 용도:
  - iOS primary icon
  - Expo universal `icon`

### 3.2 Alternate Exploration
- 파일: `mobile/assets/app-icon/icon-alternate-inverted-source.svg`
- 목적:
  - light-shell alternative 검토용
- 결과:
  - launch home screen 작은 크기에서 dark-field primary보다 경계가 약해 primary로 채택하지 않음

## 4. Android Adaptive Structure
- foreground source:
  - `mobile/assets/app-icon/icon-adaptive-foreground-source.svg`
- foreground export:
  - `mobile/assets/app-icon/icon-adaptive-foreground.png`
- background:
  - solid color `#241F18`
- monochrome source:
  - `mobile/assets/app-icon/icon-adaptive-monochrome-source.svg`
- monochrome export:
  - `mobile/assets/app-icon/icon-adaptive-monochrome.png`

규칙:
- foreground는 safe zone 안쪽에 main card와 media tile만 남긴다.
- adaptive background에는 texture나 gradient를 넣지 않는다.
- monochrome은 silhouette readability가 우선이고 내부 decoration은 줄인다.

## 5. Export Inventory
- `mobile/assets/app-icon/icon-app-store-1024.png`
  - iOS / Expo primary icon source
- `mobile/assets/app-icon/icon-adaptive-foreground.png`
  - Android adaptive foreground
- `mobile/assets/app-icon/icon-adaptive-monochrome.png`
  - Android themed icon / monochrome
- `mobile/assets/app-icon/icon-legibility-preview.png`
  - 1024 / 180 / 64 mock sanity board

## 6. Small-Size Legibility 기준
- 텍스트나 숫자를 icon 안에 넣지 않는다.
- dominant shape는 항상 3개만 유지한다.
  - outer field
  - planning card
  - media tile
- 내부 line count는 3줄을 넘기지 않는다.
- 64px preview에서 card silhouette와 tile 분리가 유지되어야 한다.

## 7. Expo Wiring
- universal icon:
  - `mobile/assets/app-icon/icon-app-store-1024.png`
- Android adaptive foreground:
  - `mobile/assets/app-icon/icon-adaptive-foreground.png`
- Android adaptive monochrome:
  - `mobile/assets/app-icon/icon-adaptive-monochrome.png`
- Android adaptive background color:
  - `#241F18`

## 8. 교체 규칙
- PNG export는 정본이 아니다.
- 수정은 source SVG를 먼저 바꾸고 export PNG를 다시 생성한다.
- `#518` export handoff 전까지는 이 문서와 asset inventory가 최소 handoff 역할을 한다.
