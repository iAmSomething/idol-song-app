import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { buildBundleConsistency, buildReportBundleMetadata } = require('../../scripts/lib/reportBundle.mjs') as {
  buildBundleConsistency: (args: Record<string, unknown>) => { status: string; mismatches: string[] };
  buildReportBundleMetadata: (args: Record<string, unknown>) => {
    bundle_id: string;
    bundle_kind: string;
    cadence_profile: string;
  };
};

test('report bundle metadata is stable for the same snapshot inputs', () => {
  const first = buildReportBundleMetadata({
    bundleKind: 'post-sync-verification',
    cadenceProfile: 'daily-upcoming',
    sourceKind: 'automation',
    workflowName: 'Upcoming Comeback Scan',
    gitCommitSha: 'abc123',
    githubRunId: '42',
    releaseSyncReference: { path: 'release_pipeline_db_sync_summary.json', generated_at: '2026-03-11T00:00:00.000Z' },
    upcomingSyncReference: { path: 'upcoming_pipeline_db_sync_summary.json', generated_at: '2026-03-11T00:01:00.000Z' },
    projectionReference: { path: 'projection_refresh_summary.json', generated_at: '2026-03-11T00:02:00.000Z' },
    historicalCoverageReference: { path: 'historical_release_detail_coverage_report.json', generated_at: '2026-03-10T12:00:00.000Z' },
    workerCadenceReference: { path: 'worker_cadence_report.json', generated_at: '2026-03-11T00:03:00.000Z' },
  });
  const second = buildReportBundleMetadata({
    bundleKind: 'post-sync-verification',
    cadenceProfile: 'daily-upcoming',
    sourceKind: 'automation',
    workflowName: 'Upcoming Comeback Scan',
    gitCommitSha: 'abc123',
    githubRunId: '42',
    releaseSyncReference: { path: 'release_pipeline_db_sync_summary.json', generated_at: '2026-03-11T00:00:00.000Z' },
    upcomingSyncReference: { path: 'upcoming_pipeline_db_sync_summary.json', generated_at: '2026-03-11T00:01:00.000Z' },
    projectionReference: { path: 'projection_refresh_summary.json', generated_at: '2026-03-11T00:02:00.000Z' },
    historicalCoverageReference: { path: 'historical_release_detail_coverage_report.json', generated_at: '2026-03-10T12:00:00.000Z' },
    workerCadenceReference: { path: 'worker_cadence_report.json', generated_at: '2026-03-11T00:03:00.000Z' },
  });

  assert.equal(first.bundle_id, second.bundle_id);
  assert.equal(first.bundle_kind, 'post-sync-verification');
  assert.equal(first.cadence_profile, 'daily-upcoming');
});

test('bundle consistency fails when derived reports drift from the declared bundle', () => {
  const bundle = buildReportBundleMetadata({
    bundleKind: 'catalog-enrichment',
    cadenceProfile: 'weekly-enrichment',
    sourceKind: 'automation',
    workflowName: 'Catalog Enrichment Refresh',
    gitCommitSha: 'abc123',
    githubRunId: '43',
    historicalCoverageReference: {
      path: 'historical_release_detail_coverage_report.json',
      generated_at: '2026-03-11T01:00:00.000Z',
    },
  });

  const consistency = buildBundleConsistency({
    bundle,
    parityReport: { report_bundle: { bundle_id: 'stale-bundle-1' } },
    shadowReport: { report_bundle: { bundle_id: bundle.bundle_id } },
    runtimeGateReport: { report_bundle: { bundle_id: bundle.bundle_id } },
    historicalCoverageReport: { generated_at: '2026-03-11T02:00:00.000Z' },
  });

  assert.equal(consistency.status, 'fail');
  assert.ok(consistency.mismatches.some((entry: string) => entry.includes('parity bundle drift')));
  assert.ok(consistency.mismatches.some((entry: string) => entry.includes('historical coverage drift')));
});
