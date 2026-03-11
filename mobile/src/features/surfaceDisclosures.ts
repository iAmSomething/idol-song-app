import type { ScreenDataSource } from './screenDataSource';
import type { EntityDetailSnapshotModel, ReleaseDetailModel } from '../types';

export type SurfaceDisclosure = {
  title: string;
  body: string;
  testID: string;
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
  const gaps: string[] = [];

  if (!snapshot.team.artistSourceUrl) {
    gaps.push('아티스트 출처');
  }

  if (snapshot.nextUpcoming && !snapshot.nextUpcoming.sourceUrl) {
    gaps.push('다음 컴백 출처');
  }

  if (snapshot.latestRelease && !snapshot.latestRelease.sourceUrl) {
    gaps.push('최신 발매 출처');
  }

  if (snapshot.sourceTimeline.length === 0) {
    gaps.push('소스 타임라인');
  }

  if (gaps.length === 0) {
    return null;
  }

  return {
    title: '소스 신뢰도',
    body: `${gaps.join(', ')} 정보가 아직 비어 있거나 연결되지 않았습니다. 이 화면은 실용 허브를 우선하므로, 없는 출처는 숨기고 확인 가능한 정보만 남깁니다.`,
    testID: 'entity-source-confidence-notice',
  };
}

export function buildReleaseDependencyDisclosure(
  detail: ReleaseDetailModel,
): SurfaceDisclosure | null {
  const issues: string[] = [];

  if (detail.tracks.length === 0) {
    issues.push('트랙 메타데이터 미완료');
  }

  if (!detail.spotifyUrl || !detail.youtubeMusicUrl) {
    issues.push('음원 서비스 링크 일부 누락');
  }

  if (detail.youtubeVideoStatus === 'needs_review' || detail.youtubeVideoStatus === 'unresolved') {
    issues.push('공식 MV 미확정');
  }

  if (detail.youtubeVideoStatus === 'no_mv') {
    issues.push('공식 MV 미제공');
  }

  if (issues.length === 0) {
    return null;
  }

  return {
    title: '외부 링크 및 메타 상태',
    body: `${issues.join(' / ')}. canonical 링크가 비어 있으면 검색 fallback 또는 상태 안내만 남기고, 없는 정보를 placeholder로 꾸미지 않습니다.`,
    testID: 'release-detail-quality-notice',
  };
}
