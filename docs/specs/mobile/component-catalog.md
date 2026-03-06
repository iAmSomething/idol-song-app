# Component Catalog

## 1. 목적
이 문서는 모바일 앱에서 반복 사용되는 공통 컴포넌트의 구조, 위치, 상태, 접근성, 상호작용 계약을 정의한다.
화면 스펙은 이 문서의 컴포넌트를 조합해 구성하는 것을 원칙으로 한다.

## 2. App Bar

### 2.1 목적
- 현재 화면의 제목과 전역 액션 제공

### 2.2 구성 요소
- leading action 1개 이하
- title 1개
- trailing actions 2개 이하

### 2.3 규칙
- safe area 아래 첫 줄에 고정
- title은 1줄 우선, 필요 시 2줄 허용
- trailing 액션은 Search/Filter/Settings 중 화면 목적에 맞는 것만 노출

### 2.4 상태
- default
- loading: title skeleton 가능
- scrolled: shadow 또는 divider 추가 허용

### 2.5 접근성
- leading/trailing icon button 모두 라벨 필수

## 3. Summary Strip

### 3.1 목적
- 현재 화면 컨텍스트를 숫자/짧은 텍스트로 요약

### 3.2 사용 화면
- Calendar
- Radar

### 3.3 규칙
- 카드형 2~3개까지 허용
- 탭 동작 없음
- 숫자만이 아니라 label이 반드시 함께 있어야 함

## 4. Segmented Control

### 4.1 목적
- 동일 화면 내 보기 전환

### 4.2 사용 예
- Calendar / List
- 발매 / 예정
- 팀 / 발매 / 예정

### 4.3 규칙
- 현재 상태가 명확히 보이도록 active segment 대비 확보
- 세그먼트 수는 2~3개 권장
- 화면 상단 고정 사용 가능

## 5. Day Cell

### 5.1 목적
- 월간 캘린더의 최소 정보 단위

### 5.2 구성
- 날짜 숫자
- 팀 배지 최대 2개
- 초과 항목 `+N`

### 5.3 인터랙션
- 탭: Date Detail Sheet 오픈
- long press: 미사용

### 5.4 상태
- default
- selected
- disabled(out-of-month)
- has-events

## 6. Sheet Header

### 6.1 목적
- bottom sheet 맥락 설명

### 6.2 구성
- title
- optional summary line
- optional close button
- drag handle

### 6.3 규칙
- title은 반드시 현재 drill-in 대상과 연결되어야 함
- close button은 시각적으로 약해야 하며 drag handle과 충돌하지 않음

## 7. Team Identity Row

### 7.1 목적
- 팀을 가장 빠르게 식별

### 7.2 구성
- 팀 배지
- 팀명
- optional agency / act type

### 7.3 규칙
- 팀명은 1줄 우선
- 배지는 항상 텍스트 왼쪽
- fallback badge 허용

## 8. Release Summary Row

### 8.1 목적
- 발매 정보를 compact하게 요약

### 8.2 구성
- Team Identity Row 일부
- 릴리즈명
- 형식 칩
- 날짜
- 액션 영역

### 8.3 액션 순서
1. Primary (`팀 페이지` 또는 `상세 보기`)
2. Secondary(optional)
3. Service Group
4. Meta Link Row

## 9. Upcoming Event Row

### 9.1 목적
- 예정 이벤트를 compact하게 요약

### 9.2 구성
- Team Identity Row 일부
- 예정명 또는 headline 요약
- 상태 칩
- 예정일
- source summary

### 9.3 규칙
- 서비스 버튼 기본 미노출
- source는 Meta 영역에만 존재

## 10. Service Button Group

### 10.1 목적
- 외부 서비스 이동을 묶어서 제공

### 10.2 버튼 순서
1. Spotify
2. YouTube Music
3. YouTube MV

### 10.3 규칙
- 같은 높이와 구조 유지
- 한 줄 우선, 필요 시 wrap 허용
- 각 버튼은 독립 tap target
- 그룹 전체가 하나의 버튼처럼 보이면 안 됨

### 10.4 상태
- default
- partial (일부 서비스만 노출)
- disabled/loading

## 11. Status Chip Group

### 11.1 목적
- 상태/형식/보조 메타를 요약

### 11.2 규칙
- 액션 영역과 시각적으로 분리
- Primary 버튼과 같은 줄에 과밀하게 배치하지 않음
- chip은 filter control처럼 보이면 안 됨

## 12. Source Link Row

### 12.1 목적
- 기사/공식 공지/원문 링크 제공

### 12.2 규칙
- 텍스트 링크 성격 유지
- 한 줄 또는 두 줄 이내
- source type icon 허용

## 13. Album Card

### 13.1 목적
- 최근 앨범 캐러셀 또는 리스트 아이템

### 13.2 구성
- cover
- release title
- date
- format chip

### 13.3 인터랙션
- 카드 전체 탭: Release Detail push
- 카드 안 별도 Service 버튼은 v1에서 비권장

## 14. Track Row

### 14.1 목적
- 릴리즈 상세에서 곡 단위 이동 제공

### 14.2 구성
- 트랙 번호
- 곡명
- 타이틀 badge(optional)
- Spotify 버튼
- YouTube Music 버튼

### 14.3 규칙
- 번호는 고정 폭
- 제목은 1~2줄 허용
- 서비스 버튼은 trailing 정렬
- 링크 없으면 해당 버튼만 숨김

## 15. Empty State Block

### 15.1 목적
- 데이터 없음 상태를 명확히 전달

### 15.2 구성
- 제목 또는 한 줄 문구
- optional 보조 설명
- optional CTA 1개

### 15.3 규칙
- 과한 일러스트 금지
- 문구는 직접적이어야 함

## 16. Error State Block

### 16.1 목적
- 실패를 설명하고 회복 경로 제공

### 16.2 구성
- 오류 문구
- retry CTA
- optional back CTA

### 16.3 규칙
- 서비스 링크 실패와 데이터 fetch 실패를 구분해 표현
- retry CTA는 Primary나 Secondary 중 하나로만 제공

## 17. Search Result Row

### 17.1 목적
- 검색 결과를 한 줄 단위로 스캔 가능하게 제공

### 17.2 타입
- team row
- release row
- upcoming row

### 17.3 규칙
- 행 전체 tap target은 탐색 액션 우선
- secondary service action은 release row에서만 허용
- trailing accessory가 많아져도 tap 충돌이 없어야 함
