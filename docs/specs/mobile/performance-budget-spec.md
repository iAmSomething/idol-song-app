# Performance Budget Spec

## 1. 목적
이 문서는 모바일 앱이 체감 성능을 유지하기 위해 각 화면과 상호작용에 적용할 예산 개념을 정의한다.
정확한 ms 수치는 기기와 구현 방식에 따라 달라질 수 있지만, 문서 차원에서 느려지면 안 되는 구간을 먼저 고정한다.

## 2. 공통 원칙
- 첫 화면은 콘텐츠 없는 로딩 스피너보다 skeleton 또는 구조적 placeholder를 우선한다.
- 입력 응답, 시트 반응, 월 전환은 사용자 손동작과 거의 즉시 연결되어야 한다.
- 데이터 양이 늘어나도 primary CTA 노출이 느려지면 안 된다.

## 3. 화면별 예산
### 3.1 Calendar
- 월 전환은 즉각적인 헤더 반응과 짧은 데이터 갱신으로 보여야 한다.
- Day cell 렌더링은 전체 월 grid를 매번 비싸게 다시 그리지 않는 구조가 필요하다.
- Date Detail Sheet open은 tap 직후 지연 없이 시작되어야 한다.

### 3.2 Search
- 입력 중 키보드 지연이 느껴지면 안 된다.
- normalization과 alias matching은 selector/cache 레벨에서 최적화돼야 한다.
- 결과 세그먼트 전환은 full reload처럼 보이면 안 된다.

### 3.3 Team Detail
- 상단 hero, next comeback, latest release는 화면 초기에 먼저 보여야 한다.
- 아래 캐러셀/보조 섹션이 늦게 채워져도 핵심 CTA는 늦지 않아야 한다.

### 3.4 Release Detail
- 앨범 메타와 트랙 리스트는 우선 렌더링 대상이다.
- MV 영역은 늦게 붙어도 되며, 초기 렌더를 막으면 안 된다.

### 3.5 Radar
- Featured와 Weekly list는 우선 렌더링 대상이다.
- 장기 공백/루키 섹션은 후순위 로딩이 가능하다.

## 4. 구현 원칙
- selector는 memoization 가능 구조여야 한다.
- 큰 리스트는 virtualization을 고려해야 한다.
- 이미지 로딩이 텍스트 CTA 렌더링을 막으면 안 된다.
- heavy parsing은 screen render 중복 수행을 피해야 한다.

## 5. 금지 패턴
- 탭 전환마다 전체 dataset 재파싱
- 검색 입력마다 full-screen re-render
- 이미지 없이는 화면 전체를 숨기는 방식
- bottom sheet open 전에 비동기 작업 완료를 기다리는 방식

## 6. QA 체크포인트
- 저사양 기기/시뮬레이터에서 캘린더 월 전환과 search 입력 지연이 체감상 거슬리지 않아야 한다.
- 서비스 버튼과 primary CTA는 이미지/보조 블록보다 먼저 노출되어야 한다.
