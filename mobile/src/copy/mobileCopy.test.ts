import {
  MOBILE_COPY,
  formatMonthOnlyDateLabel,
  formatUpcomingDateLabel,
  resolveSourceLinkLabel,
  resolveUpcomingConfidenceLabel,
  resolveUpcomingStatusLabel,
  resolveUpcomingStatusWithFallback,
} from './mobileCopy';

describe('mobileCopy helpers', () => {
  test('formats upcoming date labels with month-only fallback', () => {
    expect(
      formatUpcomingDateLabel({
        scheduledDate: '2026-03-11',
        scheduledMonth: '2026-03',
      }),
    ).toBe('2026-03-11');
    expect(
      formatUpcomingDateLabel({
        scheduledMonth: '2026-03',
      }),
    ).toBe('2026-03 · 날짜 미정');
    expect(formatMonthOnlyDateLabel()).toBe(MOBILE_COPY.date.unknown);
  });

  test('resolves normalized status, confidence, and source labels', () => {
    expect(resolveUpcomingStatusLabel('confirmed')).toBe(MOBILE_COPY.status.confirmed);
    expect(resolveUpcomingStatusWithFallback(undefined)).toBe(MOBILE_COPY.status.scheduled);
    expect(resolveUpcomingConfidenceLabel('medium')).toBe(MOBILE_COPY.confidence.medium);
    expect(resolveSourceLinkLabel('official_social')).toBe(MOBILE_COPY.source.officialNotice);
    expect(resolveSourceLinkLabel('news_rss')).toBe(MOBILE_COPY.source.articleOriginal);
    expect(resolveSourceLinkLabel('database')).toBe(MOBILE_COPY.source.sourceView);
  });
});
