export type CalendarFilterMode = 'all' | 'releases' | 'upcoming';
export type SearchSegment = 'entities' | 'releases' | 'upcoming';

type RouteParamValue = string | string[] | undefined;

type CalendarRouteParams = {
  date?: RouteParamValue;
  filter?: RouteParamValue;
  month?: RouteParamValue;
  sheet?: RouteParamValue;
};

type SearchRouteParams = {
  q?: RouteParamValue;
  segment?: RouteParamValue;
};

type RadarRouteParams = {
  hideEmpty?: RouteParamValue;
};

export type CalendarRouteState = {
  activeMonth: string;
  filterMode: CalendarFilterMode;
  isSheetOpen: boolean;
  selectedDayIso: string | null;
};

export type SearchRouteState = {
  activeSegment: SearchSegment;
  query: string;
};

export type RadarRouteState = {
  hideEmptySections: boolean;
};

export function getSingleRouteParam(value: RouteParamValue): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function isIsoMonth(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}$/.test(value);
}

function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveFilterMode(value: string | null): CalendarFilterMode {
  return value === 'releases' || value === 'upcoming' ? value : 'all';
}

function resolveSearchSegment(value: string | null): SearchSegment {
  return value === 'releases' || value === 'upcoming' ? value : 'entities';
}

export function resolveCalendarRouteState(
  params: CalendarRouteParams,
  todayMonth: string,
): CalendarRouteState {
  const monthParam = getSingleRouteParam(params.month);
  const dateParam = getSingleRouteParam(params.date);
  const resolvedDate = isIsoDate(dateParam) ? dateParam : null;
  const derivedMonth = resolvedDate ? resolvedDate.slice(0, 7) : null;
  const resolvedMonth = isIsoMonth(monthParam)
    ? monthParam
    : derivedMonth ?? todayMonth;
  const selectedDayIso =
    resolvedDate && resolvedDate.slice(0, 7) === resolvedMonth ? resolvedDate : null;

  return {
    activeMonth: resolvedMonth,
    filterMode: resolveFilterMode(getSingleRouteParam(params.filter)),
    isSheetOpen: getSingleRouteParam(params.sheet) === 'open' && selectedDayIso !== null,
    selectedDayIso,
  };
}

export function buildCalendarRouteParams(args: {
  activeMonth: string;
  currentMonth: string;
  filterMode: CalendarFilterMode;
  isSheetOpen: boolean;
  selectedDayIso: string | null;
}) {
  const includeMonth =
    args.activeMonth !== args.currentMonth ||
    args.filterMode !== 'all' ||
    args.isSheetOpen;

  return {
    month: includeMonth ? args.activeMonth : undefined,
    filter: args.filterMode !== 'all' ? args.filterMode : undefined,
    date: args.isSheetOpen && args.selectedDayIso ? args.selectedDayIso : undefined,
    sheet: args.isSheetOpen && args.selectedDayIso ? 'open' : undefined,
  };
}

export function resolveSearchRouteState(params: SearchRouteParams): SearchRouteState {
  const query = getSingleRouteParam(params.q)?.trim() ?? '';
  const segment = resolveSearchSegment(getSingleRouteParam(params.segment));

  return {
    activeSegment: query ? segment : 'entities',
    query,
  };
}

export function buildSearchRouteParams(args: {
  activeSegment: SearchSegment;
  query: string;
}) {
  const normalizedQuery = args.query.trim();

  return {
    q: normalizedQuery || undefined,
    segment: normalizedQuery ? args.activeSegment : undefined,
  };
}

export function resolveRadarRouteState(params: RadarRouteParams): RadarRouteState {
  const hideEmptyValue = getSingleRouteParam(params.hideEmpty);

  return {
    hideEmptySections: hideEmptyValue === '1',
  };
}

export function buildRadarRouteParams(args: { hideEmptySections: boolean }) {
  return {
    hideEmpty: args.hideEmptySections ? '1' : undefined,
  };
}

export function areRouteParamsEqual(
  left: Record<string, string | undefined>,
  right: Record<string, string | undefined>,
): boolean {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();

  return keys.every((key) => (left[key] ?? undefined) === (right[key] ?? undefined));
}
