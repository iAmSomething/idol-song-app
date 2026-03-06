# Component and Action System Spec

## 1. 목적

이 문서는 모바일 앱 전체에 적용할 공통 컴포넌트/액션 시스템 명세서다.
문제는 특정 화면이 아니라 버튼, 링크, 칩, 서비스 액션이 뒤섞이는 데서 시작하므로, 모든 화면은 이 문서를 기준으로 CTA를 배치한다.

## 2. 디자인 방향
- 도구형 70
- 에디토리얼형 30
- 큰 장식보다 빠른 스캔과 명확한 행동 유도 우선

## 3. 액션 위계
1. 탐색 액션
2. 서비스 액션
3. 출처/근거 액션
4. 정보 태그

## 4. 액션 타입

### 4.1 Primary Action
#### 목적
- 사용자가 다음 맥락으로 진입하는 핵심 행동

#### 예시
- 팀 페이지
- 앨범 상세 보기

#### 규칙
- 카드/섹션당 최대 1개
- 가장 높은 대비와 명확한 버튼 형태 사용
- 라벨은 동사+대상보다 짧고 명확하게 유지
- 예: `팀 페이지`, `상세 보기`

### 4.2 Secondary Action
#### 목적
- Primary 다음 순위의 탐색 행동

#### 예시
- 트랙 보기
- 더보기

#### 규칙
- Primary보다 약한 색/두께 사용
- 정보 태그와 혼동되지 않게 버튼 경계 유지

### 4.3 Service Action
#### 목적
- 외부 음악/영상 서비스로 이동

#### 대상
- Spotify
- YouTube Music
- YouTube MV

#### 규칙
- `icon mark + 짧은 라벨`
- 서비스 간 구조 동일
- 브랜드 컬러는 아이콘, 링, 옅은 tint 수준으로 제한
- 검색 fallback 여부는 버튼 표면보다 보조 정보에 표시
- 서비스 버튼은 그룹으로 묶는다

### 4.4 Meta Action
#### 목적
- 기사, 공지, 출처 확인

#### 예시
- 기사 원문
- 공식 공지
- 출처 보기

#### 규칙
- 가장 약한 시각적 비중
- 텍스트 링크 또는 매우 약한 보조 버튼
- 서비스 액션보다 절대 앞에 나오지 않는다

### 4.5 Informational Chip
#### 목적
- 상태, 형식, 분류 표시

#### 예시
- 예정
- 확정
- 싱글
- 미니
- 타이틀

#### 규칙
- 액션처럼 보이면 안 된다
- 눌러질 것 같은 그림자/강한 hover 없음
- 시각적으로 정보를 요약하는 역할만 수행

## 5. 공통 컴포넌트 목록

### 5.1 Team Identity Row
#### 포함 요소
- 팀 배지
- 팀명
- optional 보조 정보(소속사/act type)

#### 사용 화면
- 캘린더 상세
- 레이더 카드
- 검색 결과
- 팀 상세 헤더 일부

### 5.2 Service Action Group
#### 포함 요소
- Spotify 버튼
- YouTube Music 버튼
- YouTube MV 버튼(optional)

#### 규칙
- 한 줄 우선
- 공간 부족 시 wrap 허용
- 버튼 순서 고정: Spotify -> YouTube Music -> YouTube MV

### 5.3 Status Chip Group
#### 포함 요소
- 상태
- 형식
- confidence(optional)
- 타이틀곡 표시(optional)

#### 규칙
- 버튼과 다른 영역에 배치
- service group과 섞지 않음

### 5.4 Source Link Row
#### 포함 요소
- 기사 원문
- 공식 공지
- 출처 보기

#### 규칙
- 보조 영역에 배치
- 텍스트 링크 또는 미세한 보조 버튼 사용

## 6. 화면별 적용 요약

### 6.1 캘린더 날짜 상세
- Primary: 팀 페이지
- Secondary: 상세 보기
- Service: Spotify / YouTube Music / MV
- Meta: 출처

### 6.2 레이더 카드
- Primary: 팀 페이지
- Meta: 공식 공지 / 기사
- Service: 기본 없음 또는 약함

### 6.3 팀 상세
- Primary: 최신 발매 상세, 최근 앨범 상세
- Service: 최신 발매 서비스 액션
- Meta: 공식 링크 / 출처

### 6.4 앨범 상세
- Service: 앨범 레벨 / 트랙 레벨 서비스 액션
- Meta: 발매일, 크레딧, 출처
- Informational chip: 타이틀 / 더블타이틀 / 형식

### 6.5 월간 리스트/대시보드
- Primary: 팀 페이지 또는 상세 보기
- Service: 압축된 서비스 버튼
- Meta: 출처 / 상태

## 7. 상태별 규칙

### 7.1 Default
- 모든 액션은 명확히 식별 가능해야 한다.

### 7.2 Loading
- skeleton 또는 placeholder 사용
- 버튼은 disable 상태

### 7.3 Empty
- 빈 상태 메시지 + 필요한 경우 Primary action 1개만 노출

### 7.4 Error
- 재시도 또는 이전 화면 복귀 액션 제공
- 서비스 버튼은 숨김 또는 disable

### 7.5 Partial Data
- 서비스 버튼 일부만 있어도 레이아웃이 깨지지 않아야 함
- 출처/메타 누락 시 해당 영역만 숨김

## 8. 애니메이션 원칙

### 8.1 액션 피드백
- press down scale 또는 opacity 변화는 약하게
- 120ms~180ms 정도의 짧은 피드백

### 8.2 화면 전환
- 기본 네이티브 push/pop 사용
- 커스텀 전환은 v1 제외

### 8.3 sheet
- 기본 bottom sheet open/close
- 배경 dim 적용

### 8.4 금지
- 과도한 bounce
- 서비스 버튼마다 다른 과장 애니메이션

## 9. 접근성
- 서비스 버튼은 아이콘만 쓰지 말고 라벨 포함
- chip과 버튼은 접근성 role을 명확히 구분
- 최소 터치 영역 44x44pt

## 10. 수용 기준
- 어떤 화면이든 Primary / Service / Meta / Chip이 섞여 보이지 않아야 한다.
- 사용자는 버튼과 태그를 쉽게 구분할 수 있어야 한다.
- 서비스 액션은 로고/아이콘만 보고도 구분 가능해야 한다.

## 11. 구현자 참고 문서
- 구조와 공통 블록은 `component-catalog.md`를 따른다.
- 간격/크기/비율은 `visual-design-spec.md`, `layout-constraint-spec.md`를 따른다.
- loading/empty/partial/error 처리는 `state-feedback-spec.md`를 따른다.
