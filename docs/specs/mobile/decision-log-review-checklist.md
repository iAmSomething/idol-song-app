# Decision Log Review Checklist

이 체크리스트는 모바일 구현이 [decision-log.md](/Users/gimtaehun/Desktop/idol-song-app/docs/specs/mobile/decision-log.md)의 고정 판단을 어기지 않는지 빠르게 점검하기 위한 것이다.

## 공통 체크

- `D-01` 앱 내 직접 음원 재생 미지원
  - 화면이 raw audio playback UI를 새로 만들지 않았는가
  - 서비스 handoff만 제공하는가
- `D-02` 외부 서비스 handoff 우선
  - Spotify / YouTube Music / YouTube MV 이동 경로가 살아 있는가
  - canonical / search fallback / browser fallback 규칙이 유지되는가
- `D-03` 팀 페이지는 실용 허브
  - 팀 상세 순서가 `다음 컴백 -> 최신 발매 -> 최근 앨범`을 유지하는가
- `D-04` 앨범 상세는 독립 소비 화면
  - release detail이 팀 페이지 보조 패널로 축소되지 않았는가
  - 트랙/서비스/MV 상태가 독립적으로 보이는가
- `D-05` 날짜 drill-in은 bottom sheet
  - calendar 탭이 full route push 대신 sheet drill-in을 유지하는가
- `D-07` alias-aware search
  - 한글명, 약칭, 표기 변형 검색 결과가 끊기지 않는가
- `D-08` 태그는 액션이 아님
  - chip/status badge가 button처럼 동작하지 않는가
- `D-09` 레이더의 주 CTA는 팀 페이지
  - radar 카드에서 팀 진입이 서비스 액션보다 앞서는가

## 데이터 / 신뢰도 체크

- dataset degraded/error 처리가 화면마다 복제되지 않았는가
- source confidence / external dependency notice가 필요한 surface에서 빠지지 않았는가
- 없는 데이터를 placeholder로 꾸며서 있는 것처럼 보이게 하지 않았는가
- fallback은 명시적 notice로 보이고, silent substitution이 아닌가

## 테스트 체크

- 변경한 surface에 screen-level regression test가 있는가
- shared helper를 도입했다면 helper 단위 테스트가 있는가
- route/export smoke가 깨지지 않는가
