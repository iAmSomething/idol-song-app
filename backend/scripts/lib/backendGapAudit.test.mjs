import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBackendGapAuditReport, renderBackendGapAuditMarkdown } from './backendGapAudit.mjs';

test('buildBackendGapAuditReport maps blockers and baseline deltas', () => {
  const report = buildBackendGapAuditReport({
    scorecard: {
      overall: { score_percent: 56.3, status: 'fail' },
      categories: [
        {
          key: 'backend_runtime_health',
          label: 'Backend runtime health',
          status: 'fail',
          blocker_reasons: ['projection_freshness=fail'],
          summary_lines: [],
        },
        {
          key: 'backend_deploy_parity',
          label: 'Backend deploy parity',
          status: 'fail',
          blocker_reasons: ['parity_clean=false'],
          summary_lines: [],
        },
        {
          key: 'web_backend_only_stability',
          label: 'Web backend-only stability',
          status: 'fail',
          blocker_reasons: ['entity_detail clean_ratio=0.5'],
          summary_lines: [],
        },
        {
          key: 'catalog_completeness',
          label: 'Catalog completeness',
          status: 'fail',
          blocker_reasons: ['title_track_resolved overall=67.9'],
          summary_lines: [],
        },
      ],
    },
    runtimeGate: {
      runtime_checks: {
        projection_freshness: { status: 'fail' },
        worker_cadence: { status: 'fail' },
      },
      stage_gates: { shadow_to_web_cutover: 'fail' },
    },
    parityReport: {
      checks: {
        latest_verified_release_selection: { stream_mismatches_count: 0 },
        youtube_allowlists: { clean: false },
        title_tracks_and_double_title: { clean: false },
        release_service_links: { clean: false },
        review_required_counts: { clean: false },
      },
    },
    historicalCoverageReport: {
      cutover_gates: {
        gates: {
          title_track_resolved: { observed_total: 0.6785 },
          canonical_mv: { observed_total: 0.0864 },
        },
      },
      migration_priority_slice: { gates: { cutover_status: 'pass' } },
    },
    nullCoverageReport: {
      field_family_summary: [
        {
          field_family_key: 'entities.representative_image',
          field_label: 'Representative Image',
          populated_records: 0,
          unresolved_records: 117,
          effective_coverage_ratio: 0,
        },
        {
          field_family_key: 'release_service_links.youtube_mv',
          field_label: 'YouTube MV Canonical Link',
          populated_records: 27,
          unresolved_records: 1744,
          effective_coverage_ratio: 0.0152,
        },
      ],
    },
    workerCadenceReport: {
      summary_lines: ['[primary] daily_upcoming: cadence=daily, status=scheduled_evidence_missing'],
    },
    allowlistRows: [
      { mv_source_channels: [{ channel_url: 'https://www.youtube.com/@one' }] },
      { mv_source_channels: [] },
    ],
    artistProfiles: [
      { debut_year: 2024, representative_image_url: '' },
      { debut_year: '', representative_image_url: '' },
    ],
    runtimeFacingDuplicateArtifacts: ['web/src/data/releaseDetails 2.json'],
  });

  assert.equal(report.parent_issue.number, 529);
  assert.equal(report.baseline_comparison[0].status, 'resolved');
  assert.equal(report.current_snapshot.mv_source_channels_populated, 1);
  assert.equal(report.blocker_mapping[0].issues[0].number, 600);
  assert.equal(report.related_operational_followups[0].number, 525);
});

test('renderBackendGapAuditMarkdown renders blocker follow-up links', () => {
  const markdown = renderBackendGapAuditMarkdown({
    generated_at: '2026-03-11T00:00:00.000Z',
    parent_issue: {
      number: 529,
      closure_recommendation: 'close_parent_keep_children_open',
    },
    summary_lines: ['parent issue #529 audit status: audit_complete'],
    baseline_comparison: [
      {
        label: 'Latest verified release selection drift count',
        baseline: 3,
        current: 0,
        status: 'resolved',
      },
    ],
    blocker_mapping: [
      {
        label: 'Backend runtime health',
        status: 'fail',
        blocker_reasons: ['projection_freshness=fail'],
        issues: [
          {
            number: 600,
            url: 'https://github.com/iAmSomething/idol-song-app/issues/600',
            title: 'Runtime health follow-up',
          },
        ],
      },
    ],
    related_operational_followups: [
      {
        number: 525,
        url: 'https://github.com/iAmSomething/idol-song-app/issues/525',
        title: 'Preview backend URL',
      },
    ],
    resolved_workstreams: [
      {
        label: 'Latest verified release selection drift cleared',
        issues: [{ number: 532 }],
      },
    ],
    runtime_facing_duplicate_artifacts: ['web/src/data/releaseDetails 2.json'],
    catalog_completeness_details: {
      null_field_families: [
        {
          field_label: 'Representative Image',
          effective_coverage_percent: 0,
          unresolved_records: 117,
        },
      ],
    },
  });

  assert.match(markdown, /# Backend Gap Audit Report/);
  assert.match(markdown, /\[#600\]\(https:\/\/github.com\/iAmSomething\/idol-song-app\/issues\/600\)/);
  assert.match(markdown, /Latest verified release selection drift cleared: #532/);
});
