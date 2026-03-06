# Web Service Button System v1

## 1. 목적

이 문서는 웹 UI에서 `Spotify`, `YouTube Music`, `YouTube MV`를 같은 계열의 서비스 액션으로 보이게 만드는 v1 설계 기준서다.
목표는 브랜드를 알아볼 수 있게 하되, 화면 전체가 브랜드 광고처럼 보이지 않게 유지하는 것이다.

이 문서는 `ui-action-system-v1.md`의 `Service` 액션을 실제 버튼 시스템으로 구체화한다.

## 2. 적용 범위

v1 대상 서비스:
- `Spotify`
- `YouTube Music`
- `YouTube MV`

적용 표면:
- 캘린더 날짜 상세 카드
- 팀 페이지의 최신 발매/최근 앨범 블록
- 앨범/릴리즈 상세
- 월간 대시보드
- 그 외 `#59`에서 정리하는 주요 웹 액션 표면

제외:
- full logo 사용
- 신규 서비스 추가
- 앱 안 직접 재생
- 법무 수준의 로고 가이드 정리

## 3. 시스템 위치

서비스 버튼은 전역 액션 위계에서 `Primary/Secondary` 다음, `Meta` 이전에 위치한다.

원칙:
- 서비스 버튼은 탐색 CTA보다 강해지지 않는다.
- 서비스 버튼은 기사 링크, 출처 링크보다 명확히 강해야 한다.
- 서비스 버튼은 informational chip과 시각적으로 섞이면 안 된다.

## 4. 디자인 방향

- 브랜드 표현은 `icon mark + short label` 조합으로 제한한다.
- 브랜드 컬러는 버튼 전체 채움이 아니라 `아이콘`, `약한 tint background`, `hover/focus ring`에만 쓴다.
- 세 서비스는 같은 구조를 유지하고, 달라지는 것은 `아이콘`, `라벨`, `보조 접근성 텍스트`뿐이다.
- 일반 버튼과 같은 계열이되, 정보 카드처럼 보이지 않도록 분명한 control affordance를 준다.

## 5. 버튼 Anatomy

서비스 버튼은 아래 구조를 고정한다.

1. leading icon mark
2. short label
3. optional assistive text or tooltip

표면 규칙:
- 버튼 텍스트는 한 줄 유지
- 아이콘은 라벨보다 먼저 읽힌다.
- 아이콘 없이 텍스트만 노출하는 variant는 v1에서 사용하지 않는다.
- label 옆에 `canonical`, `search`, `fallback` 같은 구현 단어를 직접 붙이지 않는다.

## 6. 서비스별 정의

### 6.1 Spotify

- icon mark: Spotify를 식별할 수 있는 원형 기반 mark
- label: `Spotify`
- 역할: 청취
- 기본 톤: neutral button 위에 spotify green accent

### 6.2 YouTube Music

- icon mark: YouTube Music을 식별할 수 있는 원형 재생 기반 mark
- label: `YouTube Music`
- 역할: 청취
- 기본 톤: neutral button 위에 youtube music red accent

### 6.3 YouTube MV

- icon mark: YouTube/재생을 식별할 수 있는 play 기반 mark
- label: `YouTube MV`
- 역할: 시청
- 기본 톤: neutral button 위에 youtube red accent

보조 원칙:
- `YouTube Music`과 `YouTube MV`는 둘 다 YouTube 계열이지만 같은 아이콘을 재사용하지 않는다.
- `MV`는 짧은 라벨 유지용 축약이지만, 의미가 불명확한 표면에서는 접근성 텍스트로 `YouTube Music video`를 보강한다.

## 7. 그룹 규칙

서비스 버튼은 가능하면 `service group`으로 묶는다.

그룹 원칙:
- 한 카드 안에서는 동일한 버튼 높이와 radius를 쓴다.
- 버튼 너비는 서비스마다 달라도 되지만, padding과 baseline은 맞춘다.
- `Spotify`, `YouTube Music`, `YouTube MV` 순서로 배치한다.
- MV가 없는 경우 앞 두 개만 유지한다.
- 한 서비스만 있어도 단일 버튼이 아니라 `service group`의 축소 상태처럼 보여야 한다.

레이아웃 원칙:
- 넓은 화면에서는 가로 그룹을 우선한다.
- 좁은 화면에서는 wrap 또는 stack을 허용하되 순서는 유지한다.
- 공간이 부족해도 meta link를 service group 사이에 끼워 넣지 않는다.

## 8. 시각 규칙

### 8.1 공통 베이스

- 일반 text link가 아니라 명확한 button control 형태 사용
- 낮은 대비의 neutral base + 얕은 tint background
- 얇은 border 또는 soft inner contrast 허용
- hover 시 tint와 ring을 강화하되 과도한 glow는 금지
- focus-visible은 서비스별 accent를 반영한 ring으로 통일

### 8.2 브랜드 사용 제한

- 전체 버튼을 순수 브랜드 컬러 solid fill로 채우지 않는다.
- full logo, wordmark-only, 스티커형 배지 사용 금지
- 화면 전체에서 서비스 버튼만 과도하게 눈에 띄면 실패로 본다.

### 8.3 일반 버튼과의 구분

- Primary/Secondary와 다른 식별 포인트는 `icon mark`, `tint`, `group structure`
- 그러나 크기, 그림자, 채도 때문에 Primary보다 더 강하게 보이면 안 된다.
- 정보 chip처럼 평평하게 줄여서 클릭 가능한지 애매하게 만드는 것도 금지한다.

## 9. 상태 규칙

### 9.1 Canonical Link

- 기본 상태로 취급한다.
- 버튼 표면에는 별도 뱃지를 붙이지 않는다.
- 필요하면 tooltip이나 보조 설명에서 공식 링크임을 알려준다.

### 9.2 Search Fallback

- 버튼 라벨은 그대로 유지한다.
- `search fallback` 여부는 tooltip, `aria-label`, `sr-only` 텍스트, 작은 보조 설명에서 처리한다.
- fallback이라는 이유로 버튼을 disabled처럼 보이게 만들지 않는다.

권장 접근성 문구 예시:
- `Spotify 검색 결과 열기`
- `YouTube Music 검색 결과 열기`
- `YouTube MV 검색 결과 열기`

### 9.3 Missing Service

- 링크가 없으면 해당 버튼만 숨긴다.
- 없는 서비스를 placeholder chip으로 대체하지 않는다.
- service group 전체가 비면 group 자체를 숨긴다.

### 9.4 Dense or Compact Surface

- compact 모드에서도 아이콘과 라벨은 유지한다.
- 라벨을 `YT`처럼 과도하게 축약하지 않는다.
- 너무 좁으면 2줄 wrap을 허용하고, meta를 먼저 아래로 내린다.

## 10. 문구 규칙

- `Spotify`, `YouTube Music`, `YouTube MV` 라벨을 기본으로 사용한다.
- `열기`, `재생`, `시청`, `검색` 같은 동사는 버튼 안에 반복해서 붙이지 않는다.
- 동작 차이는 주변 copy, tooltip, 접근성 텍스트에서 설명한다.
- 사용자는 버튼을 보고 서비스 목적을 바로 이해해야 한다.

금지:
- `Open Spotify`
- `YouTube Music Search`
- `Canonical`
- `Fallback`
- `외부 링크`

## 11. 표면별 적용 기준

### 11.1 캘린더 날짜 상세 카드

- Primary 아래에 service group을 둔다.
- source/meta row보다 위에 둔다.
- 서비스 버튼이 많아도 `팀 페이지` CTA보다 강하게 보이면 안 된다.

### 11.2 팀 페이지

- 최신 발매 또는 최근 앨범 컨텍스트와 직접 붙여서 보여준다.
- 공식 SNS 링크와 시각 계층을 섞지 않는다.
- 서비스 버튼은 최신 발매 감상 이동으로 읽혀야 한다.

### 11.3 앨범/릴리즈 상세

- 이 표면에서는 service group 비중이 상대적으로 커질 수 있다.
- 그래도 `출처`, `발매 노트`, `크레딧`보다 위에 배치한다.
- 트랙 리스트 행 handoff는 같은 시스템의 compact variant를 사용한다.

### 11.4 월간 대시보드

- 표나 리스트 안에서는 compact variant를 사용한다.
- 서비스 버튼이 셀 텍스트처럼 보이지 않게 최소한의 control chrome을 유지한다.

## 12. 관련 이슈 연결

- `#13`은 이 시스템 위에서 Spotify / YouTube Music handoff URL 전략과 fallback 로직을 구현한다.
- `#18`은 `YouTube MV`를 보조 시청 액션 및 optional embed 흐름으로 확장한다.
- `#59`는 이 문서와 `ui-action-system-v1.md`를 기준으로 주요 웹 표면에 실제로 적용한다.

## 13. 구현 체크리스트

1. 세 서비스 버튼이 동일한 구조를 공유하는가?
2. 아이콘과 라벨만으로 서비스가 구분되는가?
3. 브랜드 컬러가 전체 버튼을 덮지 않고 accent 수준에 머무는가?
4. canonical과 fallback 차이가 버튼 표면이 아니라 보조 정보에서 처리되는가?
5. 서비스 버튼이 meta 링크보다 강하고, Primary보다 약한가?
6. compact 상태에서도 chip이나 plain text link처럼 보이지 않는가?
7. `#13`, `#18`, `#59`에서 재사용 가능한 규칙 수준으로 정리됐는가?

## 14. v1 수용 기준

- 서비스 액션이 일반 버튼/정보 카드와 구분되는 독립 시스템으로 설명 가능하다.
- 세 서비스가 같은 구조를 쓰고, 식별 요소만 다르게 유지된다.
- fallback 상태가 버튼 표면을 어지럽히지 않으면서도 접근성 측면에서 구분 가능하다.
- 후속 구현자가 브랜드 서비스 버튼을 화면에 일관되게 적용할 수 있다.
