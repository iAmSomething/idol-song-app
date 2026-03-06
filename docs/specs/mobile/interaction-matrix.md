# Interaction Matrix

## 1. 목적
이 문서는 화면별 모든 주요 인터랙션의 트리거, 결과, 이동 타입, 부작용을 표로 정의한다.
구현자와 QA는 이 문서를 기준으로 탭/시트/외부 이동 동작을 검증한다.

## 2. Calendar Screen
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Prev Month Button | tap | 이전 월 로드 | in-place | current month 갱신 |
| Next Month Button | tap | 다음 월 로드 | in-place | current month 갱신 |
| Search Button | tap | Search 탭 진입 | tab switch | 검색 상태 복귀 |
| Filter Button | tap | Filter Sheet 오픈 | sheet | 기존 필터값 표시 |
| Day Cell | tap | Date Detail Sheet 오픈 | sheet | selected day 갱신 |
| View Toggle `리스트` | tap | 리스트 모드 전환 | in-place | 월 유지 |
| Verified Row Primary | tap | Team Detail | push | 선택 day 상태 유지 |
| Verified Row Secondary | tap | Release Detail | push | 선택 day 상태 유지 |
| Verified Service Button | tap | 서비스 열기 | external | canonical 또는 검색 fallback |
| Scheduled Row Primary | tap | Team Detail | push | 없음 |
| Scheduled Source Link | tap | source 열기 | external | 없음 |

## 3. Radar Screen
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Search Button | tap | Search 탭 진입 | tab switch | 없음 |
| Filter Button | tap | Filter Sheet 오픈 | sheet | 기존 레이더 필터 표시 |
| Featured Card | tap | Team Detail | push | 없음 |
| Weekly Card | tap | Team Detail | push | 없음 |
| Change Card Primary | tap | Team Detail | push | 없음 |
| Change Card Source | tap | source 열기 | external | 없음 |
| Long-gap Card | tap | Team Detail | push | 없음 |
| Rookie Card | tap | Team Detail | push | 없음 |

## 4. Search Screen
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Search Input | input | 결과 재계산 | in-place | query 유지 |
| Clear Button | tap | 검색어 초기화 | in-place | 기본 상태 복귀 |
| Result Segment | tap | 세그먼트 전환 | in-place | query 유지 |
| Recent Search Item | tap | 해당 검색 재실행 | in-place | query 설정 |
| Clear History | tap | 최근 검색 삭제 | in-place | 최근 검색 비움 |
| Team Result Row | tap | Team Detail | push | query 유지 |
| Release Result Row | tap | Release Detail | push | query 유지 |
| Release Result Service | tap | 서비스 열기 | external | query 유지 |
| Upcoming Result Row | tap | Team Detail | push | query 유지 |
| Upcoming Source Link | tap | source 열기 | external | query 유지 |

## 5. Team Detail
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Back Button | tap | 이전 화면 복귀 | pop | 이전 화면 상태 복원 |
| Official Link | tap | 외부 링크 열기 | external | 화면 상태 유지 |
| Latest Release Primary | tap | Release Detail | push | Team scroll position 보존 |
| Latest Service Button | tap | 서비스 열기 | external | 없음 |
| Latest Source Link | tap | source 열기 | external | 없음 |
| Album Carousel Card | tap | Release Detail | push | Team scroll position 보존 |
| Next Comeback Source | tap | source 열기 | external | 없음 |

## 6. Release Detail
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Back Button | tap | 이전 화면 복귀 | pop | Team scroll position 복원 |
| Album Service Button | tap | 서비스 열기 | external | 없음 |
| Track Spotify Button | tap | Spotify 열기 | external | canonical 또는 검색 fallback |
| Track YouTube Music Button | tap | YouTube Music 열기 | external | canonical 또는 검색 fallback |
| MV Block / CTA | tap | YouTube MV 열기 또는 재생 | external/embed | autoplay 금지 |
| Source Link | tap | source 열기 | external | 없음 |

## 7. Filter Sheet
| 요소 | 트리거 | 결과 | 이동 타입 | 부작용/상태 |
|---|---|---|---|---|
| Toggle Filter Option | tap | 필터값 갱신 | in-sheet | 임시 상태 반영 |
| Reset Button | tap | 기본값 복원 | in-sheet | 임시 상태 초기화 |
| Apply Button | tap | 필터 적용 후 닫기 | sheet close | 대상 화면 재계산 |
| Background Tap | tap | 닫기 | sheet close | 미적용 또는 마지막 임시 상태 폐기 규칙 필요 |

## 8. Global Rules
- sheet 내부 액션은 sheet close 없이 push/external이 가능하다.
- external open 이후 앱 복귀 시 직전 화면 상태를 유지한다.
- in-place 상태 변경은 불필요한 scroll jump를 일으키면 안 된다.

## 9. 참조 문서
- 다중 화면 흐름은 `user-journey-sequences.md`에서 end-to-end로 확인한다.
