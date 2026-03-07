# TypeScript Interface Examples

## 1. 목적
이 문서는 모바일 구현 시 사용할 수 있는 TypeScript interface 예시를 제공한다.
실제 구현은 상황에 맞게 조정할 수 있지만, 핵심 필드명과 책임 분리는 이 예시를 기준으로 삼는다.

## 2. Core Models
```ts
export interface TeamBadge {
  imageUrl?: string;
  monogram?: string;
  label: string;
}

export interface TeamSummaryModel {
  slug: string;
  group: string;
  displayName: string;
  agency?: string;
  badge?: TeamBadge;
  representativeImageUrl?: string;
  officialYoutubeUrl?: string;
  officialXUrl?: string;
  officialInstagramUrl?: string;
}

export interface ReleaseSummaryModel {
  id: string;
  group: string;
  displayGroup: string;
  releaseTitle: string;
  releaseDate: string;
  releaseKind?: 'single' | 'mini' | 'album' | 'ep' | 'ost' | 'collab';
  representativeSongTitle?: string;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  youtubeMvUrl?: string;
  coverImageUrl?: string;
}

export interface UpcomingEventModel {
  id: string;
  group: string;
  displayGroup: string;
  scheduledDate?: string;
  scheduledMonth?: string;
  datePrecision: 'exact' | 'month_only' | 'unknown';
  headline: string;
  releaseLabel?: string;
  status?: 'scheduled' | 'confirmed' | 'rumor';
  confidence?: 'low' | 'medium' | 'high';
  sourceType: 'agency_notice' | 'weverse_notice' | 'official_social' | 'news_rss';
  sourceUrl?: string;
}

export interface TrackModel {
  order: number;
  title: string;
  isTitleTrack?: boolean;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
}

export interface ReleaseDetailModel {
  id: string;
  group: string;
  displayGroup: string;
  releaseTitle: string;
  releaseDate: string;
  releaseKind?: string;
  coverImageUrl?: string;
  spotifyUrl?: string;
  youtubeMusicUrl?: string;
  youtubeVideoId?: string;
  notes?: string;
  tracks: TrackModel[];
}
```

## 3. Screen State Examples
```ts
export interface CalendarScreenState {
  currentMonth: string;
  selectedDate: string | null;
  viewMode: 'calendar' | 'list';
  isFilterSheetOpen: boolean;
  isDateDetailSheetOpen: boolean;
  loadingState: 'idle' | 'loading' | 'error';
}

export interface SearchScreenState {
  query: string;
  selectedSegment: 'team' | 'release' | 'upcoming';
  recentQueries: string[];
  isFocused: boolean;
  loadingState: 'idle' | 'loading' | 'error';
}
```

## 4. Component Prop Examples
```ts
export interface ServiceButtonProps {
  service: 'spotify' | 'youtubeMusic' | 'youtubeMv';
  label: string;
  mode?: 'canonical' | 'searchFallback';
  disabled?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface TrackRowProps {
  order: number;
  title: string;
  isTitleTrack?: boolean;
  spotifyButton?: ServiceButtonProps;
  youtubeMusicButton?: ServiceButtonProps;
}

export interface DateDetailSheetProps {
  isOpen: boolean;
  title: string;
  summary?: string;
  verifiedRows: ReleaseSummaryModel[];
  scheduledRows: UpcomingEventModel[];
  onClose: () => void;
  onPressTeam: (group: string) => void;
  onPressRelease: (releaseId: string) => void;
}
```

## 5. Selector Return Examples
```ts
export interface CalendarDerivedModel {
  summary: {
    monthlyReleaseCount: number;
    monthlyUpcomingCount: number;
    nearestUpcomingLabel?: string;
  };
  days: Array<{
    isoDate: string;
    badges: TeamBadge[];
    extraCount: number;
  }>;
}
```

## 6. Rules
- raw JSON type와 display model type를 분리한다.
- nullable field는 selector 단계에서 최대한 축약한다.
- UI 컴포넌트는 raw JSON shape를 직접 알면 안 된다.
