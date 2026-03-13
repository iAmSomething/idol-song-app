import { buildCalendarMonthGrid, resolveInitialCalendarSelection, resolveNextCalendarSelection } from './calendarGrid';
import { cloneBundledDatasetFixture } from '../services/bundledDatasetFixture';
import { selectCalendarMonthSnapshot } from '../selectors';
import type { CalendarMonthSnapshotModel, ReleaseSummaryModel } from '../types';

function createRelease(
  group: string,
  displayGroup: string,
  releaseDate: string,
  overrides: Partial<ReleaseSummaryModel> = {},
): ReleaseSummaryModel {
  return {
    id: `${group}-${releaseDate}`,
    group,
    displayGroup,
    releaseTitle: `${displayGroup} release`,
    releaseDate,
    releaseKind: 'single',
    stream: 'song',
    contextTags: [],
    ...overrides,
  };
}

describe('calendar month grid', () => {
  test('builds a March 2026 grid with exact badges and month-only excluded from day cells', () => {
    const snapshot = selectCalendarMonthSnapshot(
      cloneBundledDatasetFixture(),
      '2026-03',
      '2026-03-07',
    );

    const grid = buildCalendarMonthGrid(snapshot, '2026-03-11', '2026-03-07');
    const march11 = grid.weeks.flat().find((cell) => cell?.isoDate === '2026-03-11');
    const march12 = grid.weeks.flat().find((cell) => cell?.isoDate === '2026-03-12');
    const march7 = grid.weeks.flat().find((cell) => cell?.isoDate === '2026-03-07');

    expect(grid.weekdayLabels).toEqual(['일', '월', '화', '수', '목', '금', '토']);
    expect(grid.weeks).toHaveLength(5);
    expect(march11).toEqual(
      expect.objectContaining({
        isSelected: true,
        releaseCount: 1,
        upcomingCount: 1,
      }),
    );
    expect(march11?.badges).toEqual([
      expect.objectContaining({
        group: 'YENA',
        kind: 'release',
      }),
    ]);
    expect(march12?.badges).toEqual([
      expect.objectContaining({
        group: 'P1Harmony',
        kind: 'scheduled',
      }),
    ]);
    expect(march7).toEqual(
      expect.objectContaining({
        isToday: true,
        badges: [],
      }),
    );
    expect(grid.selectedDay).toEqual(
      expect.objectContaining({
        isoDate: '2026-03-11',
        isEmpty: false,
      }),
    );
    expect(snapshot.monthOnlyUpcoming).toHaveLength(1);
    expect(grid.weeks.flat().some((cell) => cell?.badges.some((badge) => badge.group === 'LE SSERAFIM'))).toBe(
      false,
    );
  });

  test('caps visible badges at two and exposes overflow count', () => {
    const snapshot: CalendarMonthSnapshotModel = {
      month: '2026-03',
      releaseCount: 3,
      upcomingCount: 0,
      nearestUpcoming: null,
      releases: [
        createRelease('ALPHA', 'Alpha', '2026-03-08'),
        createRelease('BETA', 'Beta', '2026-03-08'),
        createRelease('GAMMA', 'Gamma', '2026-03-08'),
      ],
      exactUpcoming: [],
      monthOnlyUpcoming: [],
    };

    const grid = buildCalendarMonthGrid(snapshot, '2026-03-08', '2026-03-07');
    const march8 = grid.weeks.flat().find((cell) => cell?.isoDate === '2026-03-08');

    expect(march8?.badges).toHaveLength(2);
    expect(march8?.overflowCount).toBe(1);
  });

  test('carries badge image urls into visible badges when available', () => {
    const snapshot: CalendarMonthSnapshotModel = {
      month: '2026-03',
      releaseCount: 1,
      upcomingCount: 1,
      nearestUpcoming: null,
      releases: [
        createRelease('ALPHA', 'Alpha', '2026-03-08', {
          badgeImageUrl: 'https://example.com/alpha.png',
        }),
      ],
      exactUpcoming: [
        {
          id: 'beta-upcoming',
          group: 'BETA',
          displayGroup: 'Beta',
          badgeImageUrl: 'https://example.com/beta.png',
          scheduledDate: '2026-03-08',
          datePrecision: 'exact',
          headline: 'Beta comeback',
          sourceType: 'official_social',
        },
      ],
      monthOnlyUpcoming: [],
    };

    const grid = buildCalendarMonthGrid(snapshot, '2026-03-08', '2026-03-07');
    const march8 = grid.weeks.flat().find((cell) => cell?.isoDate === '2026-03-08');

    expect(march8?.badges).toEqual([
      expect.objectContaining({
        group: 'ALPHA',
        imageUrl: 'https://example.com/alpha.png',
      }),
      expect.objectContaining({
        group: 'BETA',
        imageUrl: 'https://example.com/beta.png',
      }),
    ]);
  });

  test('supports empty-day selection and month-safe fallback selection', () => {
    const snapshot = selectCalendarMonthSnapshot(
      cloneBundledDatasetFixture(),
      '2026-03',
      '2026-03-07',
    );

    const emptyDayGrid = buildCalendarMonthGrid(snapshot, '2026-03-13', '2026-03-07');
    expect(emptyDayGrid.selectedDay).toEqual(
      expect.objectContaining({
        isoDate: '2026-03-13',
        isEmpty: true,
      }),
    );

    const fallbackGrid = buildCalendarMonthGrid(snapshot, '2026-04-02', '2026-03-07');
    expect(fallbackGrid.selectedDay?.isoDate).toBe('2026-03-07');
  });
});

describe('calendar selection helpers', () => {
  test('uses today when the active month matches today', () => {
    expect(resolveInitialCalendarSelection('2026-03', '2026-03-07')).toBe('2026-03-07');
    expect(resolveInitialCalendarSelection('2026-04', '2026-03-07')).toBe('2026-04-01');
  });

  test('keeps selection safe when tapping out-of-month content', () => {
    expect(resolveNextCalendarSelection('2026-03-11', '2026-04-01', '2026-03')).toBe('2026-03-11');
    expect(resolveNextCalendarSelection('2026-03-11', '2026-03-12', '2026-03')).toBe('2026-03-12');
  });
});
