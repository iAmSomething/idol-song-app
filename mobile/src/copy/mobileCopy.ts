export const MOBILE_COPY = {
  action: {
    back: '이전으로',
    detailView: '상세 보기',
    clear: '지우기',
    close: '닫기',
    open: '열기',
    retry: '다시 시도',
    showSourceTimeline: '소스 타임라인 보기',
    hideSourceTimeline: '소스 타임라인 접기',
    sourceView: '소스 보기',
    teamPage: '팀 페이지',
  },
  feedback: {
    errorTitle: '오류',
    partialTitle: '일부 정보만 표시됩니다.',
    handoffFailedTitle: '외부 이동을 완료하지 못했습니다.',
    handoffRetryable: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
    handoffUnavailable: '지금은 열 수 있는 서비스 경로가 없습니다.',
  },
  surface: {
    calendarTitle: '캘린더',
    searchTitle: '검색',
    searchSubtitle: '한글 별칭, 팀명, 릴리즈명, 예정 헤드라인을 같은 규칙으로 찾습니다.',
    radarTitle: '레이더',
  },
  summary: {
    monthRelease: '이달 발매',
    upcoming: '예정 일정',
    nearestUpcoming: '가까운 일정',
    weeklyUpcoming: '이번 주 예정',
    changedSchedule: '일정 변경',
    longGap: '장기 공백',
  },
  source: {
    articleOriginal: '기사 원문',
    officialNotice: '공식 공지',
    sourceView: '소스 보기',
  },
  handoff: {
    appPreferred: '앱 우선',
    searchFallback: '검색 결과',
  },
  status: {
    confirmed: '확정',
    rumor: '루머',
    scheduled: '예정',
  },
  confidence: {
    high: '신뢰 높음',
    low: '신뢰 낮음',
    medium: '신뢰 보통',
  },
  date: {
    unknown: '날짜 미정',
  },
} as const;

type UpcomingStatusLike = 'confirmed' | 'rumor' | 'scheduled' | string | null | undefined;
type UpcomingConfidenceLike = 'high' | 'medium' | 'low' | string | null | undefined;
type UpcomingSourceTypeLike =
  | 'agency_notice'
  | 'weverse_notice'
  | 'official_social'
  | 'news_rss'
  | string
  | null
  | undefined;

export function formatMonthOnlyDateLabel(month?: string | null): string {
  if (!month) {
    return MOBILE_COPY.date.unknown;
  }

  return `${month} · ${MOBILE_COPY.date.unknown}`;
}

export function formatUpcomingDateLabel({
  scheduledDate,
  scheduledMonth,
}: {
  scheduledDate?: string | null;
  scheduledMonth?: string | null;
}): string {
  if (scheduledDate) {
    return scheduledDate;
  }

  return formatMonthOnlyDateLabel(scheduledMonth);
}

export function resolveUpcomingStatusLabel(status?: UpcomingStatusLike): string | undefined {
  switch (status) {
    case 'confirmed':
      return MOBILE_COPY.status.confirmed;
    case 'rumor':
      return MOBILE_COPY.status.rumor;
    case 'scheduled':
      return MOBILE_COPY.status.scheduled;
    default:
      return undefined;
  }
}

export function resolveUpcomingStatusWithFallback(status?: UpcomingStatusLike): string {
  return resolveUpcomingStatusLabel(status) ?? MOBILE_COPY.status.scheduled;
}

export function resolveUpcomingConfidenceLabel(
  confidence?: UpcomingConfidenceLike,
): string | undefined {
  switch (confidence) {
    case 'high':
      return MOBILE_COPY.confidence.high;
    case 'medium':
      return MOBILE_COPY.confidence.medium;
    case 'low':
      return MOBILE_COPY.confidence.low;
    default:
      return undefined;
  }
}

export function resolveSourceLinkLabel(sourceType?: UpcomingSourceTypeLike): string {
  if (
    sourceType === 'agency_notice' ||
    sourceType === 'weverse_notice' ||
    sourceType === 'official_social'
  ) {
    return MOBILE_COPY.source.officialNotice;
  }

  if (sourceType === 'news_rss') {
    return MOBILE_COPY.source.articleOriginal;
  }

  return MOBILE_COPY.source.sourceView;
}
