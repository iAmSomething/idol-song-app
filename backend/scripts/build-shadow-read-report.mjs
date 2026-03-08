#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApp } from '../dist/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');
const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_shadow_read_report.json');
const PARITY_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_json_parity_report.json');

const ARTIST_PROFILES_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'artistProfiles.json');
const RELEASES_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'releases.json');
const RELEASE_HISTORY_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'releaseHistory.json');
const RELEASE_DETAILS_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'releaseDetails.json');
const RELEASE_ARTWORK_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'releaseArtwork.json');
const RELEASE_ENRICHMENT_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'releaseEnrichment.json');
const UPCOMING_CANDIDATES_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'upcomingCandidates.json');
const WATCHLIST_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'watchlist.json');
const YOUTUBE_ALLOWLISTS_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'youtubeChannelAllowlists.json');
const TEAM_BADGE_ASSETS_PATH = path.join(REPO_ROOT, 'web', 'src', 'data', 'teamBadgeAssets.json');

const RELEASE_ARTWORK_PLACEHOLDER_URL = '/release-placeholder.svg';
const LONG_GAP_THRESHOLD_DAYS = 365;
const ROOKIE_RECENT_YEAR_WINDOW = 2;
const WEEKLY_DIGEST_MAX_ITEMS = 8;
const UNIT_GROUPS = new Set(['ARTMS', 'NCT DREAM', 'NCT WISH', 'VIVIZ']);

const SEARCH_CASES = ['트리플에스', '투바투', '최예나', 'REVIVE+', '흰수염고래'];
const ENTITY_CASES = ['yena', 'blackpink', 'and-team', 'allday-project'];
const RELEASE_CASES = [
  { entitySlug: 'blackpink', title: 'DEADLINE', date: '2026-02-26', stream: 'album' },
  { entitySlug: 'ive', title: 'REVIVE+', date: '2026-02-23', stream: 'album' },
  { entitySlug: 'qwer', title: '흰수염고래', date: '2025-10-06', stream: 'song' },
];
const CALENDAR_CASES = ['2026-03', '2026-04', '2025-10'];

function parseArgs(argv) {
  const args = {
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report-path') {
      args.reportPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function optionalText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseSearchText(value) {
  return value.replace(/\s+/g, '');
}

function createSearchNeedle(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return null;
  }

  return {
    normalized,
    compact: collapseSearchText(normalized),
  };
}

function buildSearchIndex(values) {
  const normalizedTerms = new Set();
  const compactTerms = new Set();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = normalizeSearchText(value);
    if (!normalized) {
      continue;
    }

    normalizedTerms.add(normalized);
    compactTerms.add(collapseSearchText(normalized));
  }

  return {
    normalizedTerms: [...normalizedTerms],
    compactTerms: [...compactTerms],
  };
}

function matchesSearchIndex(index, needle) {
  if (!needle) {
    return true;
  }

  if (!index) {
    return false;
  }

  return (
    index.normalizedTerms.some((term) => term.includes(needle.normalized)) ||
    index.compactTerms.some((term) => term.includes(needle.compact))
  );
}

function findExactMatch(values, needle) {
  for (const value of values) {
    const normalized = normalizeSearchText(value);
    if (!normalized) {
      continue;
    }

    if (normalized === needle.normalized || collapseSearchText(normalized) === needle.compact) {
      return value;
    }
  }

  return null;
}

function findPartialMatch(values, needle) {
  for (const value of values) {
    const normalized = normalizeSearchText(value);
    if (!normalized) {
      continue;
    }

    if (normalized.includes(needle.normalized) || collapseSearchText(normalized).includes(needle.compact)) {
      return value;
    }
  }

  return null;
}

function getKstTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isExactDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

function isMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value ?? ''));
}

function parseDateValue(value) {
  if (!isExactDate(value)) {
    return -1;
  }
  return new Date(`${value}T00:00:00`).getTime();
}

function monthKeyToDate(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getDateDaysBefore(referenceDate, days) {
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() - days);
  return nextDate;
}

function getElapsedDaysSinceDate(value, todayIso) {
  if (!isExactDate(value)) {
    return 0;
  }
  const targetDate = new Date(`${value}T00:00:00`);
  const today = new Date(`${todayIso}T00:00:00`);
  return Math.max(0, Math.round((today.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function normalizeAgencyName(agency) {
  if (!agency) {
    return '';
  }

  const normalized = String(agency).trim().replace(/\s+/g, ' ');
  const canonicalMap = {
    'brand new music': 'Brand New Music',
    'c9 entertainment': 'C9 Entertainment',
    'cube entertainment': 'Cube Entertainment',
    'fnc entertainment': 'FNC Entertainment',
    glg: 'GLG',
    'hybe labels': 'HYBE Labels',
    'ist entertainment': 'IST Entertainment',
    'jellyfish entertainment': 'Jellyfish Entertainment',
    'jyp entertainment': 'JYP Entertainment',
    'kq entertainment': 'KQ Entertainment',
    modhaus: 'MODHAUS',
    rbw: 'RBW',
    's2 entertainment': 'S2 Entertainment',
    'sm entertainment': 'SM Entertainment',
    'starship entertainment': 'Starship Entertainment',
    vlast: 'VLAST',
    wakeone: 'WAKEONE',
    'wm entertainment': 'WM Entertainment',
    'woollim entertainment': 'Woollim Entertainment',
    'yg entertainment': 'YG Entertainment',
    'yuehua entertainment': 'Yuehua Entertainment',
  };

  return canonicalMap[normalized.toLowerCase()] ?? normalized;
}

function slugifyGroup(group) {
  return group
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugifyPathSegment(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[×✕]/g, 'x')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeReleaseStream(stream, releaseKind) {
  if (stream === 'album') {
    return 'album';
  }
  if (stream === 'song') {
    return 'song';
  }
  return releaseKind === 'album' || releaseKind === 'ep' ? 'album' : 'song';
}

function getReleaseLookupKey(group, releaseTitle, releaseDate, stream) {
  return [group, releaseTitle, releaseDate, stream].join('::');
}

function buildYouTubeMvCanonicalUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function buildYouTubeNoCookieEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

function extractYouTubeVideoId(value) {
  if (!value) {
    return '';
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace(/^\//, '');
    }

    const watchId = url.searchParams.get('v');
    if (watchId) {
      return watchId;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const embedIndex = segments.findIndex((segment) => segment === 'embed' || segment === 'shorts');
    if (embedIndex >= 0) {
      return segments[embedIndex + 1] ?? '';
    }
  } catch {
    return '';
  }

  return '';
}

function getReleaseDetailMvUrls(detail) {
  const videoId = extractYouTubeVideoId(detail.youtube_video_id) || extractYouTubeVideoId(detail.youtube_video_url);
  return {
    canonicalUrl: videoId ? buildYouTubeMvCanonicalUrl(videoId) : '',
    embedUrl: videoId ? buildYouTubeNoCookieEmbedUrl(videoId) : '',
    videoId,
  };
}

function getUpcomingDatePrecisionValue(item) {
  if (item.date_precision === 'exact' || item.date_precision === 'month_only' || item.date_precision === 'unknown') {
    return item.date_precision;
  }

  if (isExactDate(item.scheduled_date)) {
    return 'exact';
  }

  if (isMonthKey(item.scheduled_month)) {
    return 'month_only';
  }

  return 'unknown';
}

function hasExactUpcomingDate(item) {
  return getUpcomingDatePrecisionValue(item) === 'exact' && isExactDate(item.scheduled_date);
}

function getUpcomingMonthKey(item) {
  if (hasExactUpcomingDate(item)) {
    return item.scheduled_date.slice(0, 7);
  }
  if (getUpcomingDatePrecisionValue(item) === 'month_only' && isMonthKey(item.scheduled_month)) {
    return item.scheduled_month;
  }
  return '';
}

function getActType(group) {
  return UNIT_GROUPS.has(group) ? 'unit' : 'group';
}

function expandReleaseRow(row) {
  return ['latest_song', 'latest_album'].flatMap((key) => {
    const release = row[key];
    if (!release) {
      return [];
    }

    return [
      {
        ...release,
        group: row.group,
        artist_name_mb: row.artist_name_mb,
        artist_mbid: row.artist_mbid,
        artist_source: row.artist_source,
        actType: getActType(row.group),
        stream: key === 'latest_song' ? 'song' : 'album',
        dateValue: new Date(`${release.date}T00:00:00`),
        isoDate: release.date,
      },
    ];
  });
}

function buildSeededVerifiedReleaseHistory(rows) {
  return rows
    .flatMap((row) =>
      row.releases.map((release) => ({
        ...release,
        group: row.group,
        artist_name_mb: row.artist_name_mb,
        artist_mbid: row.artist_mbid,
        artist_source: row.artist_source,
        actType: getActType(row.group),
        dateValue: new Date(`${release.date}T00:00:00`),
        isoDate: release.date,
      })),
    )
    .sort((left, right) => {
      if (left.dateValue.getTime() !== right.dateValue.getTime()) {
        return right.dateValue.getTime() - left.dateValue.getTime();
      }

      if (left.stream !== right.stream) {
        return left.stream.localeCompare(right.stream);
      }

      return left.title.localeCompare(right.title);
    });
}

function buildVerifiedReleaseHistory(seedReleases, releaseDetailsCatalog, releaseCatalogByGroup, releaseCatalog, releaseCatalogByKey) {
  const historyByKey = new Map();

  for (const release of seedReleases) {
    historyByKey.set(getReleaseLookupKey(release.group, release.title, release.date, release.stream), release);
  }

  for (const detail of releaseDetailsCatalog) {
    const releaseRow = releaseCatalogByGroup.get(detail.group);
    const matchedRelease =
      releaseRow?.latest_song &&
      releaseRow.latest_song.title === detail.release_title &&
      releaseRow.latest_song.date === detail.release_date &&
      normalizeReleaseStream('song', releaseRow.latest_song.release_kind) === detail.stream
        ? releaseRow.latest_song
        : releaseRow?.latest_album &&
            releaseRow.latest_album.title === detail.release_title &&
            releaseRow.latest_album.date === detail.release_date &&
            normalizeReleaseStream('album', releaseRow.latest_album.release_kind) === detail.stream
          ? releaseRow.latest_album
          : null;

    historyByKey.set(getReleaseLookupKey(detail.group, detail.release_title, detail.release_date, detail.stream), {
      title: detail.release_title,
      date: detail.release_date,
      source: matchedRelease?.source ?? '',
      release_kind: detail.release_kind,
      release_format: matchedRelease?.release_format ?? detail.release_kind,
      context_tags: matchedRelease?.context_tags ?? [],
      music_handoffs: matchedRelease?.music_handoffs,
      group: detail.group,
      artist_name_mb: releaseRow?.artist_name_mb ?? detail.group,
      artist_mbid: releaseRow?.artist_mbid ?? '',
      artist_source: releaseRow?.artist_source ?? '',
      actType: getActType(detail.group),
      stream: detail.stream,
      dateValue: new Date(`${detail.release_date}T00:00:00`),
      isoDate: detail.release_date,
    });
  }

  for (const release of releaseCatalog) {
    const key = getReleaseLookupKey(release.group, release.title, release.date, release.stream);
    if (!historyByKey.has(key)) {
      historyByKey.set(key, release);
    }
  }

  return [...historyByKey.values()].sort((left, right) => {
    if (left.dateValue.getTime() !== right.dateValue.getTime()) {
      return right.dateValue.getTime() - left.dateValue.getTime();
    }

    if (left.stream !== right.stream) {
      return left.stream.localeCompare(right.stream);
    }

    return left.title.localeCompare(right.title);
  });
}

function groupReleasesByGroup(rows) {
  return rows.reduce((map, row) => {
    const bucket = map.get(row.group) ?? [];
    bucket.push(row);
    map.set(row.group, bucket);
    return map;
  }, new Map());
}

function groupUpcomingCandidatesByGroup(rows) {
  return rows.reduce((map, row) => {
    const bucket = map.get(row.group) ?? [];
    bucket.push(row);
    map.set(row.group, bucket);
    return map;
  }, new Map());
}

function stripUpcomingSourceSuffix(value) {
  return value.replace(/\s+-\s+[^-]+$/u, ' ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUpcomingGroupingText(value, group) {
  let normalized = stripUpcomingSourceSuffix(value)
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, ' and ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ');

  for (const token of group.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
    if (token.length < 2) {
      continue;
    }
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'g'), ' ');
  }

  return normalized
    .replace(
      /\b(?:comeback|comebacks|announce|announces|announced|announcing|return|returns|returning|release|releases|released|releasing|drop|drops|dropped|dropping|set|scheduled|schedule|showcase|notice|official|teaser|teasers|trailer|trailers|report|reports|ahead|after|with|their|first|new|album|mini|single|ep|tracklist|title|track|tour|global|hosts|hosted|concert|celebrate|chapter)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:a|an|the|and|for|of|to|in|on|at|this|that)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUpcomingReleaseLabel(item) {
  const text = `${item.headline} ${item.evidence_summary ?? ''}`;
  const patterns = [
    /(?:mini album|album|single|ep|title track|showcase(?:\s+for)?|trailer(?:\s+for)?|teaser(?:\s+for)?)\s*[“"'‘]?([^“”"'’]{2,80})[”"'’]/gi,
    /[“"'‘]([^“”"'’]{2,80})[”"'’]/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const normalized = normalizeUpcomingGroupingText(match[1] ?? '', item.group);
      if (normalized) {
        return normalized;
      }
    }
  }

  return '';
}

function getUpcomingEventDescriptor(item) {
  const releaseLabel = extractUpcomingReleaseLabel(item);
  if (releaseLabel) {
    return releaseLabel;
  }

  const headlineKey = normalizeUpcomingGroupingText(item.headline, item.group);
  if (headlineKey) {
    return headlineKey;
  }

  const summaryKey = normalizeUpcomingGroupingText(item.evidence_summary ?? '', item.group);
  return summaryKey || 'signal';
}

function getUpcomingStructuredMetadataScore(item) {
  let score = 0;
  if (item.release_format) {
    score += 2;
  }
  score += (item.context_tags ?? []).length;
  if (extractUpcomingReleaseLabel(item)) {
    score += 2;
  }
  if (item.evidence_summary) {
    score += 1;
  }
  return score;
}

function getUpcomingPublishedSortValue(item) {
  const timestamp = Date.parse(item.published_at);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getUpcomingSourceTier(sourceType) {
  const tiers = {
    agency_notice: 4,
    weverse_notice: 3,
    official_social: 2,
    news_rss: 1,
  };

  return tiers[sourceType] ?? 0;
}

function compareUpcomingRepresentativeRows(left, right) {
  const sourceCompare = getUpcomingSourceTier(right.source_type) - getUpcomingSourceTier(left.source_type);
  if (sourceCompare !== 0) {
    return sourceCompare;
  }

  const leftPrecision = getUpcomingDatePrecisionValue(left);
  const rightPrecision = getUpcomingDatePrecisionValue(right);
  const precisionRank = {
    exact: 0,
    month_only: 1,
    unknown: 2,
  };
  if (precisionRank[leftPrecision] !== precisionRank[rightPrecision]) {
    return precisionRank[leftPrecision] - precisionRank[rightPrecision];
  }

  const leftMonthKey = getUpcomingMonthKey(left);
  const rightMonthKey = getUpcomingMonthKey(right);
  if (leftMonthKey && rightMonthKey && leftMonthKey !== rightMonthKey) {
    return leftMonthKey.localeCompare(rightMonthKey);
  }

  const statusRank = {
    confirmed: 0,
    scheduled: 1,
    rumor: 2,
  };
  if (statusRank[left.date_status] !== statusRank[right.date_status]) {
    return statusRank[left.date_status] - statusRank[right.date_status];
  }

  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }

  const metadataCompare = getUpcomingStructuredMetadataScore(right) - getUpcomingStructuredMetadataScore(left);
  if (metadataCompare !== 0) {
    return metadataCompare;
  }

  const publishedCompare = getUpcomingPublishedSortValue(right) - getUpcomingPublishedSortValue(left);
  if (publishedCompare !== 0) {
    return publishedCompare;
  }

  return left.headline.localeCompare(right.headline);
}

function pickUpcomingRepresentative(rows) {
  return [...rows].sort(compareUpcomingRepresentativeRows)[0];
}

function pushUpcomingGroup(map, key, value) {
  const bucket = map.get(key) ?? [];
  bucket.push(value);
  map.set(key, bucket);
}

function selectBestUpcomingGroup(groups) {
  if (!groups?.length) {
    return null;
  }

  return [...groups].sort((left, right) => {
    const leftRepresentative = pickUpcomingRepresentative(left);
    const rightRepresentative = pickUpcomingRepresentative(right);
    return compareUpcomingRepresentativeRows(leftRepresentative, rightRepresentative);
  })[0];
}

function compareUpcomingSignals(left, right) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }

  const leftHasDate = hasExactUpcomingDate(left);
  const rightHasDate = hasExactUpcomingDate(right);
  const leftPrecision = getUpcomingDatePrecisionValue(left);
  const rightPrecision = getUpcomingDatePrecisionValue(right);
  const precisionRank = {
    exact: 0,
    month_only: 1,
    unknown: 2,
  };
  if (precisionRank[leftPrecision] !== precisionRank[rightPrecision]) {
    return precisionRank[leftPrecision] - precisionRank[rightPrecision];
  }
  if (leftHasDate && rightHasDate) {
    const dateCompare = parseDateValue(left.scheduled_date) - parseDateValue(right.scheduled_date);
    if (dateCompare !== 0) {
      return dateCompare;
    }
  } else if (leftHasDate !== rightHasDate) {
    return leftHasDate ? -1 : 1;
  }

  const leftMonthKey = getUpcomingMonthKey(left);
  const rightMonthKey = getUpcomingMonthKey(right);
  if (leftMonthKey && rightMonthKey && leftMonthKey !== rightMonthKey) {
    return leftMonthKey.localeCompare(rightMonthKey);
  }

  const statusRank = {
    confirmed: 0,
    scheduled: 1,
    rumor: 2,
  };
  if (statusRank[left.date_status] !== statusRank[right.date_status]) {
    return statusRank[left.date_status] - statusRank[right.date_status];
  }

  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }

  return left.headline.localeCompare(right.headline);
}

function buildUpcomingDisplayRow(rows) {
  const representative = pickUpcomingRepresentative(rows);
  const monthKey = getUpcomingMonthKey(representative) || 'undated';
  return {
    ...representative,
    event_key: [representative.group.toLowerCase(), representative.scheduled_date || monthKey, getUpcomingEventDescriptor(representative)].join(
      '::',
    ),
    evidence_count: rows.length,
    hidden_source_count: Math.max(rows.length - 1, 0),
  };
}

function dedupeUpcomingCandidateGroupsForDisplay(rows) {
  const exactGroups = new Map();
  const pendingGroups = new Map();

  for (const row of rows) {
    const descriptor = getUpcomingEventDescriptor(row);
    if (hasExactUpcomingDate(row)) {
      pushUpcomingGroup(exactGroups, [row.group.toLowerCase(), row.scheduled_date, descriptor].join('::'), row);
      continue;
    }

    const pendingMonthKey = getUpcomingMonthKey(row) || 'undated';
    pushUpcomingGroup(pendingGroups, [row.group.toLowerCase(), pendingMonthKey, descriptor].join('::'), row);
  }

  const exactGroupsByDate = new Map();
  for (const exactGroup of exactGroups.values()) {
    const bucketKey = [exactGroup[0].group.toLowerCase(), exactGroup[0].scheduled_date].join('::');
    pushUpcomingGroup(exactGroupsByDate, bucketKey, exactGroup);
  }

  const normalizedExactGroups = [];
  for (const dateBucket of exactGroupsByDate.values()) {
    const bucketRows = dateBucket.flat();
    const hasOfficialSource = bucketRows.some((item) => getUpcomingSourceTier(item.source_type) > getUpcomingSourceTier('news_rss'));
    if (hasOfficialSource) {
      normalizedExactGroups.push(bucketRows);
      continue;
    }
    normalizedExactGroups.push(...dateBucket);
  }

  const exactGroupsByTopic = new Map();
  const exactGroupsByMonth = new Map();
  for (const exactGroup of normalizedExactGroups) {
    const representative = pickUpcomingRepresentative(exactGroup);
    pushUpcomingGroup(exactGroupsByTopic, [representative.group.toLowerCase(), getUpcomingEventDescriptor(representative)].join('::'), exactGroup);

    const exactMonthKey = getUpcomingMonthKey(representative);
    if (exactMonthKey) {
      pushUpcomingGroup(exactGroupsByMonth, [representative.group.toLowerCase(), exactMonthKey].join('::'), exactGroup);
    }
  }

  const mergedGroups = [...normalizedExactGroups];
  for (const pendingGroup of pendingGroups.values()) {
    const representative = pickUpcomingRepresentative(pendingGroup);
    const topicMatch = selectBestUpcomingGroup(
      exactGroupsByTopic.get([representative.group.toLowerCase(), getUpcomingEventDescriptor(representative)].join('::')),
    );
    const monthKey = getUpcomingMonthKey(representative);
    const monthMatch =
      topicMatch || !monthKey
        ? null
        : selectBestUpcomingGroup(exactGroupsByMonth.get([representative.group.toLowerCase(), monthKey].join('::')));

    if (topicMatch ?? monthMatch) {
      (topicMatch ?? monthMatch).push(...pendingGroup);
      continue;
    }

    mergedGroups.push(pendingGroup);
  }

  return mergedGroups;
}

function dedupeUpcomingCandidatesForDisplay(rows) {
  return dedupeUpcomingCandidateGroupsForDisplay(rows).map(buildUpcomingDisplayRow).sort(compareUpcomingSignals);
}

function expandUpcomingCandidate(row) {
  if (!hasExactUpcomingDate(row)) {
    return [];
  }

  return [
    {
      ...row,
      dateValue: new Date(`${row.scheduled_date}T00:00:00`),
      isoDate: row.scheduled_date,
    },
  ];
}

function getSourceDomain(sourceUrl) {
  if (!sourceUrl) {
    return '';
  }

  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return '';
  }
}

function truncateTimelineSummary(value, maxLength = 180) {
  if (!value) {
    return '';
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function getSignalOccurredAt(item) {
  if (item.published_at && !Number.isNaN(Date.parse(item.published_at))) {
    return new Date(Date.parse(item.published_at)).toISOString();
  }

  return item.scheduled_date;
}

function getSourceTimelineSortValue(value) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return timestamp;
  }

  if (isExactDate(value)) {
    return new Date(`${value}T00:00:00`).getTime();
  }

  return Number.MAX_SAFE_INTEGER;
}

function getSourceTimelineSignalKey(item) {
  return [item.group, item.source_url, item.headline, item.published_at, item.scheduled_date, item.scheduled_month].join('::');
}

function getSourceTimelineItemKey(item) {
  return [item.event_type, item.headline, item.occurred_at, item.source_url].join('::');
}

function isOfficialAnnouncementSignal(item) {
  if (item.source_type === 'agency_notice' || item.source_type === 'weverse_notice') {
    return true;
  }

  return String(item.search_term ?? '').startsWith('official_');
}

function isTracklistRevealSignal(item) {
  const text = `${item.headline} ${item.evidence_summary ?? ''}`.toLowerCase();
  return /track\s*list|tracklist|title track/.test(text);
}

function findDateUpdateSignal(rows, usedSignalKeys) {
  const datedRows = rows.filter((item) => hasExactUpcomingDate(item));
  if (!datedRows.length) {
    return null;
  }

  for (let index = datedRows.length - 1; index >= 0; index -= 1) {
    const row = datedRows[index];
    if (usedSignalKeys.has(getSourceTimelineSignalKey(row))) {
      continue;
    }

    const previousDate = datedRows[index - 1]?.scheduled_date ?? '';
    if (!previousDate || previousDate !== row.scheduled_date || index === 0) {
      return row;
    }
  }

  return null;
}

function compareTimelineSignals(left, right) {
  const leftValue = getSourceTimelineSortValue(getSignalOccurredAt(left));
  const rightValue = getSourceTimelineSortValue(getSignalOccurredAt(right));
  if (leftValue !== rightValue) {
    return leftValue - rightValue;
  }

  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }

  return left.headline.localeCompare(right.headline);
}

function compareSourceTimelineItems(left, right) {
  if (left.sortValue !== right.sortValue) {
    return left.sortValue - right.sortValue;
  }

  return left.headline.localeCompare(right.headline);
}

function buildUpcomingTimelineSummary(item, eventType) {
  if (eventType === 'date_update' && item.scheduled_date) {
    return truncateTimelineSummary(
      item.evidence_summary || `The strongest captured date signal currently points to ${item.scheduled_date}.`,
    );
  }

  if (eventType === 'official_announcement') {
    return truncateTimelineSummary(
      item.evidence_summary || 'An official channel or agency notice confirmed the comeback context.',
    );
  }

  if (eventType === 'tracklist_reveal') {
    return truncateTimelineSummary(
      item.evidence_summary || 'A tracklist or title-track clue was captured for this comeback cycle.',
    );
  }

  if (eventType === 'first_signal') {
    return truncateTimelineSummary(item.evidence_summary || 'This was the earliest captured comeback signal.');
  }

  return truncateTimelineSummary(item.evidence_summary ?? '');
}

function buildUpcomingTimelineItem(group, item, eventType) {
  const occurredAt = getSignalOccurredAt(item);
  return {
    group,
    occurred_at: occurredAt,
    event_type: eventType,
    source_type: item.source_type || 'pending',
    headline: item.headline,
    source_url: item.source_url,
    summary: buildUpcomingTimelineSummary(item, eventType),
    source_domain: item.source_domain || getSourceDomain(item.source_url),
    sortValue: getSourceTimelineSortValue(occurredAt),
  };
}

function buildReleaseTimelineItem(group, release) {
  return {
    group,
    occurred_at: release.date,
    event_type: 'release_verified',
    source_type: 'release_catalog',
    headline: `${release.title}`,
    source_url: release.source,
    summary: truncateTimelineSummary(
      `Latest verified ${release.stream} record in the dataset for ${group}, captured from the release catalog.`,
    ),
    source_domain: getSourceDomain(release.source),
    sortValue: getSourceTimelineSortValue(release.date),
  };
}

function buildSourceTimeline(group, upcomingSignals, groupReleases) {
  const timelineItems = [];
  const usedSignalKeys = new Set();
  const timelineSignals = [...upcomingSignals].sort(compareTimelineSignals);
  const firstSignal = timelineSignals[0];

  if (firstSignal) {
    timelineItems.push(buildUpcomingTimelineItem(group, firstSignal, 'first_signal'));
    usedSignalKeys.add(getSourceTimelineSignalKey(firstSignal));
  }

  const officialAnnouncement = timelineSignals.find(
    (item) => !usedSignalKeys.has(getSourceTimelineSignalKey(item)) && isOfficialAnnouncementSignal(item),
  );
  if (officialAnnouncement) {
    timelineItems.push(buildUpcomingTimelineItem(group, officialAnnouncement, 'official_announcement'));
    usedSignalKeys.add(getSourceTimelineSignalKey(officialAnnouncement));
  }

  const tracklistReveal = timelineSignals.find(
    (item) => !usedSignalKeys.has(getSourceTimelineSignalKey(item)) && isTracklistRevealSignal(item),
  );
  if (tracklistReveal) {
    timelineItems.push(buildUpcomingTimelineItem(group, tracklistReveal, 'tracklist_reveal'));
    usedSignalKeys.add(getSourceTimelineSignalKey(tracklistReveal));
  }

  const dateUpdate = findDateUpdateSignal(timelineSignals, usedSignalKeys);
  if (dateUpdate) {
    timelineItems.push(buildUpcomingTimelineItem(group, dateUpdate, 'date_update'));
    usedSignalKeys.add(getSourceTimelineSignalKey(dateUpdate));
  }

  const latestVerifiedRelease = groupReleases[0];
  if (latestVerifiedRelease?.source) {
    timelineItems.push(buildReleaseTimelineItem(group, latestVerifiedRelease));
  }

  return timelineItems
    .sort(compareSourceTimelineItems)
    .filter((item, index, items) => {
      const previous = items[index - 1];
      return !previous || getSourceTimelineItemKey(previous) !== getSourceTimelineItemKey(item);
    });
}

function getTeamBadgeImageUrl(group, teamBadgeAssetByGroup, artistProfileByGroup) {
  return teamBadgeAssetByGroup.get(group)?.badge_image_url ?? artistProfileByGroup.get(group)?.representative_image_url ?? null;
}

function getPrimaryTeamYouTubeUrl(group, youtubeChannelAllowlistByGroup, artistProfileByGroup) {
  return youtubeChannelAllowlistByGroup.get(group)?.primary_team_channel_url ?? artistProfileByGroup.get(group)?.official_youtube_url ?? null;
}

function deriveLatestRelease(groupReleases, watchRow, releaseRow) {
  const latestVerified = groupReleases[0];
  if (latestVerified) {
    return {
      title: latestVerified.title,
      date: latestVerified.date,
      releaseKind: latestVerified.release_kind,
      releaseFormat: latestVerified.release_format,
      contextTags: latestVerified.context_tags,
      streamLabel: latestVerified.stream,
      stream: latestVerified.stream,
      source: latestVerified.source,
      artistSource: latestVerified.artist_source,
      musicHandoffs: latestVerified.music_handoffs,
      verified: true,
    };
  }

  if (!watchRow?.latest_release_title && !watchRow?.latest_release_date) {
    return null;
  }

  return {
    title: watchRow.latest_release_title || 'Tracked release pending',
    date: watchRow.latest_release_date || '',
    releaseKind: watchRow.latest_release_kind || 'unknown',
    releaseFormat:
      watchRow.latest_release_kind === 'single' ||
      watchRow.latest_release_kind === 'album' ||
      watchRow.latest_release_kind === 'ep'
        ? watchRow.latest_release_kind
        : '',
    contextTags: [],
    streamLabel: 'watchlist',
    stream: 'watchlist',
    source: '',
    artistSource: releaseRow?.artist_source ?? '',
    verified: false,
  };
}

function compareTeamProfiles(left, right) {
  const upcomingCompare = compareUpcomingSignals(left.nextUpcomingSignal, right.nextUpcomingSignal);
  if (upcomingCompare !== 0) {
    return upcomingCompare;
  }

  const leftDate = parseDateValue(left.latestRelease?.date);
  const rightDate = parseDateValue(right.latestRelease?.date);
  if (leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  return left.group.localeCompare(right.group);
}

function buildSearchIndexByGroup(artistProfiles, watchlist, releaseCatalog, upcomingCandidates, artistProfileByGroup, releaseCatalogByGroup, upcomingByGroup) {
  const groups = new Set([
    ...artistProfiles.map((row) => row.group),
    ...watchlist.map((row) => row.group),
    ...releaseCatalog.map((row) => row.group),
    ...upcomingCandidates.map((row) => row.group),
  ]);

  return new Map(
    [...groups].map((group) => {
      const artistProfile = artistProfileByGroup.get(group);
      const releaseRow = releaseCatalogByGroup.get(group);
      const upcomingSignals = upcomingByGroup.get(group) ?? [];

      return [
        group,
        buildSearchIndex([
          group,
          artistProfile?.slug,
          artistProfile?.display_name,
          ...(artistProfile?.aliases ?? []),
          ...(artistProfile?.search_aliases ?? []),
          releaseRow?.latest_song?.title,
          releaseRow?.latest_album?.title,
          ...upcomingSignals.map((item) => item.headline),
        ]),
      ];
    }),
  );
}

function getTeamRelatedRadarTags(group, artistProfileByGroup, watchlistByGroup) {
  const tags = new Set();
  const profile = artistProfileByGroup.get(group);
  const watchRow = watchlistByGroup.get(group);

  if (profile?.radar_tags?.includes('rookie')) {
    tags.add('rookie');
  }

  if (watchRow?.watch_reason === 'long_gap') {
    tags.add('long_gap');
  }

  if (watchRow?.watch_reason === 'manual_watch') {
    tags.add('manual_watch');
  }

  return tags;
}

function pickLatestRadarSignal(rows) {
  return [...rows].sort(compareLatestRadarSignals)[0] ?? null;
}

function compareLatestRadarSignals(left, right) {
  const leftOccurredAt = getSourceTimelineSortValue(getSignalOccurredAt(left));
  const rightOccurredAt = getSourceTimelineSortValue(getSignalOccurredAt(right));
  if (leftOccurredAt !== rightOccurredAt) {
    return rightOccurredAt - leftOccurredAt;
  }

  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }

  return compareUpcomingSignals(left, right);
}

function isRookieEligible(profile, todayYear) {
  if (profile.radar_tags?.includes('rookie')) {
    return true;
  }

  if (typeof profile.debut_year !== 'number') {
    return false;
  }

  const minimumYear = todayYear - (ROOKIE_RECENT_YEAR_WINDOW - 1);
  return profile.debut_year >= minimumYear && profile.debut_year <= todayYear;
}

function compareLongGapRadarEntries(left, right) {
  if (left.hasUpcomingSignal !== right.hasUpcomingSignal) {
    return left.hasUpcomingSignal ? -1 : 1;
  }

  const leftConfidence = left.latestSignal?.confidence ?? -1;
  const rightConfidence = right.latestSignal?.confidence ?? -1;
  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }

  const leftOccurredAt = left.latestSignal ? getSourceTimelineSortValue(getSignalOccurredAt(left.latestSignal)) : -1;
  const rightOccurredAt = right.latestSignal ? getSourceTimelineSortValue(getSignalOccurredAt(right.latestSignal)) : -1;
  if (leftOccurredAt !== rightOccurredAt) {
    return rightOccurredAt - leftOccurredAt;
  }

  if (left.gapDays !== right.gapDays) {
    return right.gapDays - left.gapDays;
  }

  return left.group.localeCompare(right.group);
}

function compareRookieRadarEntries(left, right) {
  if (left.hasUpcomingSignal !== right.hasUpcomingSignal) {
    return left.hasUpcomingSignal ? -1 : 1;
  }

  const leftReleaseDate = parseDateValue(left.latestRelease?.date);
  const rightReleaseDate = parseDateValue(right.latestRelease?.date);
  if (leftReleaseDate !== rightReleaseDate) {
    return rightReleaseDate - leftReleaseDate;
  }

  if ((left.debutYear ?? -1) !== (right.debutYear ?? -1)) {
    return (right.debutYear ?? -1) - (left.debutYear ?? -1);
  }

  return left.group.localeCompare(right.group);
}

function buildLongGapRadarEntries(teamProfiles, watchlistByGroup, todayIso) {
  return teamProfiles
    .flatMap((team) => {
      const watchRow = watchlistByGroup.get(team.group);
      if (!watchRow || watchRow.watch_reason !== 'long_gap') {
        return [];
      }

      if (!team.latestRelease?.date || !isExactDate(team.latestRelease.date)) {
        return [];
      }

      const gapDays = getElapsedDaysSinceDate(team.latestRelease.date, todayIso);
      if (gapDays < LONG_GAP_THRESHOLD_DAYS) {
        return [];
      }

      return [
        {
          group: team.group,
          watchReason: watchRow.watch_reason,
          latestRelease: team.latestRelease,
          gapDays,
          hasUpcomingSignal: team.upcomingSignals.length > 0,
          latestSignal: pickLatestRadarSignal(team.upcomingSignals),
        },
      ];
    })
    .sort(compareLongGapRadarEntries);
}

function buildRookieRadarEntries(teamProfiles, artistProfileByGroup, todayYear) {
  return teamProfiles
    .flatMap((team) => {
      const artistProfile = artistProfileByGroup.get(team.group);
      if (!artistProfile || !isRookieEligible(artistProfile, todayYear)) {
        return [];
      }

      return [
        {
          group: team.group,
          debutYear: artistProfile.debut_year ?? null,
          latestRelease: team.latestRelease,
          hasUpcomingSignal: team.upcomingSignals.length > 0,
          latestSignal: pickLatestRadarSignal(team.upcomingSignals),
        },
      ];
    })
    .sort(compareRookieRadarEntries);
}

function getWeeklyDigestDiversityScore(candidate, selected) {
  const seenFormats = new Set(selected.map((item) => item.release_format));
  const seenContextTags = new Set(selected.flatMap((item) => item.context_tags));
  let score = seenFormats.has(candidate.release_format) ? 0 : 4;

  for (const contextTag of candidate.context_tags) {
    if (!seenContextTags.has(contextTag)) {
      score += 1;
    }
  }

  return score;
}

function compareWeeklyDigestCandidates(left, right, selected) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return right.dateValue.getTime() - left.dateValue.getTime();
  }

  const diversityCompare = getWeeklyDigestDiversityScore(right, selected) - getWeeklyDigestDiversityScore(left, selected);
  if (diversityCompare !== 0) {
    return diversityCompare;
  }

  if (left.context_tags.length !== right.context_tags.length) {
    return right.context_tags.length - left.context_tags.length;
  }

  if (left.release_format !== right.release_format) {
    return left.release_format.localeCompare(right.release_format);
  }

  const groupCompare = left.group.localeCompare(right.group);
  if (groupCompare !== 0) {
    return groupCompare;
  }

  return left.title.localeCompare(right.title);
}

function buildWeeklyDigestRows(rows, maxItems) {
  const groupedByDate = rows.reduce((map, row) => {
    const bucket = map.get(row.isoDate) ?? [];
    bucket.push(row);
    map.set(row.isoDate, bucket);
    return map;
  }, new Map());

  const selected = [];
  const sortedDates = [...groupedByDate.keys()].sort((left, right) => parseDateValue(right) - parseDateValue(left));

  for (const isoDate of sortedDates) {
    const remaining = [...(groupedByDate.get(isoDate) ?? [])];
    while (remaining.length && selected.length < maxItems) {
      remaining.sort((left, right) => compareWeeklyDigestCandidates(left, right, selected));
      selected.push(remaining.shift());
    }

    if (selected.length >= maxItems) {
      break;
    }
  }

  return selected;
}

function compareMonthlyDashboardVerified(left, right) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return left.dateValue.getTime() - right.dateValue.getTime();
  }

  return left.group.localeCompare(right.group);
}

function compareMonthlyDashboardUpcoming(left, right) {
  if (left.dateValue.getTime() !== right.dateValue.getTime()) {
    return left.dateValue.getTime() - right.dateValue.getTime();
  }

  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }

  return left.group.localeCompare(right.group);
}

function groupByDate(rows) {
  return rows.reduce((map, row) => {
    const bucket = map.get(row.isoDate) ?? [];
    bucket.push(row);
    map.set(row.isoDate, bucket);
    return map;
  }, new Map());
}

function groupUpcomingByDate(rows) {
  return rows.reduce((map, row) => {
    const bucket = map.get(row.isoDate) ?? [];
    bucket.push(row);
    map.set(row.isoDate, bucket);
    return map;
  }, new Map());
}

function buildCalendarDays(date, todayIso) {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const leadingDays = startOfMonth.getDay();
  const trailingDays = 6 - endOfMonth.getDay();
  const gridStart = new Date(startOfMonth);
  const gridEnd = new Date(endOfMonth);
  gridStart.setDate(startOfMonth.getDate() - leadingDays);
  gridEnd.setDate(endOfMonth.getDate() + trailingDays);

  const days = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const iso = getKstTodayIso(cursor);
    days.push({
      date: new Date(cursor),
      iso,
      inMonth: cursor.getMonth() === date.getMonth(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function compareEntityMatches(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftUpcoming = left.next_upcoming?.scheduled_date ?? left.next_upcoming?.scheduled_month ?? '';
  const rightUpcoming = right.next_upcoming?.scheduled_date ?? right.next_upcoming?.scheduled_month ?? '';
  if (leftUpcoming !== rightUpcoming) {
    if (!leftUpcoming) {
      return 1;
    }
    if (!rightUpcoming) {
      return -1;
    }
    return leftUpcoming.localeCompare(rightUpcoming);
  }

  const leftRelease = left.latest_release?.release_date ?? '';
  const rightRelease = right.latest_release?.release_date ?? '';
  if (leftRelease !== rightRelease) {
    return rightRelease.localeCompare(leftRelease);
  }

  return left.display_name.localeCompare(right.display_name);
}

function compareReleaseMatches(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.release_date !== right.release_date) {
    return right.release_date.localeCompare(left.release_date);
  }

  return left.release_title.localeCompare(right.release_title);
}

function compareUpcomingMatches(left, right) {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const leftDate = left.scheduled_date ?? left.scheduled_month ?? '';
  const rightDate = right.scheduled_date ?? right.scheduled_month ?? '';
  if (leftDate !== rightDate) {
    if (!leftDate) {
      return 1;
    }
    if (!rightDate) {
      return -1;
    }
    return leftDate.localeCompare(rightDate);
  }

  return left.display_name.localeCompare(right.display_name);
}

function getReleaseArtwork(group, releaseTitle, releaseDate, stream, releaseKind, releaseArtworkByKey) {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind);
  const artwork = releaseArtworkByKey.get(getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream));
  if (!artwork) {
    return {
      group,
      release_title: releaseTitle,
      release_date: releaseDate,
      stream: normalizedStream,
      cover_image_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
      thumbnail_image_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
      artwork_source_type: 'placeholder',
      artwork_source_url: RELEASE_ARTWORK_PLACEHOLDER_URL,
      isPlaceholder: true,
    };
  }

  return {
    ...artwork,
    isPlaceholder: artwork.artwork_source_type === 'placeholder',
  };
}

function getReleaseDetail(group, releaseTitle, releaseDate, stream, releaseKind, releaseDetailsByKey) {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind);
  const detail = releaseDetailsByKey.get(getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream));
  if (!detail) {
    return {
      group,
      release_title: releaseTitle,
      release_date: releaseDate,
      stream: normalizedStream,
      release_kind: releaseKind === 'album' || releaseKind === 'ep' ? releaseKind : 'single',
      detail_status: 'unresolved',
      detail_provenance: 'releaseDetails.missing_row',
      title_track_status: 'unresolved',
      title_track_provenance: 'releaseDetails.missing_row',
      tracks: [],
      spotify_url: null,
      youtube_music_url: null,
      youtube_video_id: null,
      youtube_video_url: null,
      youtube_video_status: null,
      youtube_video_provenance: null,
      notes: '',
      isFallback: true,
    };
  }

  return {
    ...detail,
    isFallback: false,
  };
}

function getReleaseEnrichment(group, releaseTitle, releaseDate, stream, releaseKind, releaseEnrichmentByKey) {
  const normalizedStream = normalizeReleaseStream(stream, releaseKind);
  const enrichment = releaseEnrichmentByKey.get(getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream));
  if (!enrichment) {
    return {
      group,
      release_title: releaseTitle,
      release_date: releaseDate,
      stream: normalizedStream,
      credits: {
        lyrics: [],
        composition: [],
        arrangement: [],
      },
      charts: [],
      notes: '',
      isFallback: true,
    };
  }

  return {
    ...enrichment,
    isFallback: false,
  };
}

function createBaselineState(now = new Date()) {
  const artistProfiles = loadJson(ARTIST_PROFILES_PATH);
  const releaseCatalogRaw = loadJson(RELEASES_PATH);
  const releaseHistoryRows = loadJson(RELEASE_HISTORY_PATH);
  const releaseDetailsCatalog = loadJson(RELEASE_DETAILS_PATH);
  const releaseArtworkCatalog = loadJson(RELEASE_ARTWORK_PATH);
  const releaseEnrichmentCatalog = loadJson(RELEASE_ENRICHMENT_PATH);
  const upcomingCandidates = loadJson(UPCOMING_CANDIDATES_PATH);
  const watchlist = loadJson(WATCHLIST_PATH);
  const youtubeChannelAllowlists = loadJson(YOUTUBE_ALLOWLISTS_PATH);
  const teamBadgeAssets = loadJson(TEAM_BADGE_ASSETS_PATH);

  const todayIso = getKstTodayIso(now);
  const todayYear = Number.parseInt(todayIso.slice(0, 4), 10);
  const releaseCatalog = releaseCatalogRaw.flatMap((row) => expandReleaseRow(row)).sort((left, right) => right.dateValue.getTime() - left.dateValue.getTime());

  const artistProfileByGroup = new Map(artistProfiles.map((row) => [row.group, row]));
  const artistProfileBySlug = new Map(artistProfiles.map((row) => [row.slug, row]));
  const releaseCatalogByGroup = new Map(releaseCatalogRaw.map((row) => [row.group, row]));
  const watchlistByGroup = new Map(watchlist.map((row) => [row.group, row]));
  const youtubeChannelAllowlistByGroup = new Map(youtubeChannelAllowlists.map((row) => [row.group, row]));
  const teamBadgeAssetByGroup = new Map(teamBadgeAssets.map((row) => [row.group, row]));
  const releaseArtworkByKey = new Map(
    releaseArtworkCatalog.map((row) => [getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );
  const releaseDetailsByKey = new Map(
    releaseDetailsCatalog.map((row) => [getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );
  const releaseEnrichmentByKey = new Map(
    releaseEnrichmentCatalog.map((row) => [getReleaseLookupKey(row.group, row.release_title, row.release_date, row.stream), row]),
  );

  const seededVerifiedReleaseHistory = buildSeededVerifiedReleaseHistory(releaseHistoryRows);
  const verifiedReleaseHistory = buildVerifiedReleaseHistory(
    seededVerifiedReleaseHistory,
    releaseDetailsCatalog,
    releaseCatalogByGroup,
    releaseCatalog,
  );
  const verifiedReleaseHistoryByGroup = groupReleasesByGroup(verifiedReleaseHistory);

  const dedupedUpcomingCandidates = dedupeUpcomingCandidatesForDisplay(upcomingCandidates);
  const rawUpcomingByGroup = groupUpcomingCandidatesByGroup(upcomingCandidates);
  const upcomingByGroup = groupUpcomingCandidatesByGroup(dedupedUpcomingCandidates);

  const searchIndexByGroup = buildSearchIndexByGroup(
    artistProfiles,
    watchlist,
    releaseCatalogRaw,
    upcomingCandidates,
    artistProfileByGroup,
    releaseCatalogByGroup,
    upcomingByGroup,
  );

  const releaseGroups = groupReleasesByGroup(releaseCatalog);

  const teamProfiles = [...new Set([
    ...watchlist.map((row) => row.group),
    ...releaseCatalog.map((row) => row.group),
    ...upcomingCandidates.map((row) => row.group),
  ])]
    .map((group) => {
      const watchRow = watchlistByGroup.get(group);
      const releaseRow = releaseCatalogByGroup.get(group);
      const artistProfile = artistProfileByGroup.get(group);
      const groupReleases = releaseGroups.get(group) ?? [];
      const verifiedHistory = verifiedReleaseHistoryByGroup.get(group) ?? [];
      const upcomingSignals = [...(upcomingByGroup.get(group) ?? [])].sort(compareUpcomingSignals);
      const sourceTimeline = buildSourceTimeline(group, rawUpcomingByGroup.get(group) ?? [], groupReleases);
      const latestRelease = deriveLatestRelease(groupReleases, watchRow, releaseRow);

      return {
        group,
        slug: artistProfile?.slug ?? slugifyGroup(group),
        displayName: artistProfile?.display_name ?? group,
        tier: watchRow?.tier ?? 'tracked',
        trackingStatus: watchRow?.tracking_status ?? 'watch_only',
        watchReason: watchRow?.watch_reason ?? null,
        artistSource: releaseRow?.artist_source ?? latestRelease?.artistSource ?? '',
        xUrl: artistProfile?.official_x_url ?? watchRow?.x_url ?? '',
        instagramUrl: artistProfile?.official_instagram_url ?? watchRow?.instagram_url ?? '',
        youtubeUrl: getPrimaryTeamYouTubeUrl(group, youtubeChannelAllowlistByGroup, artistProfileByGroup),
        agency: normalizeAgencyName(artistProfile?.agency),
        badgeImageUrl: getTeamBadgeImageUrl(group, teamBadgeAssetByGroup, artistProfileByGroup),
        representativeImageUrl: artistProfile?.representative_image_url ?? null,
        latestRelease,
        recentAlbums: verifiedHistory.filter((item) => item.stream === 'album'),
        upcomingSignals,
        sourceTimeline,
        nextUpcomingSignal: upcomingSignals[0] ?? null,
      };
    })
    .sort(compareTeamProfiles);

  const teamProfileMap = new Map(teamProfiles.map((team) => [team.group, team]));
  const longGapRadarEntries = buildLongGapRadarEntries(teamProfiles, watchlistByGroup, todayIso);
  const rookieRadarEntries = buildRookieRadarEntries(teamProfiles, artistProfileByGroup, todayYear);

  const filteredReleases = releaseCatalog;
  const filteredUpcoming = dedupedUpcomingCandidates;
  const filteredUpcomingSignals = filteredUpcoming
    .flatMap((item) => expandUpcomingCandidate(item))
    .sort((left, right) => left.dateValue.getTime() - right.dateValue.getTime());
  const nearestUpcomingJumpSignal = filteredUpcomingSignals.find((item) => item.isoDate >= todayIso) ?? null;
  const weeklyDigestReferenceDate = filteredReleases[0]?.dateValue ?? null;
  const weeklyDigestWindowStart = weeklyDigestReferenceDate ? getDateDaysBefore(weeklyDigestReferenceDate, 6) : null;
  const weeklyDigestRows =
    weeklyDigestReferenceDate && weeklyDigestWindowStart
      ? buildWeeklyDigestRows(
          filteredReleases.filter((item) => {
            const time = item.dateValue.getTime();
            return time >= weeklyDigestWindowStart.getTime() && time <= weeklyDigestReferenceDate.getTime();
          }),
          WEEKLY_DIGEST_MAX_ITEMS,
        )
      : [];

  return {
    now,
    todayIso,
    todayYear,
    artistProfiles,
    artistProfileByGroup,
    artistProfileBySlug,
    releaseCatalogRaw,
    releaseCatalog,
    releaseCatalogByGroup,
    releaseHistoryRows,
    releaseDetailsCatalog,
    releaseDetailsByKey,
    releaseArtworkByKey,
    releaseEnrichmentByKey,
    watchlistByGroup,
    youtubeChannelAllowlistByGroup,
    verifiedReleaseHistory,
    verifiedReleaseHistoryByGroup,
    releaseGroups,
    upcomingCandidates,
    dedupedUpcomingCandidates,
    rawUpcomingByGroup,
    upcomingByGroup,
    searchIndexByGroup,
    teamProfiles,
    teamProfileMap,
    longGapRadarEntries,
    rookieRadarEntries,
    filteredReleases,
    filteredUpcoming,
    filteredUpcomingSignals,
    nearestUpcomingJumpSignal,
    weeklyDigestRows,
  };
}

function buildEntityLatestReleaseSummary(team) {
  if (!team.latestRelease) {
    return null;
  }

  return {
    release_title: team.latestRelease.title,
    release_date: team.latestRelease.date || null,
    stream: team.latestRelease.stream,
    release_kind: team.latestRelease.releaseKind || null,
  };
}

function getSearchLatestReleaseCandidate(team, verifiedReleaseHistoryByGroup) {
  const verifiedRelease = verifiedReleaseHistoryByGroup.get(team.group)?.[0];
  if (verifiedRelease) {
    return {
      title: verifiedRelease.title,
      date: verifiedRelease.date,
      stream: verifiedRelease.stream,
      releaseKind: verifiedRelease.release_kind ?? null,
      releaseFormat: verifiedRelease.release_format ?? null,
      verified: true,
    };
  }

  if (!team.latestRelease) {
    return null;
  }

  return {
    title: team.latestRelease.title,
    date: team.latestRelease.date || null,
    stream: team.latestRelease.stream,
    releaseKind: team.latestRelease.releaseKind || null,
    releaseFormat: team.latestRelease.releaseFormat ?? null,
    verified: team.latestRelease.verified === true,
  };
}

function buildEntityNextUpcomingSummary(team) {
  const next = team.nextUpcomingSignal;
  if (!next) {
    return null;
  }

  return {
    headline: next.headline,
    scheduled_date: next.scheduled_date ?? null,
    scheduled_month: next.scheduled_month || (next.scheduled_date ? next.scheduled_date.slice(0, 7) : null),
    date_precision: getUpcomingDatePrecisionValue(next),
    date_status: next.date_status,
    confidence_score: next.confidence ?? null,
    release_format: next.release_format ?? null,
  };
}

function buildEntityDetailNextUpcomingSummary(team) {
  const next = team.nextUpcomingSignal;
  if (!next) {
    return null;
  }

  return {
    upcoming_signal_id: next.event_key ?? `${team.slug}::${next.scheduled_date ?? next.scheduled_month ?? 'undated'}::${next.headline}`,
    headline: next.headline,
    scheduled_date: next.scheduled_date ?? null,
    scheduled_month: next.scheduled_month || (next.scheduled_date ? next.scheduled_date.slice(0, 7) : null),
    date_precision: getUpcomingDatePrecisionValue(next),
    date_status: next.date_status,
    release_format: next.release_format ?? null,
    confidence_score: next.confidence ?? null,
    latest_seen_at: next.published_at ?? null,
    source_type: next.source_type ?? null,
    source_url: next.source_url ?? null,
    source_domain: next.source_domain ?? (getSourceDomain(next.source_url) || null),
    evidence_summary: next.evidence_summary ?? null,
    source_count: next.evidence_count ?? 1,
  };
}

function buildEntityReleaseCardSummary(group, releaseTitle, releaseDate, stream, releaseKind, releaseFormat, releaseArtworkByKey) {
  if (!releaseTitle || !releaseDate || !stream) {
    return null;
  }

  const normalizedStream = normalizeReleaseStream(stream, releaseKind);
  const artwork =
    releaseArtworkByKey.get(getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream)) ?? null;

  return {
    release_id: getReleaseLookupKey(group, releaseTitle, releaseDate, normalizedStream),
    release_title: releaseTitle,
    release_date: releaseDate,
    stream: normalizedStream,
    release_kind: releaseKind ?? null,
    release_format: releaseFormat ?? null,
    artwork: artwork
      ? {
          cover_image_url: artwork.cover_image_url ?? null,
          thumbnail_image_url: artwork.thumbnail_image_url ?? null,
          artwork_source_type: artwork.artwork_source_type ?? null,
          artwork_source_url: artwork.artwork_source_url ?? null,
          is_placeholder: artwork.artwork_source_type === 'placeholder',
        }
      : null,
  };
}

function buildEntitySourceTimelineItem(item) {
  return {
    event_type: item.event_type,
    headline: item.headline,
    occurred_at: item.occurred_at,
    summary: item.summary ?? null,
    source_url: item.source_url ?? null,
    source_type: item.source_type ?? null,
    source_domain: item.source_domain ?? null,
    published_at: item.occurred_at,
    scheduled_date: null,
    scheduled_month: null,
    date_precision: null,
    date_status: null,
    release_format: null,
    confidence_score: null,
    evidence_summary: null,
    source_count: null,
  };
}

function compareEntityReleaseRows(left, right) {
  if (left.date !== right.date) {
    return right.date.localeCompare(left.date);
  }
  if (left.stream !== right.stream) {
    return left.stream === 'album' ? -1 : 1;
  }
  return left.title.localeCompare(right.title);
}

function compareEntityUpcomingRows(left, right) {
  const leftDate = left.scheduled_date ?? '';
  const rightDate = right.scheduled_date ?? '';
  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }
  if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
    return (right.confidence ?? 0) - (left.confidence ?? 0);
  }
  if ((left.published_at ?? '') !== (right.published_at ?? '')) {
    return (right.published_at ?? '').localeCompare(left.published_at ?? '');
  }
  return left.headline.localeCompare(right.headline);
}

function normalizeOptionalText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getComparablePublishedAt(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function buildEntityDetailNextUpcomingExpected(group, state) {
  const candidates = (state.upcomingByGroup.get(group) ?? [])
    .filter((item) => getUpcomingDatePrecisionValue(item) === 'exact' && (item.scheduled_date ?? '') >= state.todayIso)
    .sort(compareEntityUpcomingRows);
  const next = candidates[0];

  if (!next) {
    return null;
  }

  return {
    upcoming_signal_id: next.event_key ?? `${group.toLowerCase()}::${next.scheduled_date ?? next.scheduled_month ?? 'undated'}::${next.headline}`,
    headline: next.headline,
    scheduled_date: normalizeOptionalText(next.scheduled_date),
    scheduled_month:
      normalizeOptionalText(next.scheduled_month) ||
      (normalizeOptionalText(next.scheduled_date) ? next.scheduled_date.slice(0, 7) : null),
    date_precision: getUpcomingDatePrecisionValue(next),
    date_status: next.date_status,
    release_format: next.release_format ?? null,
    confidence_score: next.confidence ?? null,
    latest_seen_at: normalizeOptionalText(next.published_at),
    source_type: normalizeOptionalText(next.source_type),
    source_url: normalizeOptionalText(next.source_url),
    source_domain: normalizeOptionalText(next.source_domain) ?? (getSourceDomain(next.source_url) || null),
    evidence_summary: normalizeOptionalText(next.evidence_summary),
    source_count: next.evidence_count ?? 1,
  };
}

function buildEntityDetailLatestReleaseExpected(group, state) {
  const latest = [...(state.verifiedReleaseHistoryByGroup.get(group) ?? [])].sort(compareEntityReleaseRows)[0];
  if (!latest) {
    return null;
  }

  return buildEntityReleaseCardSummary(
    group,
    latest.title,
    latest.date,
    latest.stream,
    latest.release_kind ?? null,
    latest.release_format ?? null,
    state.releaseArtworkByKey,
  );
}

function buildEntityDetailRecentAlbumsExpected(group, state) {
  return [...(state.verifiedReleaseHistoryByGroup.get(group) ?? [])]
    .filter((item) => item.stream === 'album')
    .sort(compareEntityReleaseRows)
    .slice(0, 12)
    .map((item) =>
      buildEntityReleaseCardSummary(
        group,
        item.title,
        item.date,
        item.stream,
        item.release_kind ?? null,
        item.release_format ?? null,
        state.releaseArtworkByKey,
      ),
    )
    .filter((item) => item !== null);
}

function inferEntityDetailTimelineEventType(item) {
  const headline = (item.headline ?? '').toLowerCase();

  if (headline.includes('tracklist')) {
    return 'tracklist_reveal';
  }
  if (item.scheduled_date) {
    return item.date_status === 'confirmed' ? 'official_announcement' : 'date_update';
  }
  if (item.scheduled_month) {
    return 'date_update';
  }
  return 'first_signal';
}

function buildEntityDetailTimelineSummary(item) {
  return [item.release_format ?? null, item.date_status ?? null, item.scheduled_date ?? item.scheduled_month ?? null]
    .filter((part) => Boolean(part))
    .join(' · ') || null;
}

function buildEntityDetailSourceTimelineExpected(group, state) {
  return dedupeUpcomingCandidateGroupsForDisplay(state.rawUpcomingByGroup.get(group) ?? [])
    .flatMap((rows) => {
      const representative = pickUpcomingRepresentative(rows);
      const scheduledDate = normalizeOptionalText(representative.scheduled_date);
      const scheduledMonth =
        normalizeOptionalText(representative.scheduled_month) || (scheduledDate ? scheduledDate.slice(0, 7) : null);

      return rows.map((item) => ({
        event_type: inferEntityDetailTimelineEventType(representative),
        headline: representative.headline,
        occurred_at: normalizeOptionalText(item.published_at) ?? '',
        summary: buildEntityDetailTimelineSummary({
          ...representative,
          scheduled_date: scheduledDate,
          scheduled_month: scheduledMonth,
        }),
        source_url: normalizeOptionalText(item.source_url),
        source_type: normalizeOptionalText(item.source_type),
        source_domain: normalizeOptionalText(item.source_domain) ?? (getSourceDomain(item.source_url) || null),
        published_at: normalizeOptionalText(item.published_at) ?? '',
        scheduled_date: scheduledDate,
        scheduled_month: scheduledMonth,
        date_precision: getUpcomingDatePrecisionValue(representative),
        date_status: representative.date_status,
        release_format: representative.release_format ?? null,
        confidence_score: representative.confidence ?? null,
        evidence_summary: normalizeOptionalText(item.evidence_summary),
        source_count: rows.length,
      }));
    })
    .sort((left, right) => {
      const leftOccurredAt = getComparablePublishedAt(left.published_at);
      const rightOccurredAt = getComparablePublishedAt(right.published_at);
      if (leftOccurredAt !== rightOccurredAt) {
        return rightOccurredAt - leftOccurredAt;
      }
      if ((left.headline ?? '') !== (right.headline ?? '')) {
        return (left.headline ?? '').localeCompare(right.headline ?? '');
      }
      return (left.source_url ?? '').localeCompare(right.source_url ?? '');
    })
    .slice(0, 12)
    .map((item) => item);
}

function buildSearchExpected(query, state, limit = 8) {
  const needle = createSearchNeedle(query);
  if (!needle) {
    return { entities: [], releases: [], upcoming: [] };
  }

  const entityMatches = state.teamProfiles
    .filter((team) => matchesSearchIndex(state.searchIndexByGroup.get(team.group), needle))
    .map((team) => {
      const profile = state.artistProfileByGroup.get(team.group);
      const primaryNames = [team.displayName, team.group, team.slug];
      const nonPrimaryAliases = [...new Set([...(profile?.aliases ?? []), ...(profile?.search_aliases ?? [])])].filter(
        (alias) => !primaryNames.includes(alias),
      );
      const exactPrimary = findExactMatch(primaryNames, needle);
      const exactAlias = findExactMatch(nonPrimaryAliases, needle);
      const partialAlias = findPartialMatch(nonPrimaryAliases, needle);

      let matchReason = 'partial';
      let matchedAlias = null;
      let score = 100;

      if (exactPrimary) {
        matchReason = 'display_name_exact';
        matchedAlias = exactPrimary;
        score = 400;
      } else if (exactAlias) {
        matchReason = 'alias_exact';
        matchedAlias = exactAlias;
        score = 300;
      } else if (partialAlias) {
        matchReason = 'alias_partial';
        matchedAlias = partialAlias;
        score = 200;
      }

      return {
        entity_slug: team.slug,
        display_name: team.displayName,
        canonical_name: team.group,
        agency_name: team.agency || null,
        match_reason: matchReason,
        matched_alias: matchedAlias,
        latest_release: (() => {
          const latestRelease = getSearchLatestReleaseCandidate(team, state.verifiedReleaseHistoryByGroup);
          if (!latestRelease) {
            return null;
          }

          return {
            release_title: latestRelease.title,
            release_date: latestRelease.date,
            stream: latestRelease.stream,
            release_kind: latestRelease.releaseKind,
          };
        })(),
        next_upcoming: buildEntityNextUpcomingSummary(team),
        score,
      };
    })
    .sort(compareEntityMatches);
  const entityMatchSlugs = new Set(entityMatches.map((item) => item.entity_slug));

  const releaseMatchMap = new Map();
  const contextEntitySlugs = new Set();
  for (const row of state.verifiedReleaseHistory) {
    const normalizedTitle = normalizeSearchText(row.title);
    if (
      !normalizedTitle.includes(needle.normalized) &&
      !collapseSearchText(normalizedTitle).includes(needle.compact)
    ) {
      continue;
    }

    const isExact = normalizedTitle === needle.normalized || collapseSearchText(normalizedTitle) === needle.compact;
    const key = getReleaseLookupKey(row.group, row.title, row.date, row.stream);
    const entitySlug = state.artistProfileByGroup.get(row.group)?.slug ?? slugifyGroup(row.group);

    if (isExact && !entityMatchSlugs.has(entitySlug)) {
      contextEntitySlugs.add(entitySlug);
    }

    releaseMatchMap.set(key, {
      entity_slug: entitySlug,
      display_name: state.artistProfileByGroup.get(row.group)?.display_name ?? row.group,
      release_title: row.title,
      release_date: row.date,
      stream: row.stream,
      release_kind: row.release_kind ?? null,
      release_format: row.release_format ?? null,
      match_reason: isExact ? 'release_title_exact' : 'release_title_partial',
      matched_alias: row.title,
      score: isExact ? 300 : 100,
    });
  }

  const exactEntityMatches = entityMatches.filter(
    (item) => item.match_reason === 'display_name_exact' || item.match_reason === 'alias_exact',
  );
  for (const entity of exactEntityMatches) {
    const team = state.teamProfiles.find((item) => item.slug === entity.entity_slug);
    if (!team) {
      continue;
    }

    const latestRelease = getSearchLatestReleaseCandidate(team, state.verifiedReleaseHistoryByGroup);
    if (!latestRelease?.verified || !latestRelease.title || !latestRelease.date || !latestRelease.stream) {
      continue;
    }

    const key = getReleaseLookupKey(team.group, latestRelease.title, latestRelease.date, latestRelease.stream);
    if (releaseMatchMap.has(key)) {
      continue;
    }

    releaseMatchMap.set(key, {
      entity_slug: entity.entity_slug,
      display_name: entity.display_name,
      release_title: latestRelease.title,
      release_date: latestRelease.date,
      stream: latestRelease.stream,
      release_kind: latestRelease.releaseKind,
      release_format: latestRelease.releaseFormat,
      match_reason: 'entity_exact_latest_release',
      matched_alias: entity.matched_alias ?? entity.display_name,
      score: 200,
    });
  }

  const releases = [...releaseMatchMap.values()].sort(compareReleaseMatches).slice(0, limit);

  const upcomingMatchMap = new Map();
  for (const row of state.dedupedUpcomingCandidates) {
    const normalizedHeadline = normalizeSearchText(row.headline);
    if (
      !normalizedHeadline.includes(needle.normalized) &&
      !collapseSearchText(normalizedHeadline).includes(needle.compact)
    ) {
      continue;
    }

    const isExact = normalizedHeadline === needle.normalized || collapseSearchText(normalizedHeadline) === needle.compact;
    const entitySlug = state.artistProfileByGroup.get(row.group)?.slug ?? slugifyGroup(row.group);
    if (isExact && !entityMatchSlugs.has(entitySlug)) {
      contextEntitySlugs.add(entitySlug);
    }

    upcomingMatchMap.set(row.event_key ?? `${row.group}::${row.headline}`, {
      entity_slug: entitySlug,
      display_name: state.artistProfileByGroup.get(row.group)?.display_name ?? row.group,
      headline: row.headline,
      scheduled_date: row.scheduled_date ?? null,
      scheduled_month: row.scheduled_month ?? null,
      date_precision: getUpcomingDatePrecisionValue(row),
      date_status: row.date_status,
      release_format: row.release_format ?? null,
      confidence_score: row.confidence ?? null,
      source_type: row.source_type ?? null,
      source_url: row.source_url ?? null,
      evidence_summary: row.evidence_summary ?? null,
      match_reason: isExact ? 'headline_exact' : 'partial',
      matched_alias: isExact ? row.headline : null,
      score: isExact ? 200 : 100,
    });
  }

  for (const entitySlug of contextEntitySlugs) {
    if (entityMatchSlugs.has(entitySlug)) {
      continue;
    }

    const team = state.teamProfiles.find((item) => item.slug === entitySlug);
    if (!team) {
      continue;
    }

    entityMatches.push({
      entity_slug: team.slug,
      display_name: team.displayName,
      canonical_name: team.group,
      agency_name: team.agency || null,
      match_reason: 'partial',
      matched_alias: null,
      latest_release: buildEntityLatestReleaseSummary(team),
      next_upcoming: buildEntityNextUpcomingSummary(team),
      score: 100,
    });
    entityMatchSlugs.add(entitySlug);
  }

  for (const entity of exactEntityMatches) {
    const team = state.teamProfiles.find((item) => item.slug === entity.entity_slug);
    if (!team?.nextUpcomingSignal) {
      continue;
    }

    const row = team.nextUpcomingSignal;
    const key = row.event_key ?? `${row.group}::${row.headline}`;
    const current = upcomingMatchMap.get(key);
    const candidate = {
      entity_slug: entity.entity_slug,
      display_name: entity.display_name,
      headline: row.headline,
      scheduled_date: row.scheduled_date ?? null,
      scheduled_month: row.scheduled_month ?? null,
      date_precision: getUpcomingDatePrecisionValue(row),
      date_status: row.date_status,
      release_format: row.release_format ?? null,
      confidence_score: row.confidence ?? null,
      source_type: row.source_type ?? null,
      source_url: row.source_url ?? null,
      evidence_summary: row.evidence_summary ?? null,
      match_reason: 'entity_exact',
      matched_alias: entity.matched_alias ?? entity.display_name,
      score: 300,
    };

    if (!current || compareUpcomingMatches(candidate, current) < 0) {
      upcomingMatchMap.set(key, candidate);
    }
  }

  const upcoming = [...upcomingMatchMap.values()].sort(compareUpcomingMatches).slice(0, limit);

  return {
    entities: entityMatches.sort(compareEntityMatches).slice(0, limit).map(({ score, ...item }) => item),
    releases: releases.map(({ score, ...item }) => item),
    upcoming: upcoming.map(({ score, ...item }) => item),
  };
}

function buildEntityDetailExpected(slug, state) {
  const team = state.teamProfiles.find((item) => item.slug === slug);
  if (!team) {
    return null;
  }

  const allowlist = state.youtubeChannelAllowlistByGroup.get(team.group);
  const artistProfile = state.artistProfileByGroup.get(team.group);
  const artistSourceUrl =
    team.artistSource ||
    state.verifiedReleaseHistoryByGroup.get(team.group)?.find((item) => typeof item.artist_source === 'string' && item.artist_source.length > 0)?.artist_source ||
    null;

  return {
    identity: {
      entity_slug: team.slug,
      display_name: team.displayName,
      canonical_name: team.group,
      agency_name: team.agency || null,
      badge_image_url: team.badgeImageUrl ?? null,
      representative_image_url: team.representativeImageUrl ?? null,
      debut_year: typeof artistProfile?.debut_year === 'number' ? artistProfile.debut_year : null,
    },
    official_links: {
      youtube: team.youtubeUrl ?? null,
      x: team.xUrl || null,
      instagram: team.instagramUrl || null,
    },
    youtube_channels: {
      primary_team_channel_url: allowlist?.primary_team_channel_url ?? null,
      mv_allowlist_urls: [...(allowlist?.mv_allowlist_urls ?? [])],
    },
    tracking_state: {
      tier: team.tier ?? null,
      watch_reason: team.watchReason ?? null,
      tracking_status: team.trackingStatus ?? null,
    },
    next_upcoming: buildEntityDetailNextUpcomingExpected(team.group, state),
    latest_release: buildEntityDetailLatestReleaseExpected(team.group, state),
    recent_albums: buildEntityDetailRecentAlbumsExpected(team.group, state),
    source_timeline: buildEntityDetailSourceTimelineExpected(team.group, state),
    artist_source_url: artistSourceUrl,
  };
}

function buildReleaseExpected(definition, state) {
  const group = [...state.artistProfileByGroup.values()].find((row) => row.slug === definition.entitySlug)?.group ?? null;
  if (!group) {
    return null;
  }

  const release =
    state.verifiedReleaseHistory.find(
      (item) =>
        item.group === group &&
        item.title === definition.title &&
        item.date === definition.date &&
        item.stream === definition.stream,
    ) ?? null;
  if (!release) {
    return null;
  }

  const displayName = state.artistProfileByGroup.get(group)?.display_name ?? group;
  const detail = getReleaseDetail(group, release.title, release.date, release.stream, release.release_kind, state.releaseDetailsByKey);
  const enrichment = getReleaseEnrichment(group, release.title, release.date, release.stream, release.release_kind, state.releaseEnrichmentByKey);
  const artwork = getReleaseArtwork(group, release.title, release.date, release.stream, release.release_kind, state.releaseArtworkByKey);
  const mvUrls = getReleaseDetailMvUrls(detail);

  const credits = [];
  for (const [role, values] of Object.entries(enrichment.credits ?? {})) {
    if (Array.isArray(values) && values.length) {
      credits.push({ role, names: values });
    }
  }

  return {
    lookup: {
      entity_slug: definition.entitySlug,
      release_title: release.title,
      release_date: release.date,
      stream: release.stream,
      release_kind: release.release_kind ?? null,
      display_name: displayName,
    },
    detail: {
      release: {
        entity_slug: definition.entitySlug,
        display_name: displayName,
        release_title: release.title,
        release_date: release.date,
        stream: release.stream,
        release_kind: release.release_kind ?? null,
      },
      detail_metadata: {
        status: detail.detail_status ?? 'unresolved',
        provenance: detail.detail_provenance ?? 'releaseDetails.missing_row',
      },
      title_track_metadata: {
        status: detail.title_track_status ?? 'unresolved',
        provenance: detail.title_track_provenance ?? 'releaseDetails.missing_row',
      },
      artwork: {
        cover_image_url: artwork.cover_image_url ?? null,
        thumbnail_image_url: artwork.thumbnail_image_url ?? null,
        artwork_source_type: artwork.artwork_source_type ?? null,
        artwork_source_url: artwork.artwork_source_url ?? null,
      },
      service_links: {
        spotify: {
          url: detail.spotify_url ?? null,
          status: detail.spotify_url ? 'canonical' : 'no_link',
        },
        youtube_music: {
          url: detail.youtube_music_url ?? null,
          status: detail.youtube_music_url ? 'canonical' : 'no_link',
        },
      },
      tracks: (detail.tracks ?? []).map((track) => ({
        order: track.order,
        title: track.title,
        is_title_track: track.is_title_track === true,
      })),
      mv: {
        url: mvUrls.canonicalUrl || null,
        video_id: mvUrls.videoId || null,
        status: detail.youtube_video_status ?? (mvUrls.canonicalUrl ? 'canonical' : 'no_link'),
        provenance: detail.youtube_video_provenance ?? null,
      },
      credits,
      charts: enrichment.charts ?? [],
      notes: detail.notes ?? '',
    },
  };
}

function buildCalendarExpected(monthKey, state) {
  const getUpcomingDisplayName = (item) => state.artistProfileByGroup.get(item.group)?.display_name ?? item.group;
  const getUpcomingSortTime = (item) => {
    if (hasExactUpcomingDate(item)) {
      return item.dateValue.getTime();
    }

    const month = getUpcomingMonthKey(item);
    return month ? new Date(`${month}-01T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
  };
  const compareProjectionUpcoming = (left, right) => {
    const leftPrecisionRank = hasExactUpcomingDate(left) ? 0 : getUpcomingDatePrecisionValue(left) === 'month_only' ? 1 : 2;
    const rightPrecisionRank = hasExactUpcomingDate(right) ? 0 : getUpcomingDatePrecisionValue(right) === 'month_only' ? 1 : 2;
    if (leftPrecisionRank !== rightPrecisionRank) {
      return leftPrecisionRank - rightPrecisionRank;
    }

    const leftTime = getUpcomingSortTime(left);
    const rightTime = getUpcomingSortTime(right);
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    const leftStatusRank = left.date_status === 'confirmed' ? 0 : left.date_status === 'scheduled' ? 1 : 2;
    const rightStatusRank = right.date_status === 'confirmed' ? 0 : right.date_status === 'scheduled' ? 1 : 2;
    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank;
    }

    if ((left.confidence ?? 0) !== (right.confidence ?? 0)) {
      return (right.confidence ?? 0) - (left.confidence ?? 0);
    }

    const displayCompare = getUpcomingDisplayName(left).localeCompare(getUpcomingDisplayName(right));
    if (displayCompare !== 0) {
      return displayCompare;
    }

    if (left.headline < right.headline) {
      return -1;
    }

    if (left.headline > right.headline) {
      return 1;
    }

    return 0;
  };
  const getNormalizedReleaseFormat = (item) => item.release_format || null;
  const selectedMonthDate = monthKeyToDate(monthKey);
  const monthReleases = state.verifiedReleaseHistory.filter((item) => getMonthKey(item.dateValue) === monthKey);
  const monthUpcomingSignals = state.filteredUpcomingSignals.filter((item) => getMonthKey(item.dateValue) === monthKey);
  const monthMonthOnlyUpcomingRows = state.filteredUpcoming
    .filter((item) => getUpcomingDatePrecisionValue(item) === 'month_only' && getUpcomingMonthKey(item) === monthKey)
    .sort(compareProjectionUpcoming);
  const monthScheduledRows = [
    ...monthUpcomingSignals,
    ...monthMonthOnlyUpcomingRows.map((item) => ({
      ...item,
      dateValue: new Date(`${item.scheduled_month}-01T00:00:00`),
    })),
  ].sort(compareProjectionUpcoming);

  const releasesByDate = groupByDate(monthReleases);
  const upcomingByDate = groupUpcomingByDate(monthUpcomingSignals);
  const activeDayIsos = [...new Set([...monthReleases.map((item) => item.isoDate), ...monthUpcomingSignals.map((item) => item.isoDate)])].sort();
  const nearestUpcoming = state.filteredUpcomingSignals.find((item) => item.isoDate >= state.todayIso) ?? null;

  const verifiedList = [...monthReleases].sort(compareMonthlyDashboardVerified).map((item) => ({
    release_id: getReleaseLookupKey(item.group, item.title, item.date, item.stream),
    entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
    display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
    release_title: item.title,
    release_date: item.date,
    stream: item.stream,
    release_kind: item.release_kind ?? null,
  }));

  const scheduledList = monthScheduledRows.map((item) => ({
    upcoming_signal_id: item.event_key ?? [item.group.toLowerCase(), item.scheduled_date ?? item.scheduled_month ?? 'undated', item.headline].join('::'),
    entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
    display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
    headline: item.headline,
    scheduled_date: item.scheduled_date ?? null,
    scheduled_month: getUpcomingMonthKey(item),
    date_precision: getUpcomingDatePrecisionValue(item),
    date_status: item.date_status,
    confidence_score: item.confidence ?? null,
    release_format: getNormalizedReleaseFormat(item),
    source_url: item.source_url ?? null,
    source_type: item.source_type ?? null,
    source_domain: item.source_domain ?? (getSourceDomain(item.source_url) || null),
    evidence_summary: item.evidence_summary ?? null,
    source_count: item.evidence_count ?? null,
  }));

  return {
    summary: {
      verified_count: monthReleases.length,
      exact_upcoming_count: monthUpcomingSignals.length,
      month_only_upcoming_count: monthMonthOnlyUpcomingRows.length,
    },
    nearest_upcoming: nearestUpcoming
      ? {
          upcoming_signal_id:
            nearestUpcoming.event_key ??
            [
              nearestUpcoming.group.toLowerCase(),
              nearestUpcoming.scheduled_date ?? nearestUpcoming.scheduled_month ?? 'undated',
              nearestUpcoming.headline,
            ].join('::'),
          entity_slug: state.artistProfileByGroup.get(nearestUpcoming.group)?.slug ?? slugifyGroup(nearestUpcoming.group),
          display_name: state.artistProfileByGroup.get(nearestUpcoming.group)?.display_name ?? nearestUpcoming.group,
          headline: nearestUpcoming.headline,
          scheduled_date: nearestUpcoming.scheduled_date,
          scheduled_month: getUpcomingMonthKey(nearestUpcoming),
          date_precision: getUpcomingDatePrecisionValue(nearestUpcoming),
          date_status: nearestUpcoming.date_status,
          confidence_score: nearestUpcoming.confidence ?? null,
          release_format: getNormalizedReleaseFormat(nearestUpcoming),
          source_url: nearestUpcoming.source_url ?? null,
          source_type: nearestUpcoming.source_type ?? null,
          source_domain: nearestUpcoming.source_domain ?? (getSourceDomain(nearestUpcoming.source_url) || null),
          evidence_summary: nearestUpcoming.evidence_summary ?? null,
          source_count: nearestUpcoming.evidence_count ?? null,
        }
      : null,
    days: activeDayIsos.map((iso) => ({
      date: iso,
      verified_releases: [...(releasesByDate.get(iso) ?? [])]
        .sort((left, right) => {
          const displayCompare = (state.artistProfileByGroup.get(left.group)?.display_name ?? left.group).localeCompare(
            state.artistProfileByGroup.get(right.group)?.display_name ?? right.group,
          );
          if (displayCompare !== 0) {
            return displayCompare;
          }
          return left.title.localeCompare(right.title);
        })
        .map((item) => ({
          release_id: getReleaseLookupKey(item.group, item.title, item.date, item.stream),
          entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
          display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
          release_title: item.title,
          stream: item.stream,
          release_kind: item.release_kind ?? null,
          release_date: item.date,
        })),
      exact_upcoming: [...(upcomingByDate.get(iso) ?? [])]
        .sort(compareProjectionUpcoming)
        .map((item) => ({
          upcoming_signal_id: item.event_key ?? [item.group.toLowerCase(), item.scheduled_date ?? iso, item.headline].join('::'),
          entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
          display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
          headline: item.headline,
          scheduled_date: item.scheduled_date ?? null,
          scheduled_month: getUpcomingMonthKey(item),
          date_precision: getUpcomingDatePrecisionValue(item),
          date_status: item.date_status,
          confidence_score: item.confidence ?? null,
          release_format: getNormalizedReleaseFormat(item),
          source_url: item.source_url ?? null,
          source_type: item.source_type ?? null,
          source_domain: item.source_domain ?? (getSourceDomain(item.source_url) || null),
          evidence_summary: item.evidence_summary ?? null,
          source_count: item.evidence_count ?? null,
        })),
    })),
    month_only_upcoming: monthMonthOnlyUpcomingRows.map((item) => ({
      upcoming_signal_id:
        item.event_key ?? [item.group.toLowerCase(), item.scheduled_month ?? 'undated', item.headline].join('::'),
      entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
      display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
      headline: item.headline,
      scheduled_month: getUpcomingMonthKey(item),
      date_precision: getUpcomingDatePrecisionValue(item),
      date_status: item.date_status,
      confidence_score: item.confidence ?? null,
      release_format: getNormalizedReleaseFormat(item),
      source_url: item.source_url ?? null,
      source_type: item.source_type ?? null,
      source_domain: item.source_domain ?? (getSourceDomain(item.source_url) || null),
      evidence_summary: item.evidence_summary ?? null,
      source_count: item.evidence_count ?? null,
    })),
    verified_list: verifiedList,
    scheduled_list: scheduledList,
  };
}

function buildRadarExpected(state) {
  return {
    featured_upcoming: state.nearestUpcomingJumpSignal
      ? {
          entity_slug: state.artistProfileByGroup.get(state.nearestUpcomingJumpSignal.group)?.slug ?? slugifyGroup(state.nearestUpcomingJumpSignal.group),
          display_name: state.artistProfileByGroup.get(state.nearestUpcomingJumpSignal.group)?.display_name ?? state.nearestUpcomingJumpSignal.group,
          headline: state.nearestUpcomingJumpSignal.headline,
          scheduled_date: state.nearestUpcomingJumpSignal.scheduled_date,
          date_precision: getUpcomingDatePrecisionValue(state.nearestUpcomingJumpSignal),
          date_status: state.nearestUpcomingJumpSignal.date_status,
          confidence_score: state.nearestUpcomingJumpSignal.confidence ?? null,
          release_format: state.nearestUpcomingJumpSignal.release_format ?? null,
        }
      : null,
    weekly_upcoming: state.weeklyDigestRows.map((item) => ({
      entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
      display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
      release_title: item.title,
      release_date: item.date,
      stream: item.stream,
      release_kind: item.release_kind ?? null,
      release_format: item.release_format ?? null,
    })),
    change_feed: state.filteredReleases.slice(0, 10).map((item) => ({
      entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
      display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
      release_title: item.title,
      release_date: item.date,
      stream: item.stream,
      release_kind: item.release_kind ?? null,
      release_format: item.release_format ?? null,
    })),
    long_gap: state.longGapRadarEntries.map((item) => ({
      entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
      display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
      watch_reason: item.watchReason,
      latest_release: item.latestRelease
        ? {
            release_title: item.latestRelease.title,
            release_date: item.latestRelease.date || null,
            stream: item.latestRelease.stream,
            release_kind: item.latestRelease.releaseKind || null,
          }
        : null,
      gap_days: item.gapDays,
      has_upcoming_signal: item.hasUpcomingSignal,
      latest_signal: item.latestSignal
        ? {
            headline: item.latestSignal.headline,
            scheduled_date: item.latestSignal.scheduled_date ?? null,
            scheduled_month: item.latestSignal.scheduled_month ?? null,
            date_precision: getUpcomingDatePrecisionValue(item.latestSignal),
            date_status: item.latestSignal.date_status,
            release_format: item.latestSignal.release_format ?? null,
            confidence_score: item.latestSignal.confidence ?? null,
          }
        : null,
    })),
    rookie: state.rookieRadarEntries.map((item) => ({
      entity_slug: state.artistProfileByGroup.get(item.group)?.slug ?? slugifyGroup(item.group),
      display_name: state.artistProfileByGroup.get(item.group)?.display_name ?? item.group,
      debut_year: item.debutYear ?? null,
      latest_release: item.latestRelease
        ? {
            release_title: item.latestRelease.title,
            release_date: item.latestRelease.date || null,
            stream: item.latestRelease.stream,
            release_kind: item.latestRelease.releaseKind || null,
          }
        : null,
      has_upcoming_signal: item.hasUpcomingSignal,
      latest_signal: item.latestSignal
        ? {
            headline: item.latestSignal.headline,
            scheduled_date: item.latestSignal.scheduled_date ?? null,
            scheduled_month: item.latestSignal.scheduled_month ?? null,
            date_precision: getUpcomingDatePrecisionValue(item.latestSignal),
            date_status: item.latestSignal.date_status,
            release_format: item.latestSignal.release_format ?? null,
            confidence_score: item.latestSignal.confidence ?? null,
          }
        : null,
    })),
  };
}

function getValueType(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function collectShapeMismatches(expected, actual, path = 'data', mismatches = []) {
  const expectedType = getValueType(expected);
  const actualType = getValueType(actual);

  if (expectedType === 'array') {
    if (actualType !== 'array') {
      mismatches.push({ path, expected_type: expectedType, actual_type: actualType, message: 'Type mismatch' });
      return mismatches;
    }

    if (expected.length > 0 && actual.length > 0) {
      collectShapeMismatches(expected[0], actual[0], `${path}[0]`, mismatches);
    }
    return mismatches;
  }

  if (expectedType === 'object') {
    if (actualType !== 'object') {
      mismatches.push({ path, expected_type: expectedType, actual_type: actualType, message: 'Type mismatch' });
      return mismatches;
    }

    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        mismatches.push({ path: `${path}.${key}`, expected_type: getValueType(expected[key]), actual_type: 'missing', message: 'Missing key' });
        continue;
      }
      collectShapeMismatches(expected[key], actual[key], `${path}.${key}`, mismatches);
    }
    return mismatches;
  }

  if (expected !== null && actualType !== expectedType) {
    mismatches.push({ path, expected_type: expectedType, actual_type: actualType, message: 'Type mismatch' });
  }
  return mismatches;
}

function addMismatch(result, category, detail) {
  result.mismatch_categories.add(category);
  result.mismatches.push({ category, ...detail });
}

function comparePrimitive(result, category, path, expected, actual) {
  if (expected !== actual) {
    addMismatch(result, category, { path, expected, actual });
  }
}

function normalizeEntitySignature(item) {
  if (!item) {
    return null;
  }

  return {
    entity_slug: item.entity_slug ?? null,
    display_name: item.display_name ?? null,
    match_reason: item.match_reason ?? null,
    matched_alias: item.matched_alias ?? null,
    latest_release: item.latest_release
      ? {
          release_title: item.latest_release.release_title ?? null,
          release_date: item.latest_release.release_date ?? null,
          stream: item.latest_release.stream ?? null,
        }
      : null,
    next_upcoming: item.next_upcoming
      ? {
          headline: item.next_upcoming.headline ?? null,
          scheduled_date: item.next_upcoming.scheduled_date ?? null,
          scheduled_month: item.next_upcoming.scheduled_month ?? null,
          date_precision: item.next_upcoming.date_precision ?? null,
          date_status: item.next_upcoming.date_status ?? null,
        }
      : null,
  };
}

function normalizeReleaseSearchSignature(item) {
  if (!item) {
    return null;
  }

  return {
    entity_slug: item.entity_slug ?? null,
    display_name: item.display_name ?? null,
    release_title: item.release_title ?? null,
    release_date: item.release_date ?? null,
    stream: item.stream ?? null,
    match_reason: item.match_reason ?? null,
    matched_alias: item.matched_alias ?? null,
  };
}

function normalizeUpcomingSearchSignature(item) {
  if (!item) {
    return null;
  }

  return {
    entity_slug: item.entity_slug ?? null,
    display_name: item.display_name ?? null,
    headline: item.headline ?? null,
    scheduled_date: item.scheduled_date ?? null,
    scheduled_month: item.scheduled_month ?? null,
    date_precision: item.date_precision ?? null,
    date_status: item.date_status ?? null,
    match_reason: item.match_reason ?? null,
    matched_alias: item.matched_alias ?? null,
  };
}

function compareSearchCase(expected, actual, input) {
  const result = {
    mismatch_categories: new Set(),
    mismatches: [],
  };

  const shapeMismatches = collectShapeMismatches(expected, actual).filter((mismatch) => {
    if (
      mismatch.path.match(/^data\.entities\[\d+\]\.next_upcoming\.release_format$/) ||
      mismatch.path.match(/^data\.upcoming\[\d+\]\.release_format$/)
    ) {
      const types = new Set([mismatch.expected_type, mismatch.actual_type]);
      return !(types.has('string') && types.has('null'));
    }

    return true;
  });
  if (shapeMismatches.length) {
    addMismatch(result, 'field-shape mismatches', { path: 'data', shape_mismatches: shapeMismatches.slice(0, 20) });
  }

  for (const segment of ['entities', 'releases', 'upcoming']) {
    const expectedRows = expected[segment] ?? [];
    const actualRows = actual?.[segment] ?? [];
    if (expectedRows.length !== actualRows.length) {
      addMismatch(result, 'missing rows or segments', {
        path: `data.${segment}`,
        expected_count: expectedRows.length,
        actual_count: actualRows.length,
      });
    }
  }

  const entityCount = Math.max(expected.entities.length, actual?.entities?.length ?? 0);
  for (let index = 0; index < entityCount; index += 1) {
    const left = normalizeEntitySignature(expected.entities[index]);
    const right = normalizeEntitySignature(actual?.entities?.[index]);
    if (JSON.stringify(left) === JSON.stringify(right)) {
      continue;
    }

    if ((left?.match_reason ?? null) !== (right?.match_reason ?? null) || (left?.matched_alias ?? null) !== (right?.matched_alias ?? null)) {
      addMismatch(result, 'alias-match differences', { path: `data.entities[${index}]`, expected: left, actual: right, query: input });
    }

    if (JSON.stringify(left?.latest_release ?? null) !== JSON.stringify(right?.latest_release ?? null)) {
      addMismatch(result, 'latest-release or next-upcoming drift', {
        path: `data.entities[${index}].latest_release`,
        expected: left?.latest_release ?? null,
        actual: right?.latest_release ?? null,
      });
    }

    if (JSON.stringify(left?.next_upcoming ?? null) !== JSON.stringify(right?.next_upcoming ?? null)) {
      const category =
        (left?.next_upcoming?.date_precision ?? null) !== (right?.next_upcoming?.date_precision ?? null)
          ? 'exact-vs-month-only drift'
          : 'latest-release or next-upcoming drift';
      addMismatch(result, category, {
        path: `data.entities[${index}].next_upcoming`,
        expected: left?.next_upcoming ?? null,
        actual: right?.next_upcoming ?? null,
      });
    }
  }

  const releaseCount = Math.max(expected.releases.length, actual?.releases?.length ?? 0);
  for (let index = 0; index < releaseCount; index += 1) {
    const left = normalizeReleaseSearchSignature(expected.releases[index]);
    const right = normalizeReleaseSearchSignature(actual?.releases?.[index]);
    if (JSON.stringify(left) === JSON.stringify(right)) {
      continue;
    }

    if ((left?.match_reason ?? null) !== (right?.match_reason ?? null) || (left?.matched_alias ?? null) !== (right?.matched_alias ?? null)) {
      addMismatch(result, 'alias-match differences', { path: `data.releases[${index}]`, expected: left, actual: right, query: input });
    } else {
      addMismatch(result, 'missing rows or segments', { path: `data.releases[${index}]`, expected: left, actual: right });
    }
  }

  const upcomingCount = Math.max(expected.upcoming.length, actual?.upcoming?.length ?? 0);
  for (let index = 0; index < upcomingCount; index += 1) {
    const left = normalizeUpcomingSearchSignature(expected.upcoming[index]);
    const right = normalizeUpcomingSearchSignature(actual?.upcoming?.[index]);
    if (JSON.stringify(left) === JSON.stringify(right)) {
      continue;
    }

    if ((left?.match_reason ?? null) !== (right?.match_reason ?? null) || (left?.matched_alias ?? null) !== (right?.matched_alias ?? null)) {
      addMismatch(result, 'alias-match differences', { path: `data.upcoming[${index}]`, expected: left, actual: right, query: input });
    }

    const leftPrecision = left?.date_precision ?? null;
    const rightPrecision = right?.date_precision ?? null;
    const category =
      leftPrecision !== rightPrecision || (left?.scheduled_date ?? null) !== (right?.scheduled_date ?? null)
        ? 'exact-vs-month-only drift'
        : 'missing rows or segments';
    addMismatch(result, category, { path: `data.upcoming[${index}]`, expected: left, actual: right });
  }

  return result;
}

function normalizeReleaseSummary(item) {
  if (!item) {
    return null;
  }

  return {
    release_title: item.release_title ?? null,
    release_date: item.release_date ?? null,
    stream: item.stream ?? null,
    release_kind: item.release_kind ?? null,
  };
}

function normalizeUpcomingSummary(item) {
  if (!item) {
    return null;
  }

  return {
    headline: item.headline ?? null,
    scheduled_date: item.scheduled_date ?? null,
    scheduled_month: item.scheduled_month ?? null,
    date_precision: item.date_precision ?? null,
    date_status: item.date_status ?? null,
    release_format: item.release_format ?? null,
  };
}

function normalizeEntityReleaseCard(item) {
  if (!item) {
    return null;
  }

  return {
    release_title: item.release_title ?? null,
    release_date: item.release_date ?? null,
    stream: item.stream ?? null,
    release_kind: item.release_kind ?? null,
    release_format: item.release_format ?? null,
    artwork: item.artwork
      ? {
          cover_image_url: item.artwork.cover_image_url ?? null,
          thumbnail_image_url: item.artwork.thumbnail_image_url ?? null,
          artwork_source_type: item.artwork.artwork_source_type ?? null,
          artwork_source_url: item.artwork.artwork_source_url ?? null,
          is_placeholder: item.artwork.is_placeholder === true,
        }
      : null,
  };
}

function normalizeEntityUpcomingSummary(item) {
  if (!item) {
    return null;
  }

  return {
    headline: item.headline ?? null,
    scheduled_date: item.scheduled_date ?? null,
    scheduled_month: item.scheduled_month ?? null,
    date_precision: item.date_precision ?? null,
    date_status: item.date_status ?? null,
    release_format: item.release_format ?? null,
    source_type: item.source_type ?? null,
    source_url: item.source_url ?? null,
    source_domain: item.source_domain ?? null,
    evidence_summary: item.evidence_summary ?? null,
    source_count: item.source_count ?? null,
  };
}

function normalizeEntityTimelineItem(item) {
  if (!item) {
    return null;
  }

  const occurredAt = item.occurred_at ? new Date(item.occurred_at).toISOString() : null;

  return {
    event_type: item.event_type ?? null,
    headline: item.headline ?? null,
    occurred_at: Number.isNaN(new Date(item.occurred_at ?? '').getTime()) ? item.occurred_at ?? null : occurredAt,
    summary: item.summary ?? null,
    source_type: item.source_type ?? null,
    source_url: item.source_url ?? null,
    source_domain: item.source_domain ?? null,
  };
}

function normalizeComparableUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value ?? null;
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function compareEntityDetailCase(expected, actual) {
  const result = {
    mismatch_categories: new Set(),
    mismatches: [],
  };

  const shapeMismatches = collectShapeMismatches(expected, actual);
  if (shapeMismatches.length) {
    addMismatch(result, 'field-shape mismatches', { path: 'data', shape_mismatches: shapeMismatches.slice(0, 20) });
  }

  for (const pathEntry of [
    ['data.identity.display_name', expected.identity.display_name, actual?.identity?.display_name],
    ['data.identity.canonical_name', expected.identity.canonical_name, actual?.identity?.canonical_name],
    ['data.identity.agency_name', expected.identity.agency_name, actual?.identity?.agency_name],
    ['data.official_links.youtube', normalizeComparableUrl(expected.official_links.youtube), normalizeComparableUrl(actual?.official_links?.youtube)],
    ['data.official_links.x', normalizeComparableUrl(expected.official_links.x), normalizeComparableUrl(actual?.official_links?.x)],
    ['data.official_links.instagram', normalizeComparableUrl(expected.official_links.instagram), normalizeComparableUrl(actual?.official_links?.instagram)],
    ['data.tracking_state.tier', expected.tracking_state.tier, actual?.tracking_state?.tier],
    ['data.tracking_state.watch_reason', expected.tracking_state.watch_reason, actual?.tracking_state?.watch_reason],
    ['data.tracking_state.tracking_status', expected.tracking_state.tracking_status, actual?.tracking_state?.tracking_status],
    ['data.artist_source_url', normalizeComparableUrl(expected.artist_source_url), normalizeComparableUrl(actual?.artist_source_url)],
  ]) {
    const [pathValue, left, right] = pathEntry;
    if (left !== right) {
      addMismatch(result, 'missing rows or segments', { path: pathValue, expected: left, actual: right });
    }
  }

  const expectedLatest = normalizeEntityReleaseCard(expected.latest_release);
  const actualLatest = normalizeEntityReleaseCard(actual?.latest_release);
  if (JSON.stringify(expectedLatest) !== JSON.stringify(actualLatest)) {
    addMismatch(result, 'latest-release or next-upcoming drift', {
      path: 'data.latest_release',
      expected: expectedLatest,
      actual: actualLatest,
    });
  }

  const expectedUpcoming = normalizeEntityUpcomingSummary(expected.next_upcoming);
  const actualUpcoming = normalizeEntityUpcomingSummary(actual?.next_upcoming);
  if (JSON.stringify(expectedUpcoming) !== JSON.stringify(actualUpcoming)) {
    addMismatch(
      result,
      (expectedUpcoming?.date_precision ?? null) !== (actualUpcoming?.date_precision ?? null)
        ? 'exact-vs-month-only drift'
        : 'latest-release or next-upcoming drift',
      {
        path: 'data.next_upcoming',
        expected: expectedUpcoming,
        actual: actualUpcoming,
      },
    );
  }

  const expectedAlbums = expected.recent_albums.map(normalizeEntityReleaseCard);
  const actualAlbums = (actual?.recent_albums ?? []).map(normalizeEntityReleaseCard);
  if (JSON.stringify(expectedAlbums) !== JSON.stringify(actualAlbums)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.recent_albums',
      expected: expectedAlbums,
      actual: actualAlbums,
    });
  }

  const expectedTimeline = expected.source_timeline.map(normalizeEntityTimelineItem);
  const actualTimeline = (actual?.source_timeline ?? []).map(normalizeEntityTimelineItem);
  if (JSON.stringify(expectedTimeline) !== JSON.stringify(actualTimeline)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.source_timeline',
      expected: expectedTimeline.slice(0, 10),
      actual: actualTimeline.slice(0, 10),
    });
  }

  return result;
}

function compareReleaseDetailCase(expected, actual) {
  const result = {
    mismatch_categories: new Set(),
    mismatches: [],
  };

  const lookupShapeMismatches = collectShapeMismatches(expected.lookup, actual?.lookup);
  const detailShapeMismatches = collectShapeMismatches(expected.detail, actual?.detail);
  const shapeMismatches = [...lookupShapeMismatches, ...detailShapeMismatches];
  if (shapeMismatches.length) {
    addMismatch(result, 'field-shape mismatches', { path: 'data', shape_mismatches: shapeMismatches.slice(0, 20) });
  }

  const expectedLookup = normalizeReleaseSummary(expected.lookup);
  const actualLookup = normalizeReleaseSummary(actual?.lookup?.release);
  if (JSON.stringify(expectedLookup) !== JSON.stringify(actualLookup)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.lookup.release',
      expected: expectedLookup,
      actual: actualLookup,
    });
  }

  if (JSON.stringify(expected.detail.detail_metadata ?? null) !== JSON.stringify(actual?.detail?.detail_metadata ?? null)) {
    addMismatch(result, 'title-track / MV-state drift', {
      path: 'data.detail.detail_metadata',
      expected: expected.detail.detail_metadata ?? null,
      actual: actual?.detail?.detail_metadata ?? null,
    });
  }

  if (
    JSON.stringify(expected.detail.title_track_metadata ?? null) !==
    JSON.stringify(actual?.detail?.title_track_metadata ?? null)
  ) {
    addMismatch(result, 'title-track / MV-state drift', {
      path: 'data.detail.title_track_metadata',
      expected: expected.detail.title_track_metadata ?? null,
      actual: actual?.detail?.title_track_metadata ?? null,
    });
  }

  const expectedArtwork = expected.detail.artwork;
  const actualArtwork = actual?.detail?.artwork ?? null;
  if (JSON.stringify(expectedArtwork) !== JSON.stringify(actualArtwork)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.detail.artwork',
      expected: expectedArtwork,
      actual: actualArtwork,
    });
  }

  for (const serviceType of ['spotify', 'youtube_music']) {
    const expectedService = expected.detail.service_links[serviceType];
    const actualService = actual?.detail?.service_links?.[serviceType] ?? null;
    if (JSON.stringify(expectedService) !== JSON.stringify(actualService)) {
      addMismatch(result, 'missing rows or segments', {
        path: `data.detail.service_links.${serviceType}`,
        expected: expectedService,
        actual: actualService,
      });
    }
  }

  const expectedTracks = expected.detail.tracks.map((track) => `${track.order}|${track.title}|${track.is_title_track}`);
  const actualTracks = (actual?.detail?.tracks ?? []).map((track) => `${track.order}|${track.title}|${track.is_title_track}`);
  if (JSON.stringify(expectedTracks) !== JSON.stringify(actualTracks)) {
    addMismatch(result, 'title-track / MV-state drift', {
      path: 'data.detail.tracks',
      expected: expectedTracks,
      actual: actualTracks,
    });
  }

  if (JSON.stringify(expected.detail.mv) !== JSON.stringify(actual?.detail?.mv ?? null)) {
    addMismatch(result, 'title-track / MV-state drift', {
      path: 'data.detail.mv',
      expected: expected.detail.mv,
      actual: actual?.detail?.mv ?? null,
    });
  }

  const expectedCredits = expected.detail.credits;
  const actualCredits = actual?.detail?.credits ?? [];
  if (JSON.stringify(expectedCredits) !== JSON.stringify(actualCredits)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.detail.credits',
      expected: expectedCredits,
      actual: actualCredits,
    });
  }

  const expectedCharts = expected.detail.charts;
  const actualCharts = actual?.detail?.charts ?? [];
  if (JSON.stringify(expectedCharts) !== JSON.stringify(actualCharts)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.detail.charts',
      expected: expectedCharts,
      actual: actualCharts,
    });
  }

  if ((expected.detail.notes ?? '') !== (actual?.detail?.notes ?? '')) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.detail.notes',
      expected: expected.detail.notes ?? '',
      actual: actual?.detail?.notes ?? '',
    });
  }

  return result;
}

function calendarReleaseSignature(item) {
  return `${item.entity_slug}|${item.release_title}|${item.release_date ?? ''}|${item.stream}`;
}

function calendarUpcomingSignature(item) {
  return [
    item.entity_slug,
    item.headline,
    item.scheduled_date ?? '',
    item.scheduled_month ?? '',
    item.date_precision,
    item.date_status,
    item.release_format ?? '',
    item.source_type ?? '',
    item.source_url ?? '',
    item.source_domain ?? '',
    item.source_count ?? '',
  ].join('|');
}

function compareCalendarCase(expected, actual) {
  const result = {
    mismatch_categories: new Set(),
    mismatches: [],
  };

  const shapeMismatches = collectShapeMismatches(expected, actual);
  if (shapeMismatches.length) {
    addMismatch(result, 'field-shape mismatches', { path: 'data', shape_mismatches: shapeMismatches.slice(0, 20) });
  }

  if (JSON.stringify(expected.summary) !== JSON.stringify(actual?.summary ?? null)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.summary',
      expected: expected.summary,
      actual: actual?.summary ?? null,
    });
  }

  const expectedNearest = expected.nearest_upcoming ? calendarUpcomingSignature(expected.nearest_upcoming) : null;
  const actualNearest = actual?.nearest_upcoming ? calendarUpcomingSignature(actual.nearest_upcoming) : null;
  if (expectedNearest !== actualNearest) {
    const category =
      expected?.nearest_upcoming?.date_precision !== actual?.nearest_upcoming?.date_precision
        ? 'exact-vs-month-only drift'
        : 'latest-release or next-upcoming drift';
    addMismatch(result, category, {
      path: 'data.nearest_upcoming',
      expected: expected.nearest_upcoming,
      actual: actual?.nearest_upcoming ?? null,
    });
  }

  const expectedDays = expected.days.map((day) => ({
    date: day.date,
    verified_releases: day.verified_releases.map(calendarReleaseSignature),
    exact_upcoming: day.exact_upcoming.map(calendarUpcomingSignature),
  }));
  const actualDays = (actual?.days ?? []).map((day) => ({
    date: day.date,
    verified_releases: (day.verified_releases ?? []).map(calendarReleaseSignature),
    exact_upcoming: (day.exact_upcoming ?? []).map(calendarUpcomingSignature),
  }));
  if (JSON.stringify(expectedDays) !== JSON.stringify(actualDays)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.days',
      expected: expectedDays,
      actual: actualDays,
    });
  }

  const expectedMonthOnly = expected.month_only_upcoming.map(calendarUpcomingSignature);
  const actualMonthOnly = (actual?.month_only_upcoming ?? []).map(calendarUpcomingSignature);
  if (JSON.stringify(expectedMonthOnly) !== JSON.stringify(actualMonthOnly)) {
    addMismatch(result, 'exact-vs-month-only drift', {
      path: 'data.month_only_upcoming',
      expected: expectedMonthOnly,
      actual: actualMonthOnly,
    });
  }

  const expectedVerifiedList = expected.verified_list.map(calendarReleaseSignature);
  const actualVerifiedList = (actual?.verified_list ?? []).map(calendarReleaseSignature);
  if (JSON.stringify(expectedVerifiedList) !== JSON.stringify(actualVerifiedList)) {
    addMismatch(result, 'missing rows or segments', {
      path: 'data.verified_list',
      expected: expectedVerifiedList,
      actual: actualVerifiedList,
    });
  }

  const expectedScheduledList = expected.scheduled_list.map(calendarUpcomingSignature);
  const actualScheduledList = (actual?.scheduled_list ?? []).map(calendarUpcomingSignature);
  if (JSON.stringify(expectedScheduledList) !== JSON.stringify(actualScheduledList)) {
    addMismatch(result, 'exact-vs-month-only drift', {
      path: 'data.scheduled_list',
      expected: expectedScheduledList,
      actual: actualScheduledList,
    });
  }

  return result;
}

function radarUpcomingSignature(item) {
  return `${item.entity_slug}|${item.headline}|${item.scheduled_date ?? ''}|${item.scheduled_month ?? ''}|${item.date_precision}|${item.date_status}`;
}

function radarReleaseSignature(item) {
  return `${item.entity_slug}|${item.release_title}|${item.release_date}|${item.stream}`;
}

function radarLongGapSignature(item) {
  const latestRelease = item.latest_release
    ? `${item.latest_release.release_title}|${item.latest_release.release_date}|${item.latest_release.stream}`
    : 'null';
  const latestSignal = item.latest_signal ? radarUpcomingSignature(item.latest_signal) : 'null';
  return `${item.entity_slug}|${item.watch_reason}|${latestRelease}|${item.gap_days}|${item.has_upcoming_signal}|${latestSignal}`;
}

function radarRookieSignature(item) {
  const latestRelease = item.latest_release
    ? `${item.latest_release.release_title}|${item.latest_release.release_date}|${item.latest_release.stream}`
    : 'null';
  const latestSignal = item.latest_signal ? radarUpcomingSignature(item.latest_signal) : 'null';
  return `${item.entity_slug}|${item.debut_year}|${latestRelease}|${item.has_upcoming_signal}|${latestSignal}`;
}

function compareRadarCase(expected, actual) {
  const result = {
    mismatch_categories: new Set(),
    mismatches: [],
  };

  const shapeMismatches = collectShapeMismatches(expected, actual);
  if (shapeMismatches.length) {
    addMismatch(result, 'field-shape mismatches', { path: 'data', shape_mismatches: shapeMismatches.slice(0, 20) });
  }

  const expectedFeatured = expected.featured_upcoming ? radarUpcomingSignature(expected.featured_upcoming) : null;
  const actualFeatured = actual?.featured_upcoming ? radarUpcomingSignature(actual.featured_upcoming) : null;
  if (expectedFeatured !== actualFeatured) {
    addMismatch(result, 'radar eligibility drift', {
      path: 'data.featured_upcoming',
      expected: expected.featured_upcoming,
      actual: actual?.featured_upcoming ?? null,
    });
  }

  const expectedWeekly = expected.weekly_upcoming.map(radarReleaseSignature);
  const actualWeekly = (actual?.weekly_upcoming ?? []).map((item) =>
    item.release_title ? radarReleaseSignature(item) : radarUpcomingSignature(item),
  );
  if (JSON.stringify(expectedWeekly) !== JSON.stringify(actualWeekly)) {
    addMismatch(result, 'radar eligibility drift', {
      path: 'data.weekly_upcoming',
      expected: expectedWeekly,
      actual: actualWeekly,
    });
  }

  const expectedFeed = expected.change_feed.map(radarReleaseSignature);
  const actualFeed = (actual?.change_feed ?? []).map((item) =>
    item.release_title ? radarReleaseSignature(item) : `${item.kind ?? 'unknown'}|${item.entity_slug ?? ''}|${item.headline ?? ''}|${item.release_title ?? ''}`,
  );
  if (JSON.stringify(expectedFeed) !== JSON.stringify(actualFeed)) {
    addMismatch(result, 'radar eligibility drift', {
      path: 'data.change_feed',
      expected: expectedFeed,
      actual: actualFeed,
    });
  }

  const expectedLongGap = expected.long_gap.map(radarLongGapSignature);
  const actualLongGap = (actual?.long_gap ?? []).map(radarLongGapSignature);
  if (JSON.stringify(expectedLongGap) !== JSON.stringify(actualLongGap)) {
    addMismatch(result, 'radar eligibility drift', {
      path: 'data.long_gap',
      expected: expectedLongGap,
      actual: actualLongGap,
    });
  }

  const expectedRookie = expected.rookie.map(radarRookieSignature);
  const actualRookie = (actual?.rookie ?? []).map(radarRookieSignature);
  if (JSON.stringify(expectedRookie) !== JSON.stringify(actualRookie)) {
    addMismatch(result, 'radar eligibility drift', {
      path: 'data.rookie',
      expected: expectedRookie,
      actual: actualRookie,
    });
  }

  return result;
}

function buildSummaryLines(caseResults) {
  const bySurface = new Map();
  const byCategory = new Map();

  for (const caseResult of caseResults) {
    const surface = bySurface.get(caseResult.surface) ?? { total: 0, clean: 0, drift: 0 };
    surface.total += 1;
    if (caseResult.clean) {
      surface.clean += 1;
    } else {
      surface.drift += 1;
    }
    bySurface.set(caseResult.surface, surface);

    for (const category of caseResult.mismatch_categories) {
      byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    }
  }

  const lines = [];
  for (const [surface, stats] of bySurface) {
    lines.push(`${surface}: clean ${stats.clean}/${stats.total}, drift ${stats.drift}/${stats.total}`);
  }
  for (const [category, count] of [...byCategory.entries()].sort((left, right) => right[1] - left[1])) {
    lines.push(`${category}: ${count} case(s)`);
  }
  return lines;
}

function limitSnapshot(value, depth = 0) {
  if (depth > 4) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => limitSnapshot(item, depth + 1));
  }

  if (isRecord(value)) {
    const next = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = limitSnapshot(child, depth + 1);
    }
    return next;
  }

  return value;
}

function createShadowRequestId(url) {
  const normalizedUrl = String(url).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  return `shadow-${normalizedUrl}-${randomUUID()}`;
}

function readInjectedResponseRequestId(body, response) {
  if (body && typeof body === 'object' && body.meta && typeof body.meta.request_id === 'string') {
    return body.meta.request_id;
  }

  const headerValue = response.headers['x-request-id'];
  return typeof headerValue === 'string' && headerValue.trim().length > 0 ? headerValue.trim() : null;
}

async function injectJson(app, url) {
  const requestId = createShadowRequestId(url);
  const response = await app.inject({
    method: 'GET',
    url,
    headers: {
      'x-request-id': requestId,
    },
  });
  let body = null;
  try {
    body = response.json();
  } catch {
    body = null;
  }

  return {
    statusCode: response.statusCode,
    body,
    requestIdSent: requestId,
    responseRequestId: readInjectedResponseRequestId(body, response),
  };
}

function buildCaseReport(surface, input, expectedSnapshot, actualSnapshot, comparison, meta = {}) {
  const mismatchCategories = [...comparison.mismatch_categories];
  return {
    surface,
    input,
    clean: mismatchCategories.length === 0,
    mismatch_categories: mismatchCategories,
    mismatches: comparison.mismatches.slice(0, 25),
    expected_snapshot: limitSnapshot(expectedSnapshot),
    actual_snapshot: limitSnapshot(actualSnapshot),
    ...meta,
  };
}

function readLinkedParityReport() {
  if (!fs.existsSync(PARITY_REPORT_PATH)) {
    return {
      exists: false,
      path: path.relative(REPO_ROOT, PARITY_REPORT_PATH),
    };
  }

  const report = loadJson(PARITY_REPORT_PATH);
  return {
    exists: true,
    path: path.relative(REPO_ROOT, PARITY_REPORT_PATH),
    clean: report.clean,
    generated_at: report.generated_at,
    summary_lines: report.summary_lines ?? [],
  };
}

function runSelfCheck() {
  const searchComparison = compareSearchCase(
    {
      entities: [
        {
          entity_slug: 'yena',
          display_name: 'YENA',
          canonical_name: 'YENA',
          match_reason: 'alias_exact',
          matched_alias: '최예나',
          latest_release: null,
          next_upcoming: null,
        },
      ],
      releases: [],
      upcoming: [],
    },
    {
      entities: [
        {
          entity_slug: 'yena',
          display_name: 'YENA',
          canonical_name: 'YENA',
          match_reason: 'partial',
          matched_alias: null,
          latest_release: null,
          next_upcoming: null,
        },
      ],
      releases: [],
      upcoming: [],
    },
    '최예나',
  );
  assert(searchComparison.mismatch_categories.has('alias-match differences'));

  const calendarComparison = compareCalendarCase(
    {
      summary: {
        verified_count: 0,
        exact_upcoming_count: 0,
        month_only_upcoming_count: 1,
      },
      nearest_upcoming: null,
      days: [],
      month_only_upcoming: [
        {
          entity_slug: 'and-team',
          display_name: '&TEAM',
          headline: 'Month only',
          scheduled_month: '2026-04',
          date_precision: 'month_only',
          date_status: 'scheduled',
          confidence_score: 0.7,
          release_format: 'ep',
        },
      ],
      verified_list: [],
      scheduled_list: [],
    },
    {
      summary: {
        verified_count: 0,
        exact_upcoming_count: 1,
        month_only_upcoming_count: 0,
      },
      nearest_upcoming: null,
      days: [],
      month_only_upcoming: [],
      verified_list: [],
      scheduled_list: [
        {
          entity_slug: 'and-team',
          display_name: '&TEAM',
          headline: 'Exact date',
          scheduled_date: '2026-04-07',
          scheduled_month: '2026-04',
          date_precision: 'exact',
          date_status: 'scheduled',
          confidence_score: 0.7,
          release_format: 'ep',
        },
      ],
    },
  );
  assert(calendarComparison.mismatch_categories.has('exact-vs-month-only drift'));

  const releaseComparison = compareReleaseDetailCase(
    {
      lookup: {
        entity_slug: 'ive',
        release_title: 'REVIVE+',
        release_date: '2026-02-23',
        stream: 'album',
        release_kind: 'ep',
        display_name: 'IVE',
      },
      detail: {
        release: {
          entity_slug: 'ive',
          display_name: 'IVE',
          release_title: 'REVIVE+',
          release_date: '2026-02-23',
          stream: 'album',
          release_kind: 'ep',
        },
        detail_metadata: { status: 'verified', provenance: 'releaseDetails.existing_row' },
        title_track_metadata: { status: 'inferred', provenance: 'release_title_substring' },
        artwork: {},
        service_links: {
          spotify: { url: null, status: 'no_link' },
          youtube_music: { url: null, status: 'no_link' },
        },
        tracks: [{ order: 1, title: 'BLACKHOLE', is_title_track: true }],
        mv: { url: null, video_id: null, status: 'unresolved', provenance: null },
        credits: [],
        charts: [],
        notes: '',
      },
    },
    {
      lookup: {
        release: {
          entity_slug: 'ive',
          display_name: 'IVE',
          release_title: 'REVIVE+',
          release_date: '2026-02-23',
          stream: 'album',
          release_kind: 'ep',
        },
      },
      detail: {
        release: {
          entity_slug: 'ive',
          display_name: 'IVE',
          release_title: 'REVIVE+',
          release_date: '2026-02-23',
          stream: 'album',
          release_kind: 'ep',
        },
        detail_metadata: { status: 'verified', provenance: 'releaseDetails.existing_row' },
        title_track_metadata: { status: 'manual_override', provenance: 'release_detail_overrides.title_tracks' },
        artwork: {},
        service_links: {
          spotify: { url: null, status: 'no_link' },
          youtube_music: { url: null, status: 'no_link' },
        },
        tracks: [{ order: 1, title: 'BLACKHOLE', is_title_track: false }],
        mv: { url: null, video_id: null, status: 'manual_override', provenance: null },
        credits: [],
        charts: [],
        notes: '',
      },
    },
  );
  assert(releaseComparison.mismatch_categories.has('title-track / MV-state drift'));

  const radarComparison = compareRadarCase(
    {
      featured_upcoming: null,
      weekly_upcoming: [],
      change_feed: [],
      long_gap: [],
      rookie: [{ entity_slug: 'yena', display_name: 'YENA', debut_year: 2021, latest_release: null, has_upcoming_signal: false, latest_signal: null }],
    },
    {
      featured_upcoming: null,
      weekly_upcoming: [],
      change_feed: [],
      long_gap: [],
      rookie: [],
    },
  );
  assert(radarComparison.mismatch_categories.has('radar eligibility drift'));

  return {
    passed: true,
  };
}

async function buildSearchCaseReport(app, state, query) {
  const expected = buildSearchExpected(query, state);
  const actualResponse = await injectJson(app, `/v1/search?q=${encodeURIComponent(query)}`);
  const actualData = actualResponse.body?.data ?? null;
  const comparison =
    actualResponse.statusCode === 200
      ? compareSearchCase(expected, actualData, query)
      : {
          mismatch_categories: new Set(['missing rows or segments']),
          mismatches: [{ category: 'missing rows or segments', path: 'response.statusCode', expected: 200, actual: actualResponse.statusCode }],
        };

  return buildCaseReport('search', { q: query }, expected, actualData, comparison, {
    actual_status_code: actualResponse.statusCode,
    request_id_sent: actualResponse.requestIdSent,
    response_request_id: actualResponse.responseRequestId,
  });
}

async function buildEntityCaseReport(app, state, slug) {
  const expected = buildEntityDetailExpected(slug, state);
  const actualResponse = await injectJson(app, `/v1/entities/${slug}`);
  const actualData = actualResponse.body?.data ?? null;
  const comparison =
    actualResponse.statusCode === 200 && expected
      ? compareEntityDetailCase(expected, actualData)
      : {
          mismatch_categories: new Set(['missing rows or segments']),
          mismatches: [{ category: 'missing rows or segments', path: 'response.statusCode', expected: 200, actual: actualResponse.statusCode }],
        };

  return buildCaseReport('entity_detail', { slug }, expected, actualData, comparison, {
    actual_status_code: actualResponse.statusCode,
    request_id_sent: actualResponse.requestIdSent,
    response_request_id: actualResponse.responseRequestId,
  });
}

async function buildReleaseCaseReport(app, state, definition) {
  const expected = buildReleaseExpected(definition, state);
  const lookupUrl = `/v1/releases/lookup?entity_slug=${encodeURIComponent(definition.entitySlug)}&title=${encodeURIComponent(
    definition.title,
  )}&date=${definition.date}&stream=${definition.stream}`;
  const lookupResponse = await injectJson(app, lookupUrl);
  const lookupData = lookupResponse.body?.data ?? null;

  let detailResponse = { statusCode: 0, body: null, requestIdSent: null, responseRequestId: null };
  if (lookupResponse.statusCode === 200 && lookupData?.canonical_path) {
    detailResponse = await injectJson(app, lookupData.canonical_path);
  }

  const actual = {
    lookup: lookupData,
    detail: detailResponse.body?.data ?? null,
  };

  const comparison =
    lookupResponse.statusCode === 200 && detailResponse.statusCode === 200 && expected
      ? compareReleaseDetailCase(expected, actual)
      : {
          mismatch_categories: new Set(['missing rows or segments']),
          mismatches: [
            {
              category: 'missing rows or segments',
              path: 'lookup.statusCode',
              expected: 200,
              actual: lookupResponse.statusCode,
            },
            {
              category: 'missing rows or segments',
              path: 'detail.statusCode',
              expected: 200,
              actual: detailResponse.statusCode,
            },
          ],
        };

  return buildCaseReport('release_detail', definition, expected, actual, comparison, {
    lookup_status_code: lookupResponse.statusCode,
    detail_status_code: detailResponse.statusCode,
    lookup_request_id_sent: lookupResponse.requestIdSent,
    lookup_response_request_id: lookupResponse.responseRequestId,
    detail_request_id_sent: detailResponse.requestIdSent,
    detail_response_request_id: detailResponse.responseRequestId,
  });
}

async function buildCalendarCaseReport(app, state, month) {
  const expected = buildCalendarExpected(month, state);
  const actualResponse = await injectJson(app, `/v1/calendar/month?month=${month}`);
  const actualData = actualResponse.body?.data ?? null;
  const comparison =
    actualResponse.statusCode === 200
      ? compareCalendarCase(expected, actualData)
      : {
          mismatch_categories: new Set(['missing rows or segments']),
          mismatches: [{ category: 'missing rows or segments', path: 'response.statusCode', expected: 200, actual: actualResponse.statusCode }],
        };

  return buildCaseReport('calendar_month', { month }, expected, actualData, comparison, {
    actual_status_code: actualResponse.statusCode,
    request_id_sent: actualResponse.requestIdSent,
    response_request_id: actualResponse.responseRequestId,
  });
}

async function buildRadarCaseReport(app, state) {
  const expected = buildRadarExpected(state);
  const actualResponse = await injectJson(app, '/v1/radar');
  const actualData = actualResponse.body?.data ?? null;
  const comparison =
    actualResponse.statusCode === 200
      ? compareRadarCase(expected, actualData)
      : {
          mismatch_categories: new Set(['missing rows or segments']),
          mismatches: [{ category: 'missing rows or segments', path: 'response.statusCode', expected: 200, actual: actualResponse.statusCode }],
        };

  return buildCaseReport('radar', { surface: 'default' }, expected, actualData, comparison, {
    actual_status_code: actualResponse.statusCode,
    request_id_sent: actualResponse.requestIdSent,
    response_request_id: actualResponse.responseRequestId,
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const state = createBaselineState();
  const linkedParityReport = readLinkedParityReport();
  const selfCheck = runSelfCheck();

  const app = buildApp();
  await app.ready();

  try {
    const caseResults = [];

    for (const query of SEARCH_CASES) {
      caseResults.push(await buildSearchCaseReport(app, state, query));
    }
    for (const slug of ENTITY_CASES) {
      caseResults.push(await buildEntityCaseReport(app, state, slug));
    }
    for (const definition of RELEASE_CASES) {
      caseResults.push(await buildReleaseCaseReport(app, state, definition));
    }
    for (const month of CALENDAR_CASES) {
      caseResults.push(await buildCalendarCaseReport(app, state, month));
    }
    caseResults.push(await buildRadarCaseReport(app, state));

    const summaryLines = buildSummaryLines(caseResults);
    const clean = caseResults.every((item) => item.clean);

    const report = {
      generated_at: new Date().toISOString(),
      clean,
      linked_parity_report: linkedParityReport,
      self_check: selfCheck,
      coverage: {
        search: SEARCH_CASES,
        entity_detail: ENTITY_CASES,
        release_detail: RELEASE_CASES,
        calendar_month: CALENDAR_CASES,
        radar: ['default'],
      },
      summary_lines: summaryLines,
      cases: caseResults,
    };

    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({ clean, report_path: path.resolve(args.reportPath) }));
    for (const line of summaryLines) {
      console.log(line);
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
