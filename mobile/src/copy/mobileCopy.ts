export const MOBILE_COPY = {
  action: {
    back: '이전으로',
    detailView: '상세 보기',
    clear: '지우기',
    close: '닫기',
    dismiss: '닫기',
    open: '열기',
    openSettings: '설정 열기',
    notifications: '알림',
    enableNotifications: '알림 켜기',
    disableNotifications: '알림 끄기',
    refreshRegistration: '등록 다시 시도',
    requestPermission: '권한 요청',
    retry: '다시 시도',
    showSourceTimeline: '소스 타임라인 보기',
    hideSourceTimeline: '소스 타임라인 접기',
    sourceView: '소스 보기',
    teamPage: '팀 페이지',
    viewOnX: 'X에서 보기',
  },
  feedback: {
    errorTitle: '오류',
    partialTitle: '일부 정보만 표시됩니다.',
    handoffFailedTitle: '외부 이동을 완료하지 못했습니다.',
    handoffRetryable: '외부 앱을 열지 못했습니다. 같은 화면에서 다시 시도해 주세요.',
    handoffUnavailable: '지금은 열 수 있는 서비스 경로가 없습니다.',
    pushPermissionRequired: '알림 권한을 허용하면 신뢰도 높은 일정 업데이트를 바로 받을 수 있습니다.',
    pushPermissionDenied: '알림 권한이 꺼져 있어 현재는 알림을 보낼 수 없습니다. 시스템 설정에서 다시 켜 주세요.',
    pushRegistrationUnavailable: '이 빌드에서는 아직 푸시 등록을 완료하지 못했습니다. 설정에서 다시 시도해 주세요.',
    pushForegroundReceived: '새 일정 알림이 도착했습니다.',
  },
  surface: {
    calendarTitle: '캘린더',
    notificationsTitle: '알림 설정',
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
  push: {
    statusReady: '알림 수신 준비됨',
    statusNeedsPermission: '권한 요청 필요',
    statusDenied: '권한 꺼짐',
    statusUnavailable: '등록 미완료',
    trustedAlertsOn: '신뢰도 높은 일정 알림 받기',
    trustedAlertsOff: '알림이 꺼져 있습니다.',
    prePromptTitle: '컴백 일정 변화를 놓치지 않게 알림을 켭니다.',
    prePromptBody: '공식성 높은 일정 신호만 보수적으로 보내고, 원치 않으면 언제든 다시 끌 수 있습니다.',
    provisionalBody: '임시 허용 상태입니다. 알림은 받을 수 있지만 시스템 설정에서 노출 방식을 조정할 수 있습니다.',
    disabledBody: '권한이 꺼진 상태에서도 앱은 그대로 사용할 수 있습니다. 원하면 설정에서 다시 켤 수 있습니다.',
    syncSuccess: '알림 등록 상태를 최신으로 맞췄습니다.',
    syncFailed: '알림 등록 상태를 갱신하지 못했습니다.',
    foregroundOpen: '관련 화면 열기',
    foregroundDismiss: '나중에 보기',
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
