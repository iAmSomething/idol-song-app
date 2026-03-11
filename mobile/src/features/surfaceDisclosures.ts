import type { ScreenDataSource } from './screenDataSource';
import type { EntityDetailSnapshotModel, ReleaseDetailModel } from '../types';

export type SurfaceDisclosure = {
  title: string;
  body: string;
  testID: string;
};

export type CanonicalDisclosureStatus =
  | 'missing'
  | 'unresolved'
  | 'review_needed'
  | 'conditional_none';

const CANONICAL_DISCLOSURE_LABELS: Record<CanonicalDisclosureStatus, string> = {
  missing: '미기재',
  unresolved: '미해결',
  review_needed: '검토 필요',
  conditional_none: '조건부 없음',
};

function formatCachedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [date, time] = value.split('T');
  if (!date || !time) {
    return value;
  }

  return `${date} ${time.slice(0, 5)}`;
}

function summarizeIssues(issues: string[]): string {
  if (issues.length === 0) {
    return 'runtime 이슈는 없지만 최신 동기화 상태를 다시 확인해 주세요.';
  }

  return issues.join(' / ');
}

export function formatCanonicalDisclosureLine(
  subject: string,
  status: CanonicalDisclosureStatus,
  detail: string,
): string {
  return `${subject} · ${CANONICAL_DISCLOSURE_LABELS[status]}: ${detail}`;
}

export function buildDatasetRiskDisclosure(
  source: Pick<ScreenDataSource, 'activeSource' | 'freshness' | 'issues' | 'sourceLabel'> & {
    runtimeState: Pick<ScreenDataSource['runtimeState'], 'mode'>;
  },
  surfaceLabel: string,
  testID: string,
): SurfaceDisclosure | null {
  if (source.runtimeState.mode !== 'degraded' && source.issues.length === 0) {
    return null;
  }

  const sourceStateLead =
    source.activeSource === 'backend-cache'
      ? '마지막 라이브 요청이 실패해 저장된 백엔드 스냅샷으로 화면을 유지하고 있습니다.'
      : source.activeSource === 'bundled-static-fallback'
        ? '라이브 응답과 캐시를 모두 확보하지 못해 앱 번들 데이터를 임시로 보여 주고 있습니다.'
        : '현재 런타임이 degraded 상태라 최신 동기화 대신 안전한 읽기 경로를 우선합니다.';
  const freshnessNote =
    source.activeSource.includes('cache')
      ? source.freshness.rollingReferenceAt
        ? `발매/예정 데이터는 ${formatCachedAt(source.freshness.rollingReferenceAt)}에 저장된 캐시 기준입니다.`
        : '발매/예정 데이터는 마지막으로 저장된 캐시 기준입니다.'
      : '발매·예정 데이터는 네트워크 상태에 따라 일부 지연되거나 최소 정보로 축소될 수 있습니다.';

  return {
    title: '데이터 최신화 유의',
    body: `${surfaceLabel} 화면은 현재 ${source.sourceLabel} 기준으로 유지되고 있습니다. ${sourceStateLead} ${freshnessNote} ${summarizeIssues(source.issues)} 다시 시도하면 라이브 응답으로 복귀할 수 있습니다.`,
    testID,
  };
}

export function buildEntitySourceDisclosure(
  snapshot: EntityDetailSnapshotModel,
): SurfaceDisclosure | null {
  const lines: string[] = [];

  if (!snapshot.team.artistSourceUrl) {
    lines.push(
      formatCanonicalDisclosureLine(
        '아티스트 출처',
        'missing',
        '프로필 기준 source link가 아직 연결되지 않았습니다.',
      ),
    );
  }

  if (snapshot.nextUpcoming && !snapshot.nextUpcoming.sourceUrl) {
    lines.push(
      formatCanonicalDisclosureLine(
        '다음 컴백 출처',
        'missing',
        '예정 신호는 보이지만 source link가 아직 붙지 않았습니다.',
      ),
    );
  }

  if (snapshot.latestRelease && !snapshot.latestRelease.sourceUrl) {
    lines.push(
      formatCanonicalDisclosureLine(
        '최신 발매 출처',
        'missing',
        'verified release source link가 아직 연결되지 않았습니다.',
      ),
    );
  }

  if (snapshot.sourceTimeline.length === 0) {
    lines.push(
      formatCanonicalDisclosureLine(
        '소스 타임라인',
        'unresolved',
        '예정·발매 근거를 하나의 타임라인으로 아직 묶지 못했습니다.',
      ),
    );
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    title: '소스 신뢰도',
    body: lines.join('\n'),
    testID: 'entity-source-confidence-notice',
  };
}

export function buildReleaseDependencyDisclosure(
  detail: ReleaseDetailModel,
): SurfaceDisclosure | null {
  const lines: string[] = [];

  if (detail.tracks.length === 0) {
    lines.push(
      formatCanonicalDisclosureLine(
        '트랙 메타데이터',
        'missing',
        '신뢰 가능한 canonical tracklist가 아직 연결되지 않았습니다.',
      ),
    );
  }

  if (!detail.spotifyUrl || !detail.youtubeMusicUrl) {
    lines.push(
      formatCanonicalDisclosureLine(
        '음원 서비스 링크',
        'missing',
        'Spotify 또는 YouTube Music canonical link가 비어 있습니다.',
      ),
    );
  }

  if (detail.youtubeVideoStatus === 'needs_review') {
    lines.push(
      formatCanonicalDisclosureLine(
        '공식 MV',
        'review_needed',
        '후보는 있지만 사람 검토가 아직 끝나지 않았습니다.',
      ),
    );
  }

  if (detail.youtubeVideoStatus === 'unresolved') {
    lines.push(
      formatCanonicalDisclosureLine(
        '공식 MV',
        'unresolved',
        '채워야 하지만 아직 canonical target을 확정하지 못했습니다.',
      ),
    );
  }

  if (detail.youtubeVideoStatus === 'no_mv' || detail.youtubeVideoStatus === 'no_link') {
    lines.push(
      formatCanonicalDisclosureLine(
        '공식 MV',
        'conditional_none',
        'first-party evidence 기준으로 공식 MV가 없다고 확인된 상태입니다.',
      ),
    );
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    title: '외부 링크 및 메타 상태',
    body: lines.join('\n'),
    testID: 'release-detail-quality-notice',
  };
}
