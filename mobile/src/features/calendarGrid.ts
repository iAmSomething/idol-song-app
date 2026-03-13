import type {
  CalendarDayBadgeKind,
  CalendarDayBadgeModel,
  CalendarDayCellModel,
  CalendarMonthGridModel,
  CalendarMonthSnapshotModel,
  CalendarSelectedDayModel,
  ReleaseSummaryModel,
  UpcomingEventModel,
} from '../types';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function buildMonthDate(month: string, day = 1): Date {
  return new Date(`${month}-${`${day}`.padStart(2, '0')}T00:00:00`);
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSelectedDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function isIsoDateInMonth(isoDate: string, month: string): boolean {
  return isoDate.slice(0, 7) === month;
}

function buildTeamMonogram(label: string): string {
  const compact = label.replace(/\s+/g, '');
  if (!compact) {
    return '??';
  }

  const hasHangul = /[가-힣]/.test(compact);
  if (hasHangul) {
    return compact.slice(0, 2);
  }

  return compact.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || compact.slice(0, 2).toUpperCase();
}

function getBadgeKind(
  group: string,
  releaseRows: ReleaseSummaryModel[],
  upcomingRows: UpcomingEventModel[],
): CalendarDayBadgeKind {
  if (releaseRows.some((item) => item.group === group)) {
    return 'release';
  }

  return upcomingRows.find((item) => item.group === group)?.status ?? 'scheduled';
}

function getBadgeLabel(
  group: string,
  releaseRows: ReleaseSummaryModel[],
  upcomingRows: UpcomingEventModel[],
): string {
  return (
    releaseRows.find((item) => item.group === group)?.displayGroup ??
    upcomingRows.find((item) => item.group === group)?.displayGroup ??
    group
  );
}

function getBadgeImageUrl(
  group: string,
  releaseRows: ReleaseSummaryModel[],
  upcomingRows: UpcomingEventModel[],
): string | undefined {
  const releaseMatch = releaseRows.find((item) => item.group === group);
  if (releaseMatch?.badgeImageUrl || releaseMatch?.representativeImageUrl) {
    return releaseMatch.badgeImageUrl ?? releaseMatch.representativeImageUrl;
  }

  const upcomingMatch = upcomingRows.find((item) => item.group === group);
  return upcomingMatch?.badgeImageUrl ?? upcomingMatch?.representativeImageUrl ?? undefined;
}

function buildBadges(
  releaseRows: ReleaseSummaryModel[],
  upcomingRows: UpcomingEventModel[],
): CalendarDayBadgeModel[] {
  const seenGroups = new Set<string>();
  const groups = [...releaseRows.map((item) => item.group), ...upcomingRows.map((item) => item.group)].filter((group) => {
    if (seenGroups.has(group)) {
      return false;
    }

    seenGroups.add(group);
    return true;
  });

  return groups.slice(0, 2).map((group) => {
    const label = getBadgeLabel(group, releaseRows, upcomingRows);
    return {
      id: `${group}-${getBadgeKind(group, releaseRows, upcomingRows)}`,
      group,
      label,
      monogram: buildTeamMonogram(label),
      kind: getBadgeKind(group, releaseRows, upcomingRows),
      imageUrl: getBadgeImageUrl(group, releaseRows, upcomingRows),
    };
  });
}

function buildSelectedDayModel(
  snapshot: CalendarMonthSnapshotModel,
  selectedDayIso: string,
): CalendarSelectedDayModel {
  const releases = snapshot.releases.filter((item) => item.releaseDate === selectedDayIso);
  const exactUpcoming = snapshot.exactUpcoming.filter((item) => item.scheduledDate === selectedDayIso);

  return {
    isoDate: selectedDayIso,
    label: formatSelectedDayLabel(selectedDayIso),
    releases,
    exactUpcoming,
    isEmpty: releases.length === 0 && exactUpcoming.length === 0,
  };
}

export function shiftMonthKey(month: string, offset: number): string {
  const base = buildMonthDate(month);
  return formatIsoDate(new Date(base.getFullYear(), base.getMonth() + offset, 1)).slice(0, 7);
}

export function resolveInitialCalendarSelection(month: string, todayIsoDate: string): string {
  if (todayIsoDate.slice(0, 7) === month) {
    return todayIsoDate;
  }

  return `${month}-01`;
}

export function resolveNextCalendarSelection(currentIsoDate: string, nextIsoDate: string, month: string): string {
  if (nextIsoDate.slice(0, 7) !== month) {
    return currentIsoDate;
  }

  return nextIsoDate;
}

function resolveSafeSelection(
  month: string,
  selectedDayIso: string,
  todayIsoDate: string,
): string {
  if (isIsoDateInMonth(selectedDayIso, month)) {
    return selectedDayIso;
  }

  return resolveInitialCalendarSelection(month, todayIsoDate);
}

export function buildCalendarMonthGrid(
  snapshot: CalendarMonthSnapshotModel,
  selectedDayIso: string,
  todayIsoDate: string,
): CalendarMonthGridModel {
  const safeSelectedDayIso = resolveSafeSelection(snapshot.month, selectedDayIso, todayIsoDate);
  const monthStart = buildMonthDate(snapshot.month);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingEmptyCells = monthStart.getDay();
  const releaseMap = new Map<string, ReleaseSummaryModel[]>();
  const upcomingMap = new Map<string, UpcomingEventModel[]>();

  for (const release of snapshot.releases) {
    const rows = releaseMap.get(release.releaseDate) ?? [];
    rows.push(release);
    releaseMap.set(release.releaseDate, rows);
  }

  for (const upcoming of snapshot.exactUpcoming) {
    if (!upcoming.scheduledDate) {
      continue;
    }

    const rows = upcomingMap.get(upcoming.scheduledDate) ?? [];
    rows.push(upcoming);
    upcomingMap.set(upcoming.scheduledDate, rows);
  }

  const cells: (CalendarDayCellModel | null)[] = [];
  for (let index = 0; index < leadingEmptyCells; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = `${snapshot.month}-${`${day}`.padStart(2, '0')}`;
    const releaseRows = releaseMap.get(isoDate) ?? [];
    const upcomingRows = upcomingMap.get(isoDate) ?? [];
    const uniqueGroupCount = new Set([...releaseRows.map((item) => item.group), ...upcomingRows.map((item) => item.group)]).size;

    cells.push({
      isoDate,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: isoDate === todayIsoDate,
      isSelected: isoDate === safeSelectedDayIso,
      badges: buildBadges(releaseRows, upcomingRows),
      overflowCount: Math.max(0, uniqueGroupCount - 2),
      releaseCount: releaseRows.length,
      upcomingCount: upcomingRows.length,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (CalendarDayCellModel | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return {
    month: snapshot.month,
    weekdayLabels: [...WEEKDAY_LABELS],
    weeks,
    selectedDay: buildSelectedDayModel(snapshot, safeSelectedDayIso),
  };
}
