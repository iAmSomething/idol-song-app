# View State Models

## 1. 목적
이 문서는 각 화면이 내부적으로 가져야 할 최소 상태 모델과 상태 전이 규칙을 정의한다.
구현자는 state shape를 임의로 흩뿌리지 않고 화면 단위 모델로 관리해야 한다.

## 2. Calendar Screen State
```ts
{
  currentMonth: string,
  selectedDate: string | null,
  viewMode: 'calendar' | 'list',
  filters: CalendarFilters,
  isFilterSheetOpen: boolean,
  isDateDetailSheetOpen: boolean,
  loadingState: 'idle' | 'loading' | 'error'
}
```

### 전이 규칙
- month change -> `currentMonth` 갱신
- day tap -> `selectedDate` 갱신 + `isDateDetailSheetOpen=true`
- sheet close -> `isDateDetailSheetOpen=false`, `selectedDate` 유지 가능
- filter apply -> `filters` 갱신, 필요 시 selectedDate 유효성 재검사

## 3. Radar Screen State
```ts
{
  filters: RadarFilters,
  isFilterSheetOpen: boolean,
  loadingState: 'idle' | 'loading' | 'error'
}
```

### 전이 규칙
- filter toggle -> 임시 상태 반영
- apply -> 리스트 재계산
- featured candidate 제거 시 next candidate로 교체

## 4. Search Screen State
```ts
{
  query: string,
  selectedSegment: 'team' | 'release' | 'upcoming',
  recentQueries: string[],
  isFocused: boolean,
  loadingState: 'idle' | 'loading' | 'error'
}
```

### 전이 규칙
- input change -> `query` 갱신 + search recompute
- clear -> `query=''`
- segment switch -> `selectedSegment`만 갱신, `query` 유지
- row tap -> push/external 후 state 유지

## 5. Team Detail State
```ts
{
  artistSlug: string,
  loadingState: 'idle' | 'loading' | 'error',
  hasUpcoming: boolean,
  hasAlbums: boolean
}
```

### 전이 규칙
- enter -> data fetch/select
- latest release tap -> Release Detail push
- back -> scroll position 복원

## 6. Release Detail State
```ts
{
  releaseKey: string,
  loadingState: 'idle' | 'loading' | 'error',
  hasTracks: boolean,
  hasMv: boolean
}
```

### 전이 규칙
- enter -> detail lookup
- external service tap -> state 유지
- back -> Team Detail scroll position 복원

## 7. Filter Sheet State
```ts
{
  draftFilters: Record<string, string[]>,
  committedFilters: Record<string, string[]>
}
```

### 전이 규칙
- open -> draft = committed
- toggle -> draft 갱신
- reset -> draft 초기화
- apply -> committed = draft, close
- dismiss without apply -> draft 폐기

## 8. 공통 규칙
- screen state와 derived selector result는 분리한다.
- external open은 화면 state를 초기화하지 않는다.
- `loading`, `empty`, `error`, `partial`은 동시에 true/false boolean으로 흩어지지 않게 enum 또는 파생 규칙으로 관리한다.
