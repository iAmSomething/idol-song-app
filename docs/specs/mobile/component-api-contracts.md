# Component API Contracts

## 1. 목적
이 문서는 공통 컴포넌트의 props, emitted events, required data, fallback 규칙을 정의한다.
실제 구현 컴포넌트는 이 문서의 인터페이스 의미를 유지해야 한다.

## 2. AppBar

### Props
- `title: string`
- `leadingAction?: { icon: string; label: string; onPress: () => void }`
- `trailingActions?: Array<{ icon: string; label: string; onPress: () => void }>`
- `isLoading?: boolean`
- `isSticky?: boolean`

### Events
- `onPressLeading`
- `onPressTrailing(index)`

### Rules
- trailing action 개수 최대 2
- `label`은 접근성 라벨로 그대로 사용 가능해야 함
- `isLoading=true`면 title skeleton 가능, 버튼은 disabled 허용

## 3. SummaryStrip

### Props
- `items: Array<{ key: string; label: string; value: string | number }>`
- `layout?: 'horizontal' | 'wrap'`

### Rules
- items 최대 3개 권장
- 각 item은 탭 동작이 없어야 함
- label/value 둘 다 제공해야 함

## 4. SegmentedControl

### Props
- `items: Array<{ key: string; label: string }>`
- `selectedKey: string`
- `onChange: (key: string) => void`
- `isSticky?: boolean`

### Rules
- 2~3개 세그먼트 권장
- 선택 상태 대비가 충분해야 함
- 선택 변화가 스크롤 점프를 유발하면 안 됨

## 5. DayCell

### Props
- `dateNumber: number`
- `isCurrentMonth: boolean`
- `isSelected: boolean`
- `badges: Array<{ imageUrl?: string; monogram?: string; label: string }>`
- `extraCount?: number`
- `onPress: () => void`

### Events
- `onSelectDate`

### Rules
- badges 최대 2개
- `extraCount`가 있으면 마지막 슬롯에 `+N`
- long press 없음

## 6. SheetHeader

### Props
- `title: string`
- `summary?: string`
- `showCloseButton?: boolean`
- `onClose?: () => void`

### Rules
- drag handle은 별도 visual affordance로 포함
- close button은 optional
- title은 현재 drill-in 대상과 직접 연결돼야 함

## 7. TeamIdentityRow

### Props
- `name: string`
- `badgeImageUrl?: string`
- `monogram?: string`
- `meta?: string`
- `onPress?: () => void`

### Rules
- `badgeImageUrl`가 없으면 monogram fallback
- `meta`는 optional
- 이 row만으로 Primary CTA 역할을 하게 만들지 않음 unless screen spec says row tap is primary

## 8. ServiceButton

### Props
- `service: 'spotify' | 'youtubeMusic' | 'youtubeMv'`
- `label: string`
- `mode?: 'canonical' | 'searchFallback'`
- `disabled?: boolean`
- `onPress: () => void`

### Accessibility
- `accessibilityLabel`은 서비스명과 대상명을 포함해야 함

### Rules
- 아이콘 + 라벨 구조 고정
- `mode`는 UI 표면보다 tooltip/보조 텍스트에서 우선 사용
- `disabled`일 때 시각적으로 구분되되 공간은 유지 가능

## 9. ServiceButtonGroup

### Props
- `buttons: Array<{ service: 'spotify' | 'youtubeMusic' | 'youtubeMv'; label: string; mode?: 'canonical' | 'searchFallback'; disabled?: boolean; onPress: () => void }>`
- `wrap?: boolean`

### Rules
- button order는 Spotify -> YouTube Music -> YouTube MV
- 없는 버튼은 숨기되 나머지 버튼 정렬 유지

## 10. SourceLinkRow

### Props
- `links: Array<{ type: 'article' | 'official' | 'source'; label: string; url: string; onPress: () => void }>`

### Rules
- Meta 스타일 고정
- 링크 0개면 row 자체 숨김
- source type icon optional

## 11. ReleaseSummaryRow

### Props
- `team: { name: string; badgeImageUrl?: string; monogram?: string }`
- `title: string`
- `date: string`
- `chips?: Array<{ key: string; label: string }>`
- `primaryAction?: { label: string; onPress: () => void }`
- `secondaryAction?: { label: string; onPress: () => void }`
- `serviceButtons?: Array<...ServiceButton>`
- `sourceLinks?: Array<...SourceLink>`

### Rules
- primaryAction은 최대 1개
- serviceButtons와 sourceLinks는 독립 영역

## 12. UpcomingEventRow

### Props
- `team: { name: string; badgeImageUrl?: string; monogram?: string }`
- `headline: string`
- `scheduledDate?: string`
- `statusChip?: string`
- `confidenceChip?: string`
- `primaryAction: { label: string; onPress: () => void }`
- `sourceLinks?: Array<...SourceLink>`

### Rules
- 서비스 버튼 기본 미노출
- sourceLinks는 optional

## 13. AlbumCard

### Props
- `coverImageUrl?: string`
- `title: string`
- `date: string`
- `chips?: Array<{ key: string; label: string }>`
- `onPress: () => void`

### Rules
- 카드 전체 탭 = primary
- 별도 secondary CTA 없음

## 14. TrackRow

### Props
- `order: number`
- `title: string`
- `isTitleTrack?: boolean`
- `spotifyButton?: { label: string; mode?: 'canonical' | 'searchFallback'; onPress: () => void }`
- `youtubeMusicButton?: { label: string; mode?: 'canonical' | 'searchFallback'; onPress: () => void }`

### Rules
- `isTitleTrack=true`면 badge 노출
- 서비스 버튼 하나만 있어도 정렬 유지
- 둘 다 없으면 버튼 영역 비우거나 숨김, 대체 텍스트는 기본 미노출

## 15. EmptyStateBlock

### Props
- `message: string`
- `description?: string`
- `action?: { label: string; onPress: () => void }`

### Rules
- action 최대 1개
- message는 직접적이어야 함

## 16. ErrorStateBlock

### Props
- `message: string`
- `retryAction?: { label: string; onPress: () => void }`
- `backAction?: { label: string; onPress: () => void }`

### Rules
- retry가 있으면 가장 앞
- 서비스 open 실패용 toast와 혼동 금지

## 17. DateDetailSheet

### Props
- `isOpen: boolean`
- `title: string`
- `summary?: string`
- `verifiedRows: ReleaseSummaryRow[]`
- `scheduledRows: UpcomingEventRow[]`
- `onClose: () => void`

### Rules
- verifiedRows, scheduledRows가 모두 비어도 empty state를 포함해 열릴 수 있다.
- sheet 내부에서 push/external 액션 허용

## 18. FilterSheet

### Props
- `isOpen: boolean`
- `groups: Array<{ key: string; label: string; options: Array<{ key: string; label: string; selected: boolean }> }>`
- `onToggleOption: (groupKey: string, optionKey: string) => void`
- `onReset: () => void`
- `onApply: () => void`
- `onClose: () => void`

### Rules
- apply 이전에는 임시 상태 유지 가능
- background close 시 폐기/유지 정책은 screen-level spec을 따른다.

## 19. 참조 예시
- 실제 interface 네이밍 예시는 `typescript-interface-examples.md`를 참조한다.
