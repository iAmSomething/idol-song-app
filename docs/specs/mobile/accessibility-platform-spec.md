# Accessibility and Platform Spec

## 1. 목적
이 문서는 모바일 앱의 접근성, 플랫폼 차이, 외부 앱 handoff 기준을 정의한다.

## 2. 터치 영역
- iOS 최소 터치 영역: 44pt
- Android 최소 터치 영역: 48dp
- 아이콘만 있는 버튼은 반드시 invisible padding 포함

## 3. VoiceOver / TalkBack
- 서비스 버튼은 아이콘만으로 끝내지 않는다.
- 접근성 라벨 예시:
  - `Spotify에서 STAYC STAY ALIVE 열기`
  - `YouTube Music에서 이 트랙 열기`
  - `팀 페이지 열기`
- 상태 칩은 읽히되 버튼으로 인식되면 안 된다.

## 4. Dynamic Type
- 제목은 2줄까지 허용
- 메타 라벨은 축소 또는 줄바꿈 허용
- 서비스 버튼 라벨은 잘리지 않도록 최소 폭 보장
- Dynamic Type 확대 시 아이콘과 텍스트가 겹치면 안 된다.

## 5. Contrast
- 상태 칩은 배경색만으로 의미 전달 금지
- 텍스트와 아이콘 대비는 WCAG AA 이상 목표
- brand tint는 읽기성보다 우선할 수 없다.

## 6. Motion Accessibility
- 시스템 `Reduce Motion` 활성 시
  - push/pop은 기본 전환 유지
  - 추가 fade/translate 최소화
  - spring/bounce 효과 제거
  - launch intro는 정적 소개 카드 + 짧은 hold로 축소
  - loading skeleton pulse는 정지하고 정적 placeholder로 유지
  - sheet는 slide 대신 fade를 우선 사용

## 7. Platform Behavior
### 7.1 iOS
- bottom sheet drag affordance를 명확히 표시
- swipe back 지원
- 외부 앱 이동 후 복귀는 시스템 기준

### 7.2 Android
- hardware back으로 sheet 우선 닫기
- stack screen이면 직전 화면 복귀
- 외부 앱 이동 후 복귀 시 화면 상태 유지

## 8. External App Handoff
- 앱이 설치되어 있으면 해당 앱 우선
- 실패 시 브라우저 fallback 허용
- canonical URL 없으면 검색 결과 페이지 open 허용
- 사용자에게 플레이 보장을 암시하는 과장 문구 금지

## 9. Empty and Error Accessibility
- empty state는 텍스트로 명확히 읽혀야 함
- retry 버튼은 스크린리더 포커스 가능해야 함
- skeleton만 길게 유지하면 안 되고, 일정 시간 이후 text fallback 필요
