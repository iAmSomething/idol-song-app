# Privacy and Security Spec

## 1. 목적
이 문서는 모바일 앱의 최소 개인정보/보안 정책을 정의한다.
외부 서비스 handoff와 analytics가 많기 때문에, 무엇을 수집하지 않고 무엇을 안전하게 열어야 하는지 명확히 해야 한다.

## 2. 개인정보 원칙
- 개인 계정 연동이 없는 한, 사용자 식별 중심 설계를 하지 않는다.
- 검색어, 필터, handoff 사용량은 제품 분석 목적 범위에서만 다룬다.
- 민감한 개인정보, 연락처, 위치, 미디어 라이브러리 권한은 v1 범위에 없다.

## 3. 외부 링크 보안
- 외부 open 대상은 화이트리스트 성격의 known service/source domain만 허용한다.
- user-generated URL을 그대로 open하지 않는다.
- 서비스 handoff URL은 app 내부 builder를 통해 생성한다.

## 4. 서비스별 원칙
### 4.1 Spotify
- canonical URL 또는 검색 URL만 사용한다.
- deep link를 쓴다면 플랫폼 fallback URL을 함께 유지해야 한다.

### 4.2 YouTube Music
- canonical URL 또는 검색 URL만 사용한다.
- 임의 query string 조작으로 추적 파라미터를 붙이지 않는다.

### 4.3 YouTube MV
- embed 또는 외부 open 모두 공식 video id/URL만 사용한다.
- no-cookie embed가 가능하면 우선 사용한다.

## 5. 소스 링크 원칙
- agency / weverse / official social / news source 등 사전 분류된 source만 사용한다.
- unknown domain은 표시 모델에서 강등하거나 숨길 수 있어야 한다.

## 6. 분석 이벤트 원칙
- analytics 이벤트에는 사용자 실명, 이메일, 계정 ID를 넣지 않는다.
- query는 저장하더라도 과도한 free-text 보관 정책을 피한다.
- analytics는 제품 흐름 판단을 위한 aggregate 수준 해석을 목표로 한다.

## 7. 로컬 저장 원칙
- 최근 검색어는 온디바이스 저장만 우선 고려한다.
- 검색어 저장 수량과 유지 기간은 제한되어야 한다.
- 개인 프로필이나 로그인을 전제한 장기 히스토리 저장은 비범위다.

## 8. 실패 처리
- 외부 open 실패 시 앱은 crash하지 않고 toast/snackbar만 보여준다.
- 보안상 차단된 URL은 open 시도 전에 막아야 한다.
- unknown source는 meta action을 숨기거나 disabled 처리한다.

## 9. QA 체크포인트
- 모든 external handoff가 허용된 scheme/domain만 여는지 확인한다.
- analytics payload에 PII가 없는지 확인한다.
- no-link fallback에서 버튼이 숨겨지거나 검색 fallback으로 자연스럽게 전환되는지 확인한다.
