import {
  buildCalendarRouteParams,
  buildSearchRouteParams,
  buildRadarRouteParams,
  resolveCalendarRouteState,
  resolveRadarRouteState,
  resolveSearchRouteState,
} from './routeState';

describe('mobile route state helpers', () => {
  test('restores calendar route state safely from valid params', () => {
    expect(
      resolveCalendarRouteState(
        {
          month: '2026-03',
          date: '2026-03-11',
          filter: 'upcoming',
          sheet: 'open',
        },
        '2026-03',
      ),
    ).toEqual({
      activeMonth: '2026-03',
      filterMode: 'upcoming',
      isSheetOpen: true,
      selectedDayIso: '2026-03-11',
    });
  });

  test('drops invalid or incomplete calendar params safely', () => {
    expect(
      resolveCalendarRouteState(
        {
          month: '2026-3',
          date: 'oops',
          filter: 'broken',
          sheet: 'open',
        },
        '2026-03',
      ),
    ).toEqual({
      activeMonth: '2026-03',
      filterMode: 'all',
      isSheetOpen: false,
      selectedDayIso: null,
    });
  });

  test('search restoration only keeps segment when query is present', () => {
    expect(resolveSearchRouteState({ q: '최예나', segment: 'upcoming' })).toEqual({
      query: '최예나',
      activeSegment: 'upcoming',
    });
    expect(resolveSearchRouteState({ segment: 'releases' })).toEqual({
      query: '',
      activeSegment: 'entities',
    });
  });

  test('radar restoration accepts only valid status, act type, and section filters', () => {
    expect(
      resolveRadarRouteState({
        status: 'confirmed',
        actType: 'solo',
        sections: 'weekly,rookie',
      }),
    ).toEqual({
      statusFilter: 'confirmed',
      actTypeFilter: 'solo',
      enabledSections: ['weekly', 'rookie'],
    });

    expect(
      resolveRadarRouteState({
        status: 'broken',
        actType: 'project',
        sections: 'oops',
      }),
    ).toEqual({
      statusFilter: 'all',
      actTypeFilter: 'all',
      enabledSections: ['weekly', 'change', 'longGap', 'rookie'],
    });
  });

  test('builders emit sparse route params for restoration only', () => {
    expect(
      buildCalendarRouteParams({
        activeMonth: '2026-03',
        currentMonth: '2026-03',
        filterMode: 'all',
        isSheetOpen: false,
        selectedDayIso: '2026-03-11',
      }),
    ).toEqual({
      month: undefined,
      filter: undefined,
      date: undefined,
      sheet: undefined,
    });

    expect(buildSearchRouteParams({ query: '최예나', activeSegment: 'upcoming' })).toEqual({
      q: '최예나',
      segment: 'upcoming',
    });

    expect(
      buildRadarRouteParams({
        statusFilter: 'confirmed',
        actTypeFilter: 'solo',
        enabledSections: ['weekly', 'rookie'],
      }),
    ).toEqual({
      status: 'confirmed',
      actType: 'solo',
      sections: 'weekly,rookie',
    });
  });
});
