const ISSUE_BASELINE = {
  parent_issue_number: 529,
  parent_issue_url: 'https://github.com/iAmSomething/idol-song-app/issues/529',
  readiness_score_percent: 59.9,
  latest_verified_release_selection_drift: 3,
  title_track_resolved_percent: 64.5,
  canonical_mv_percent: 6.3,
  allowlist_rows: 117,
  mv_source_channels_populated: 0,
  artist_profile_rows: 117,
  debut_year_populated: 8,
  representative_image_populated: 0,
};

const DIRECT_BLOCKER_FOLLOWUPS = [
  {
    key: 'backend_runtime_health',
    issues: [
      {
        number: 600,
        title: 'Restore backend runtime-health cutover gate by clearing projection freshness lag and scheduled worker cadence evidence',
      },
    ],
  },
  {
    key: 'backend_deploy_parity',
    issues: [
      {
        number: 602,
        title: 'Resolve backend deploy parity drift for YouTube allowlists, title-track/service-link state, and review-required counts',
      },
    ],
  },
  {
    key: 'web_backend_only_stability',
    issues: [
      {
        number: 601,
        title: 'Close remaining backend-only shadow drift on web entity detail and release detail surfaces',
      },
    ],
  },
  {
    key: 'catalog_completeness',
    issues: [
      {
        number: 603,
        title: 'Raise catalog completeness for title-track, MV, official-link, and visual metadata blocker cohorts',
      },
      {
        number: 538,
        title: 'Integrate collected social links, agency names, and debut-year metadata into canonical entity data with provenance and review states',
      },
      {
        number: 539,
        title: 'Backfill representative entity images and broaden release artwork coverage beyond the latest-snapshot subset',
      },
      {
        number: 580,
        title: 'Define export-import manual curation bundles for unresolved canonical nulls across key field families',
      },
    ],
  },
];

const RELATED_OPERATIONAL_FOLLOWUPS = [
  {
    number: 525,
    title: '[RN] Provision a stable public preview backend URL for external iPhone and Android device testing',
  },
  {
    number: 540,
    title: 'Remove duplicate generated artifacts and define one canonical retention policy for runtime-facing JSON and pipeline scripts',
  },
];

const RESOLVED_WORKSTREAMS = [
  {
    key: 'latest_verified_release_selection',
    label: 'Latest verified release selection drift cleared',
    issues: [532],
  },
  {
    key: 'historical_release_enrichment_and_mv_allowlists',
    label: 'Historical release enrichment and MV allowlist foundation landed',
    issues: [534, 535, 536, 537, 591],
  },
  {
    key: 'trusted_upcoming_notification_runtime',
    label: 'Trusted upcoming notification event and push runtime path landed',
    issues: [554, 556, 557, 558, 559, 560, 561],
  },
  {
    key: 'null_hygiene_and_gap_workbenches',
    label: 'Null hygiene cadence, workbench, and bundle reporting landed',
    issues: [566, 567, 568, 569, 570, 571, 572, 573, 574, 575, 577, 578, 579, 582, 583],
  },
  {
    key: 'worker_cadence_gate_foundation',
    label: 'Worker cadence / runtime gate semantics were added even though operational pass is still pending',
    issues: [530],
  },
];

function formatIssueUrl(number) {
  return `https://github.com/iAmSomething/idol-song-app/issues/${number}`;
}

function roundToOneDecimal(value) {
  return Number(Number(value).toFixed(1));
}

function ratioToPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return roundToOneDecimal(value * 100);
}

function findCategory(scorecard, key) {
  return scorecard.categories.find((category) => category.key === key) ?? null;
}

function findField(fieldSummary, key) {
  return fieldSummary.find((entry) => entry.field_family_key === key) ?? null;
}

function buildIssueEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    url: formatIssueUrl(entry.number),
  }));
}

function compareMetric({ key, label, baseline, current }) {
  let status = 'unchanged';
  if (typeof baseline === 'number' && typeof current === 'number') {
    if (current === baseline) {
      status = 'unchanged';
    } else if (current > baseline) {
      status = 'improved';
    } else {
      status = 'regressed';
    }
  }
  if (key === 'latest_verified_release_selection_drift') {
    if (current === 0 && baseline > 0) {
      status = 'resolved';
    } else if (current < baseline) {
      status = 'improved';
    }
  }
  if (key === 'representative_image_populated' && current === baseline) {
    status = 'unchanged';
  }
  return {
    key,
    label,
    baseline,
    current,
    delta:
      typeof baseline === 'number' && typeof current === 'number'
        ? roundToOneDecimal(current - baseline)
        : null,
    status,
  };
}

export function buildBackendGapAuditReport({
  scorecard,
  runtimeGate,
  parityReport,
  historicalCoverageReport,
  nullCoverageReport,
  workerCadenceReport,
  allowlistRows,
  artistProfiles,
  runtimeFacingDuplicateArtifacts,
}) {
  const runtimeCategory = findCategory(scorecard, 'backend_runtime_health');
  const parityCategory = findCategory(scorecard, 'backend_deploy_parity');
  const webCategory = findCategory(scorecard, 'web_backend_only_stability');
  const catalogCategory = findCategory(scorecard, 'catalog_completeness');

  const runtimeChecks = runtimeGate.runtime_checks ?? {};
  const stageGates = runtimeGate.stage_gates ?? {};
  const parityChecks = parityReport.checks ?? {};
  const historicalCutoverGates = historicalCoverageReport.cutover_gates?.gates ?? {};
  const nullFieldSummary = nullCoverageReport.field_family_summary ?? [];

  const currentSnapshot = {
    readiness_score_percent: scorecard.overall?.score_percent ?? null,
    readiness_status: scorecard.overall?.status ?? null,
    latest_verified_release_selection_drift:
      parityChecks.latest_verified_release_selection?.stream_mismatches_count ?? null,
    title_track_resolved_percent: ratioToPercent(historicalCutoverGates.title_track_resolved?.observed_total ?? null),
    canonical_mv_percent: ratioToPercent(historicalCutoverGates.canonical_mv?.observed_total ?? null),
    allowlist_rows: allowlistRows.length,
    mv_source_channels_populated: allowlistRows.filter((row) => Array.isArray(row.mv_source_channels) && row.mv_source_channels.length > 0).length,
    artist_profile_rows: artistProfiles.length,
    debut_year_populated: artistProfiles.filter((row) => row.debut_year !== null && row.debut_year !== undefined && String(row.debut_year).trim() !== '').length,
    representative_image_populated: artistProfiles.filter((row) => typeof row.representative_image_url === 'string' && row.representative_image_url.trim().length > 0).length,
    runtime_facing_duplicate_artifact_count: runtimeFacingDuplicateArtifacts.length,
  };

  const baselineComparison = [
    compareMetric({
      key: 'latest_verified_release_selection_drift',
      label: 'Latest verified release selection drift count',
      baseline: ISSUE_BASELINE.latest_verified_release_selection_drift,
      current: currentSnapshot.latest_verified_release_selection_drift,
    }),
    compareMetric({
      key: 'title_track_resolved_percent',
      label: 'Historical title-track resolved coverage (%)',
      baseline: ISSUE_BASELINE.title_track_resolved_percent,
      current: currentSnapshot.title_track_resolved_percent,
    }),
    compareMetric({
      key: 'canonical_mv_percent',
      label: 'Historical canonical MV coverage (%)',
      baseline: ISSUE_BASELINE.canonical_mv_percent,
      current: currentSnapshot.canonical_mv_percent,
    }),
    compareMetric({
      key: 'mv_source_channels_populated',
      label: 'Rows with mv_source_channels populated',
      baseline: ISSUE_BASELINE.mv_source_channels_populated,
      current: currentSnapshot.mv_source_channels_populated,
    }),
    compareMetric({
      key: 'debut_year_populated',
      label: 'Artist profiles with debut_year populated',
      baseline: ISSUE_BASELINE.debut_year_populated,
      current: currentSnapshot.debut_year_populated,
    }),
    compareMetric({
      key: 'representative_image_populated',
      label: 'Artist profiles with representative_image_url populated',
      baseline: ISSUE_BASELINE.representative_image_populated,
      current: currentSnapshot.representative_image_populated,
    }),
  ];

  const blockerMapping = DIRECT_BLOCKER_FOLLOWUPS.map((followup) => {
    const category =
      followup.key === 'backend_runtime_health'
        ? runtimeCategory
        : followup.key === 'backend_deploy_parity'
          ? parityCategory
          : followup.key === 'web_backend_only_stability'
            ? webCategory
            : catalogCategory;
    return {
      key: followup.key,
      label: category?.label ?? followup.key,
      status: category?.status ?? null,
      blocker_reasons: category?.blocker_reasons ?? [],
      summary_lines: category?.summary_lines ?? [],
      issues: buildIssueEntries(followup.issues),
    };
  });

  const nullFieldFamilies = ['release_service_links.youtube_mv', 'releases.title_track', 'entities.official_youtube', 'entities.debut_year', 'entities.representative_image']
    .map((key) => findField(nullFieldSummary, key))
    .filter(Boolean)
    .map((entry) => ({
      field_family_key: entry.field_family_key,
      field_label: entry.field_label,
      populated_records: entry.populated_records,
      unresolved_records: entry.unresolved_records,
      effective_coverage_percent: ratioToPercent(entry.effective_coverage_ratio),
    }));

  const auditStatus = blockerMapping.every((entry) => entry.issues.length > 0) ? 'audit_complete' : 'audit_incomplete';

  const summaryLines = [
    `parent issue #${ISSUE_BASELINE.parent_issue_number} audit status: ${auditStatus}`,
    `current readiness score: ${currentSnapshot.readiness_score_percent}% (${currentSnapshot.readiness_status})`,
    `baseline deltas: latest release drift ${ISSUE_BASELINE.latest_verified_release_selection_drift} -> ${currentSnapshot.latest_verified_release_selection_drift}, title-track ${ISSUE_BASELINE.title_track_resolved_percent}% -> ${currentSnapshot.title_track_resolved_percent}%, canonical MV ${ISSUE_BASELINE.canonical_mv_percent}% -> ${currentSnapshot.canonical_mv_percent}%`,
    `allowlist progress: mv_source_channels ${ISSUE_BASELINE.mv_source_channels_populated}/${ISSUE_BASELINE.allowlist_rows} -> ${currentSnapshot.mv_source_channels_populated}/${currentSnapshot.allowlist_rows}`,
    `entity metadata unchanged: debut_year ${currentSnapshot.debut_year_populated}/${currentSnapshot.artist_profile_rows}, representative_image ${currentSnapshot.representative_image_populated}/${currentSnapshot.artist_profile_rows}`,
    `runtime-facing duplicate artifacts still present: ${currentSnapshot.runtime_facing_duplicate_artifact_count}`,
    'direct blocker follow-ups: #600 backend runtime health, #601 web backend-only stability, #602 backend deploy parity, #603 catalog completeness',
  ];

  return {
    generated_at: new Date().toISOString(),
    parent_issue: {
      number: ISSUE_BASELINE.parent_issue_number,
      url: ISSUE_BASELINE.parent_issue_url,
      audit_status: auditStatus,
      closure_recommendation: auditStatus === 'audit_complete' ? 'close_parent_keep_children_open' : 'keep_open',
    },
    baseline_snapshot: ISSUE_BASELINE,
    current_snapshot: currentSnapshot,
    baseline_comparison: baselineComparison,
    blocker_mapping: blockerMapping,
    related_operational_followups: buildIssueEntries(RELATED_OPERATIONAL_FOLLOWUPS),
    resolved_workstreams: RESOLVED_WORKSTREAMS.map((entry) => ({
      key: entry.key,
      label: entry.label,
      issues: entry.issues.map((number) => ({
        number,
        url: formatIssueUrl(number),
      })),
    })),
    runtime_details: {
      projection_freshness: runtimeChecks.projection_freshness ?? null,
      worker_cadence: runtimeChecks.worker_cadence ?? null,
      stage_gates: stageGates,
      worker_cadence_summary: workerCadenceReport.summary_lines ?? [],
    },
    deploy_parity_details: {
      youtube_allowlists: parityChecks.youtube_allowlists ?? null,
      latest_verified_release_selection: parityChecks.latest_verified_release_selection ?? null,
      title_tracks_and_double_title: parityChecks.title_tracks_and_double_title ?? null,
      release_service_links: parityChecks.release_service_links ?? null,
      review_required_counts: parityChecks.review_required_counts ?? null,
    },
    catalog_completeness_details: {
      cutover_gates: historicalCoverageReport.cutover_gates ?? null,
      migration_priority_slice: historicalCoverageReport.migration_priority_slice?.gates ?? null,
      null_field_families: nullFieldFamilies,
    },
    runtime_facing_duplicate_artifacts: runtimeFacingDuplicateArtifacts,
    summary_lines: summaryLines,
  };
}

export function renderBackendGapAuditMarkdown(report) {
  const lines = [
    '# Backend Gap Audit Report',
    '',
    `- generated_at: ${report.generated_at}`,
    `- parent_issue: #${report.parent_issue.number}`,
    `- closure_recommendation: ${report.parent_issue.closure_recommendation}`,
    '',
    '## Summary',
    '',
    ...report.summary_lines.map((line) => `- ${line}`),
    '',
    '## Baseline vs Current',
    '',
    '| Metric | Baseline | Current | Status |',
    '| --- | ---: | ---: | --- |',
    ...report.baseline_comparison.map(
      (entry) => `| ${entry.label} | ${entry.baseline} | ${entry.current} | ${entry.status} |`,
    ),
    '',
    '## Blocker Mapping',
    '',
  ];

  for (const blocker of report.blocker_mapping) {
    lines.push(`### ${blocker.label}`);
    lines.push('');
    lines.push(`- status: ${blocker.status}`);
    for (const reason of blocker.blocker_reasons) {
      lines.push(`- blocker_reason: ${reason}`);
    }
    for (const issue of blocker.issues) {
      lines.push(`- follow_up: [#${issue.number}](${issue.url}) ${issue.title}`);
    }
    lines.push('');
  }

  lines.push('## Related Operational Follow-ups');
  lines.push('');
  for (const issue of report.related_operational_followups) {
    lines.push(`- [#${issue.number}](${issue.url}) ${issue.title}`);
  }
  lines.push('');
  lines.push('## Resolved Workstreams');
  lines.push('');
  for (const item of report.resolved_workstreams) {
    lines.push(`- ${item.label}: ${item.issues.map((issue) => `#${issue.number}`).join(', ')}`);
  }
  lines.push('');
  lines.push('## Runtime-facing Duplicate Artifacts');
  lines.push('');
  for (const item of report.runtime_facing_duplicate_artifacts) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## Null Hygiene Snapshot');
  lines.push('');
  for (const item of report.catalog_completeness_details.null_field_families) {
    lines.push(
      `- ${item.field_label}: coverage ${item.effective_coverage_percent}%, unresolved ${item.unresolved_records}`,
    );
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}
