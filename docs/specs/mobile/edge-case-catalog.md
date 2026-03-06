# Edge Case Catalog

## 1. 목적
이 문서는 실제 구현 중 자주 발생할 예외 케이스와 fallback 정책을 정리한다.

## 2. 검색
### 2.1 별칭만 존재
- 예: `투바투`, `트와이스`, `블핑`
- 처리: `search_aliases` 우선 매칭

### 2.2 오타
- v1에서는 fuzzy search 미지원
- exact normalization 범위만 보장

## 3. 예정 데이터
### 3.1 같은 컴백 기사 다수
- 처리: dedupe
- 대표 소스 우선순위: agency > weverse > official social > news

### 3.2 날짜가 월만 있음
- 예: `2026-04`
- 처리: 캘린더 정확한 일자에는 배치하지 않고 월 범위 예정으로 유지

### 3.3 confidence 없음
- 처리: confidence chip 숨김

## 4. 릴리즈 데이터
### 4.1 latest_song만 있고 latest_album 없음
- 처리: 최신 발매 카드에 song stream 기준 노출

### 4.2 latest_album만 있고 트랙 정보 없음
- 처리: 릴리즈 메타와 서비스 버튼만 노출, 트랙 empty copy 표시

### 4.3 더블타이틀
- 처리: 둘 다 `타이틀` 표시

## 5. 이미지
### 5.1 대표 이미지 없음
- 처리: neutral placeholder

### 5.2 앨범 커버 없음
- 처리: placeholder cover

### 5.3 팀 배지 없음
- 처리: official badge -> representative image crop -> monogram fallback

## 6. 링크
### 6.1 Spotify canonical 없음
- 처리: 검색 fallback

### 6.2 YouTube Music canonical 없음
- 처리: 검색 fallback

### 6.3 MV 없음
- 처리: MV 섹션 숨김, 페이지 흐름 유지

## 7. 텍스트 길이
### 7.1 팀명 길이 초과
- 처리: 1줄 말줄임, 접근성 라벨에 전체명 제공

### 7.2 릴리즈명 길이 초과
- 카드에서는 2줄 제한, 상세에서는 전체 표시 허용

### 7.3 기사 제목 과도하게 김
- 예정 카드에서는 2줄까지, 나머지는 source summary로 축약

## 8. 상태 없음
### 8.1 예정/확정 판별 불가
- 처리: neutral chip 또는 숨김

### 8.2 형식 미확정
- 처리: 형식 칩 생략

## 9. 화면별 예외
### 9.1 빈 날짜 탭
- sheet 오픈 가능
- empty message 명확히 표시

### 9.2 최근 앨범 캐러셀 1개뿐
- 캐러셀 대신 단일 카드도 허용

### 9.3 검색 결과 하나도 없음
- 최근 검색과 추천 검색만 표시
