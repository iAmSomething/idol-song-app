import type {
  ReleaseKind,
  ReleaseStream,
  UpcomingConfidence,
  UpcomingDatePrecision,
  UpcomingStatus,
  UpcomingSourceType,
} from '../types';

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeSearchToken(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[×]/g, 'x')
    .replace(/[_-]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildReleaseId(group: string, releaseTitle: string, releaseDate: string, stream: string): string {
  const parts = [group, releaseTitle, releaseDate, stream]
    .map((value) => normalizeSearchToken(value).replace(/\s+/g, '-'))
    .filter(Boolean);

  return parts.join('--');
}

export function buildMonogram(label: string): string {
  const tokens = collapseWhitespace(label)
    .split(' ')
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  if (tokens.length === 0) {
    return '?';
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0]!.toUpperCase())
    .join('');
}

export function normalizeReleaseKind(value?: string | null): ReleaseKind | string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = normalizeSearchToken(value).replace(/\s+/g, '-');
  const knownKinds: ReleaseKind[] = ['single', 'mini', 'album', 'ep', 'ost', 'collab'];

  return knownKinds.includes(normalized as ReleaseKind) ? (normalized as ReleaseKind) : value;
}

export function normalizeReleaseStream(value?: string | null): ReleaseStream {
  return value === 'song' ? 'song' : 'album';
}

export function normalizeUpcomingDatePrecision(value?: string | null): UpcomingDatePrecision {
  if (value === 'exact' || value === 'month_only' || value === 'unknown') {
    return value;
  }

  return 'unknown';
}

export function normalizeUpcomingStatus(value?: string | null): UpcomingStatus | undefined {
  if (value === 'scheduled' || value === 'confirmed' || value === 'rumor') {
    return value;
  }

  return undefined;
}

export function normalizeUpcomingSourceType(value?: string | null): UpcomingSourceType {
  if (
    value === 'agency_notice' ||
    value === 'weverse_notice' ||
    value === 'official_social' ||
    value === 'news_rss' ||
    value === 'database' ||
    value === 'pending'
  ) {
    return value;
  }

  return 'news_rss';
}

export function normalizeUpcomingConfidence(value?: number | string | null): UpcomingConfidence | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return undefined;
  }

  if (value >= 0.8) {
    return 'high';
  }

  if (value >= 0.5) {
    return 'medium';
  }

  return 'low';
}

export function compareIsoDateDescending(left?: string | null, right?: string | null): number {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;

  return rightTime - leftTime;
}

export function compareUpcomingDate(left: { scheduledDate?: string; scheduledMonth?: string; datePrecision: UpcomingDatePrecision }, right: { scheduledDate?: string; scheduledMonth?: string; datePrecision: UpcomingDatePrecision }): number {
  const precisionRank: Record<UpcomingDatePrecision, number> = {
    exact: 0,
    month_only: 1,
    unknown: 2,
  };

  if (precisionRank[left.datePrecision] !== precisionRank[right.datePrecision]) {
    return precisionRank[left.datePrecision] - precisionRank[right.datePrecision];
  }

  if (left.scheduledDate && right.scheduledDate) {
    return Date.parse(left.scheduledDate) - Date.parse(right.scheduledDate);
  }

  if (left.scheduledMonth && right.scheduledMonth) {
    return left.scheduledMonth.localeCompare(right.scheduledMonth);
  }

  return 0;
}
