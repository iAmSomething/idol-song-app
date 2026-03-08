# Web Spec Index

이 디렉터리는 현재 웹 UI를 계속 확장할 때 참조하는 설계 기준 문서 모음이다.
모바일 스펙과 달리, 웹에서 이미 운영 중인 정보 구조와 액션 흐름을 직접 정리하는 용도로 사용한다.

## 문서 구성

1. `ui-action-system-v1.md`
   - 전역 액션 위계
   - `Primary` / `Secondary` / `Service` / `Meta` / `Informational chip` 정의
   - 카드/섹션/화면별 CTA 배치 원칙
   - 후속 이슈 `#58`, `#59` 구현 기준
2. `service-button-system-v1.md`
   - Spotify / YouTube Music / YouTube MV 전용 서비스 버튼 시스템
   - 아이콘 mark + 짧은 라벨 규칙
   - canonical / fallback 상태 표기 원칙
   - 후속 구현 이슈 `#13`, `#18`, `#59` 연결 기준
3. `mobile-web-handoff-qa-matrix.md`
   - 모바일 브라우저 handoff QA matrix
   - Android Chrome / iOS Safari / representative in-app browser 기준
   - app installed / not installed, canonical / search fallback 차이
   - 후속 QA 이슈 `#291` 재검증 기준

## 읽는 순서

1. `ui-action-system-v1.md`
2. `service-button-system-v1.md`
3. `mobile-web-handoff-qa-matrix.md`

## 운영 원칙

- 전역 규칙은 화면별 예외보다 우선한다.
- informational chip과 실제 액션은 역할이 다르면 시각적으로도 다르게 보여야 한다.
- 서비스 액션은 별도 시스템으로 정의하고, 탐색 액션보다 강해지지 않도록 관리한다.
- 후속 구현 이슈는 이 디렉터리 문서를 먼저 갱신한 뒤 컴포넌트/CSS 작업을 진행한다.
