import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateCoverageRecords,
  buildCoverageReport,
  buildNullCoverageEvaluation,
  buildRecheckQueue,
  buildTrendHistorySnapshot,
  buildTrendReport,
  inferEntityCohort,
  inferReleaseCohort,
  isPlaceholderText,
  isPlaceholderUrl,
} from './canonicalNullCoverage.mjs';

test('placeholder detection catches placeholder text and urls', () => {
  assert.equal(isPlaceholderText('TBD'), true);
  assert.equal(isPlaceholderText('SM Entertainment'), false);
  assert.equal(isPlaceholderUrl('https://example.com/avatar.png'), true);
  assert.equal(isPlaceholderUrl('https://www.youtube.com/@official_TUNEXX'), false);
});

test('cohort inference uses release recency and active upcoming hint', () => {
  const referenceDate = new Date('2026-03-11T00:00:00Z');
  assert.equal(inferReleaseCohort('2026-02-01', referenceDate), 'latest');
  assert.equal(inferReleaseCohort('2024-10-01', referenceDate), 'recent');
  assert.equal(inferReleaseCohort('2021-06-01', referenceDate), 'historical');
  assert.equal(inferEntityCohort('2021-06-01', true, referenceDate), 'latest');
});

test('aggregate coverage excludes acceptable null from actionable denominator', () => {
  const aggregates = aggregateCoverageRecords(
    [
      { field_family_key: 'a', field_label: 'A', table_name: 'entities', taxonomy_bucket: 'required_backfill', product_criticality: 'wave_1', status: 'populated' },
      { field_family_key: 'a', field_label: 'A', table_name: 'entities', taxonomy_bucket: 'required_backfill', product_criticality: 'wave_1', status: 'acceptable_null' },
      { field_family_key: 'a', field_label: 'A', table_name: 'entities', taxonomy_bucket: 'required_backfill', product_criticality: 'wave_1', status: 'unresolved' },
    ],
    ['field_family_key', 'field_label', 'table_name', 'taxonomy_bucket', 'product_criticality'],
  );
  assert.equal(aggregates[0].actionable_records, 2);
  assert.equal(aggregates[0].effective_coverage_ratio, 0.5);
});

test('recheck queue escalates after repeated unresolved checks', () => {
  const generatedAt = '2026-03-11T08:00:00.000Z';
  const records = [
    {
      queue_key: 'release_service_links|release_service_links.youtube_mv|release-1:youtube_mv',
      record_type: 'release',
      record_id: 'release-1:youtube_mv',
      table_name: 'release_service_links',
      field_family_key: 'release_service_links.youtube_mv',
      field_label: 'YouTube MV Canonical Link',
      taxonomy_bucket: 'required_backfill',
      product_criticality: 'wave_1',
      cohort: 'latest',
      entity_type: 'group',
      entity_slug: 'blackpink',
      entity_id: 'entity-1',
      release_id: 'release-1',
      release_title: 'DEADLINE',
      release_date: '2026-02-27',
      release_kind: 'ep',
      upcoming_signal_id: null,
      status: 'unresolved',
      status_reason: 'missing_service_row',
      validation_rule: null,
      source_value: null,
    },
  ];
  const previousQueue = [
    {
      queue_key: records[0].queue_key,
      first_seen_at: '2026-03-01T08:00:00.000Z',
      last_checked_at: '2026-03-10T08:00:00.000Z',
      retry_count: 2,
      review_state: 'needs_retry',
    },
  ];
  const queue = buildRecheckQueue(records, previousQueue, generatedAt);
  assert.equal(queue[0].retry_count, 3);
  assert.equal(queue[0].review_state, 'escalate_review');
});

test('trend report highlights critical regressions when baseline exists', () => {
  const currentReport = {
    generated_at: '2026-03-11T08:00:00.000Z',
    field_family_summary: [],
    slices: {
      by_cohort: [
        {
          field_family_key: 'release_service_links.youtube_mv',
          cohort: 'latest',
          effective_coverage_ratio: 0.7,
          unresolved_records: 30,
          fake_default_records: 0,
          product_criticality: 'wave_1',
        },
      ],
    },
  };
  const history = {
    snapshots: [
      {
        generated_at: '2026-03-04T08:00:00.000Z',
        field_family_summary: [],
        by_cohort: [
          {
            field_family_key: 'release_service_links.youtube_mv',
            cohort: 'latest',
            effective_coverage_ratio: 0.8,
            unresolved_records: 20,
            fake_default_records: 0,
            product_criticality: 'wave_1',
          },
        ],
      },
      buildTrendHistorySnapshot(currentReport),
    ],
  };

  const trend = buildTrendReport(currentReport, history);
  assert.equal(trend.baseline_available, true);
  assert.equal(trend.critical_regressions.length, 1);
  assert.equal(trend.critical_regressions[0].field_family_key, 'release_service_links.youtube_mv');
});

test('null coverage evaluation fails on latest wave-1 floor misses and fake defaults', () => {
  const coverageReport = buildCoverageReport(
    [
      {
        table_name: 'release_service_links',
        field_family_key: 'release_service_links.youtube_mv',
        field_label: 'YouTube MV Canonical Link',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'fake_default',
        cohort: 'latest',
        entity_type: 'group',
        release_year: 2026,
        release_kind: 'ep',
      },
      {
        table_name: 'release_service_links',
        field_family_key: 'release_service_links.youtube_mv',
        field_label: 'YouTube MV Canonical Link',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'unresolved',
        cohort: 'latest',
        entity_type: 'group',
        release_year: 2026,
        release_kind: 'ep',
      },
      {
        table_name: 'releases',
        field_family_key: 'releases.title_track',
        field_label: 'Title Track Resolution',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
        release_year: 2026,
        release_kind: 'ep',
      },
      {
        table_name: 'entities',
        field_family_key: 'entities.official_youtube',
        field_label: 'Official YouTube',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
      },
      {
        table_name: 'entities',
        field_family_key: 'entities.official_x',
        field_label: 'Official X',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
      },
      {
        table_name: 'entities',
        field_family_key: 'entities.official_instagram',
        field_label: 'Official Instagram',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
      },
      {
        table_name: 'release_service_links',
        field_family_key: 'release_service_links.youtube_music',
        field_label: 'YouTube Music Release Link',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
        release_year: 2026,
        release_kind: 'ep',
      },
      {
        table_name: 'release_service_links',
        field_family_key: 'release_service_links.spotify',
        field_label: 'Spotify Release Link',
        taxonomy_bucket: 'required_backfill',
        product_criticality: 'wave_1',
        status: 'populated',
        cohort: 'latest',
        entity_type: 'group',
        release_year: 2026,
        release_kind: 'ep',
      },
    ],
    new Date('2026-03-11T00:00:00Z'),
  );

  const trendReport = {
    baseline_available: true,
    critical_regressions: [],
  };

  const evaluation = buildNullCoverageEvaluation(coverageReport, trendReport);
  assert.equal(evaluation.status, 'fail');
  assert.ok(evaluation.blocker_reasons.some((entry) => entry.includes('release_service_links.youtube_mv')));
});
