#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');

const DEFAULT_RUNTIME_GATE_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'runtime_gate_report.json');
const DEFAULT_PARITY_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_json_parity_report.json');
const DEFAULT_SHADOW_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'backend_shadow_read_report.json');
const DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH = path.join(
  BACKEND_DIR,
  'reports',
  'historical_release_detail_coverage_report.json',
);
const DEFAULT_FIXTURE_REGISTRY_PATH = path.join(BACKEND_DIR, 'fixtures', 'live_backend_smoke_fixtures.json');
const DEFAULT_BACKEND_DEPLOY_WORKFLOW_PATH = path.join(REPO_DIR, '.github', 'workflows', 'backend-deploy.yml');
const DEFAULT_MOBILE_RUNTIME_CONFIG_PATH = path.join(REPO_DIR, 'mobile', 'src', 'config', 'runtime.ts');
const DEFAULT_MOBILE_DATASET_SOURCE_PATH = path.join(REPO_DIR, 'mobile', 'src', 'services', 'datasetSource.ts');
const DEFAULT_MOBILE_DEBUG_METADATA_PATH = path.join(REPO_DIR, 'mobile', 'src', 'config', 'debugMetadata.ts');
const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'migration_readiness_scorecard.json');
const DEFAULT_MARKDOWN_PATH = path.join(BACKEND_DIR, 'reports', 'migration_readiness_scorecard.md');

const CATEGORY_STATUS_SCORES = {
  pass: 1,
  needs_review: 0.6,
  fail: 0,
};

const READINESS_RUBRIC = {
  overall: {
    passThreshold: 0.85,
    reviewThreshold: 0.6,
    blockerPolicy: 'Any blocker-grade category in fail blocks cutover regardless of overall score.',
  },
  categories: [
    {
      key: 'backend_runtime_health',
      label: 'Backend runtime health',
      weight: 25,
      blocker: true,
      statusThresholds: {
        pass: 0.85,
        needs_review: 0.6,
      },
      blockerRule:
        'Any runtime sub-check in fail blocks cutover. Backend runtime is not ready when latency/error/freshness/cadence evidence still contains a hard fail.',
    },
    {
      key: 'backend_deploy_parity',
      label: 'Backend deploy parity',
      weight: 20,
      blocker: true,
      statusThresholds: {
        pass: 0.85,
        needs_review: 0.6,
      },
      blockerRule:
        'Parity must be clean. Canonical fixture smoke and workflow hard gates are required, but they do not offset drift in backend-vs-export parity.',
    },
    {
      key: 'web_backend_only_stability',
      label: 'Web backend-only stability',
      weight: 20,
      blocker: true,
      statusThresholds: {
        pass: 0.9,
        needs_review: 0.75,
      },
      blockerRule:
        'Critical web shadow surfaces (entity detail, release detail, calendar month, radar) must be fully clean before calling backend-only cutover stable.',
    },
    {
      key: 'mobile_runtime_mode',
      label: 'Mobile runtime mode',
      weight: 15,
      blocker: true,
      statusThresholds: {
        pass: 0.85,
        needs_review: 0.6,
      },
      blockerRule:
        'Preview and production mobile profiles must default to backend-api, and bundled-static cannot remain the normal shipping mode outside development or degraded fallback.',
    },
    {
      key: 'catalog_completeness',
      label: 'Catalog completeness',
      weight: 20,
      blocker: true,
      statusThresholds: {
        pass: 0.85,
        needs_review: 0.6,
      },
      blockerRule:
        'Detail payload coverage alone is insufficient. Title-track and canonical MV completeness must hit migration-ready thresholds, especially for pre-2024 history.',
    },
  ],
};

function parseArgs(argv) {
  const options = {
    runtimeGateReportPath: DEFAULT_RUNTIME_GATE_REPORT_PATH,
    parityReportPath: DEFAULT_PARITY_REPORT_PATH,
    shadowReportPath: DEFAULT_SHADOW_REPORT_PATH,
    historicalCoverageReportPath: DEFAULT_HISTORICAL_COVERAGE_REPORT_PATH,
    fixtureRegistryPath: DEFAULT_FIXTURE_REGISTRY_PATH,
    backendDeployWorkflowPath: DEFAULT_BACKEND_DEPLOY_WORKFLOW_PATH,
    mobileRuntimeConfigPath: DEFAULT_MOBILE_RUNTIME_CONFIG_PATH,
    mobileDatasetSourcePath: DEFAULT_MOBILE_DATASET_SOURCE_PATH,
    mobileDebugMetadataPath: DEFAULT_MOBILE_DEBUG_METADATA_PATH,
    reportPath: DEFAULT_REPORT_PATH,
    markdownPath: DEFAULT_MARKDOWN_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case '--runtime-gate-report':
        options.runtimeGateReportPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--parity-report':
        options.parityReportPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--shadow-report':
        options.shadowReportPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--historical-coverage-report':
        options.historicalCoverageReportPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--fixture-registry':
        options.fixtureRegistryPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--backend-deploy-workflow':
        options.backendDeployWorkflowPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--mobile-runtime-config':
        options.mobileRuntimeConfigPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--mobile-dataset-source':
        options.mobileDatasetSourcePath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--mobile-debug-metadata':
        options.mobileDebugMetadataPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--report-path':
        options.reportPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      case '--markdown-path':
        options.markdownPath = path.resolve(REPO_DIR, next ?? '');
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function clamp(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asPercent(value) {
  return round(clamp(value) * 100, 1);
}

function scoreFromStatus(status) {
  return CATEGORY_STATUS_SCORES[status] ?? 0;
}

function getCategoryConfig(key) {
  const config = READINESS_RUBRIC.categories.find((entry) => entry.key === key);
  if (!config) {
    throw new Error(`Missing category config for ${key}`);
  }
  return config;
}

function deriveStatusFromScore(score, thresholds) {
  if (score >= thresholds.pass) {
    return 'pass';
  }

  if (score >= thresholds.needs_review) {
    return 'needs_review';
  }

  return 'fail';
}

function normalizePathForReport(filePath) {
  return path.relative(REPO_DIR, filePath) || '.';
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readText(filePath) {
  return readFile(filePath, 'utf8');
}

function extractSurfaceRatios(shadowReport) {
  const totals = {};
  const cleanCounts = {};

  for (const caseEntry of shadowReport.cases ?? []) {
    const surface = caseEntry.surface;
    totals[surface] = (totals[surface] ?? 0) + 1;
    if (caseEntry.clean === true) {
      cleanCounts[surface] = (cleanCounts[surface] ?? 0) + 1;
    }
  }

  const ratios = {};
  for (const [surface, total] of Object.entries(totals)) {
    ratios[surface] = {
      total,
      clean: cleanCounts[surface] ?? 0,
      ratio: total > 0 ? (cleanCounts[surface] ?? 0) / total : 0,
    };
  }

  return ratios;
}

function buildBackendRuntimeCategory(runtimeGateReport) {
  const config = getCategoryConfig('backend_runtime_health');
  const runtimeChecks = runtimeGateReport.runtime_checks ?? {};
  const subcheckWeights = {
    api_latency: 0.25,
    api_error_rate: 0.2,
    projection_freshness: 0.25,
    worker_cadence: 0.3,
  };

  const weightedScore = Object.entries(subcheckWeights).reduce((sum, [key, weight]) => {
    return sum + scoreFromStatus(runtimeChecks[key]?.status) * weight;
  }, 0);

  const failReasons = [];
  for (const [key, weight] of Object.entries(subcheckWeights)) {
    if (runtimeChecks[key]?.status === 'fail') {
      failReasons.push(`${key}=${runtimeChecks[key].status}`);
    }
  }

  const blockerReasons = [...failReasons];
  if (runtimeGateReport.stage_gates?.shadow_to_web_cutover === 'fail') {
    blockerReasons.push('stage_gate:shadow_to_web_cutover=fail');
  }
  if (runtimeGateReport.stage_gates?.web_cutover_to_json_demotion === 'fail') {
    blockerReasons.push('stage_gate:web_cutover_to_json_demotion=fail');
  }

  const status = blockerReasons.length > 0 ? 'fail' : deriveStatusFromScore(weightedScore, config.statusThresholds);

  return {
    key: config.key,
    label: config.label,
    weight: config.weight,
    blocker: config.blocker,
    status,
    score_ratio: round(weightedScore, 4),
    score_percent: asPercent(weightedScore),
    weighted_points: round(weightedScore * config.weight, 2),
    blocker_reasons: blockerReasons,
    summary_lines: runtimeGateReport.summary_lines ?? [],
    evidence: {
      runtime_checks: runtimeChecks,
      stage_gates: runtimeGateReport.stage_gates ?? {},
    },
  };
}

function buildBackendDeployParityCategory(parityReport, fixtureRegistry, backendDeployWorkflowText) {
  const config = getCategoryConfig('backend_deploy_parity');
  const requiredSurfaces = ['search', 'calendar_month', 'radar', 'entity_detail', 'release_detail'];
  const fixtureSurfaces = new Set((fixtureRegistry.fixtures ?? []).map((fixture) => fixture.surface));
  const fixtureCoverageComplete = requiredSurfaces.every((surface) => fixtureSurfaces.has(surface));
  const workflowHasPreviewSmoke =
    backendDeployWorkflowText.includes('Run preview canonical fixture smoke checks') &&
    backendDeployWorkflowText.includes('live_backend_smoke_preview.json') &&
    backendDeployWorkflowText.includes('npm run smoke:live -- --target preview');
  const workflowHasProductionSmoke =
    backendDeployWorkflowText.includes('Run production canonical fixture smoke checks') &&
    backendDeployWorkflowText.includes('live_backend_smoke_production.json') &&
    backendDeployWorkflowText.includes('npm run smoke:live -- --target production');
  const workflowGateConfigured = workflowHasPreviewSmoke && workflowHasProductionSmoke;

  const weightedScore =
    (parityReport.clean === true ? 1 : 0) * 0.6 +
    (fixtureCoverageComplete ? 1 : 0) * 0.2 +
    (workflowGateConfigured ? 1 : 0) * 0.2;

  const blockerReasons = [];
  if (parityReport.clean !== true) {
    const driftCount = parityReport.checks?.latest_verified_release_selection?.stream_mismatches_count ?? 0;
    blockerReasons.push(`parity_clean=false (latest_verified_release_selection drift=${driftCount})`);
  }
  if (!fixtureCoverageComplete) {
    blockerReasons.push('canonical_fixture_registry_incomplete');
  }
  if (!workflowGateConfigured) {
    blockerReasons.push('backend_deploy_smoke_gate_missing');
  }

  const status = blockerReasons.length > 0 ? 'fail' : deriveStatusFromScore(weightedScore, config.statusThresholds);

  return {
    key: config.key,
    label: config.label,
    weight: config.weight,
    blocker: config.blocker,
    status,
    score_ratio: round(weightedScore, 4),
    score_percent: asPercent(weightedScore),
    weighted_points: round(weightedScore * config.weight, 2),
    blocker_reasons: blockerReasons,
    summary_lines: parityReport.summary_lines ?? [],
    evidence: {
      parity_clean: parityReport.clean === true,
      fixture_registry_surfaces: Array.from(fixtureSurfaces).sort(),
      fixture_registry_complete: fixtureCoverageComplete,
      workflow_gate_configured: workflowGateConfigured,
      parity_drift_checks: parityReport.checks?.latest_verified_release_selection ?? null,
    },
  };
}

function buildWebBackendOnlyStabilityCategory(shadowReport) {
  const config = getCategoryConfig('web_backend_only_stability');
  const surfaceRatios = extractSurfaceRatios(shadowReport);
  const weights = {
    search: 0.15,
    calendar_month: 0.2,
    radar: 0.1,
    entity_detail: 0.25,
    release_detail: 0.3,
  };

  const weightedScore = Object.entries(weights).reduce((sum, [surface, weight]) => {
    return sum + (surfaceRatios[surface]?.ratio ?? 0) * weight;
  }, 0);

  const blockerReasons = [];
  for (const criticalSurface of ['entity_detail', 'release_detail', 'calendar_month', 'radar']) {
    const ratio = surfaceRatios[criticalSurface]?.ratio ?? 0;
    if (ratio < 1) {
      blockerReasons.push(`${criticalSurface} clean_ratio=${round(ratio, 2)}`);
    }
  }

  const status = blockerReasons.length > 0 ? 'fail' : deriveStatusFromScore(weightedScore, config.statusThresholds);

  return {
    key: config.key,
    label: config.label,
    weight: config.weight,
    blocker: config.blocker,
    status,
    score_ratio: round(weightedScore, 4),
    score_percent: asPercent(weightedScore),
    weighted_points: round(weightedScore * config.weight, 2),
    blocker_reasons: blockerReasons,
    summary_lines: shadowReport.summary_lines ?? [],
    evidence: {
      clean: shadowReport.clean === true,
      coverage: shadowReport.coverage ?? {},
      surface_ratios: Object.fromEntries(
        Object.entries(surfaceRatios).map(([surface, value]) => [
          surface,
          {
            clean: value.clean,
            total: value.total,
            ratio: round(value.ratio, 4),
          },
        ]),
      ),
    },
  };
}

function parseExpectedModes(runtimeSourceText) {
  const match = runtimeSourceText.match(
    /const EXPECTED_MODE_BY_PROFILE:[\s\S]*?=\s*\{([\s\S]*?)\n\};/,
  );
  if (!match) {
    throw new Error('Could not locate EXPECTED_MODE_BY_PROFILE in mobile runtime config.');
  }

  const block = match[1];
  const extract = (profile) => {
    const profileMatch = block.match(new RegExp(`${profile}:\\s*'([^']+)'`));
    return profileMatch ? profileMatch[1] : null;
  };

  return {
    development: extract('development'),
    preview: extract('preview'),
    production: extract('production'),
  };
}

function buildMobileRuntimeModeCategory(runtimeSourceText, datasetSourceText, debugMetadataText) {
  const config = getCategoryConfig('mobile_runtime_mode');
  const expectedModes = parseExpectedModes(runtimeSourceText);
  const previewBackend = expectedModes.preview === 'backend-api';
  const productionBackend = expectedModes.production === 'backend-api';
  const developmentBundled = expectedModes.development === 'bundled-static';
  const backendPrimarySelection =
    datasetSourceText.includes("runtimeConfig.dataSource.mode === 'backend-api'") &&
    datasetSourceText.includes('return createBackendDatasetSelection');
  const bundledStaticNormalReleaseProfile = previewBackend === false || productionBackend === false;
  const debugPolicyAligned = debugMetadataText.includes('Backend API primary + bundled fallback');

  const weightedScore =
    (previewBackend ? 1 : 0) * 0.35 +
    (productionBackend ? 1 : 0) * 0.35 +
    (backendPrimarySelection ? 1 : 0) * 0.2 +
    (developmentBundled ? 1 : 0) * 0.1;

  const blockerReasons = [];
  if (!previewBackend) {
    blockerReasons.push('preview profile is not backend-api');
  }
  if (!productionBackend) {
    blockerReasons.push('production profile is not backend-api');
  }
  if (!backendPrimarySelection) {
    blockerReasons.push('dataset selection is not backend-primary');
  }
  if (bundledStaticNormalReleaseProfile) {
    blockerReasons.push('bundled-static remains a normal release profile');
  }

  const status = blockerReasons.length > 0 ? 'fail' : deriveStatusFromScore(weightedScore, config.statusThresholds);

  return {
    key: config.key,
    label: config.label,
    weight: config.weight,
    blocker: config.blocker,
    status,
    score_ratio: round(weightedScore, 4),
    score_percent: asPercent(weightedScore),
    weighted_points: round(weightedScore * config.weight, 2),
    blocker_reasons: blockerReasons,
    summary_lines: [
      `profile defaults: development=${expectedModes.development}, preview=${expectedModes.preview}, production=${expectedModes.production}`,
      debugPolicyAligned
        ? 'debug metadata exposes backend-primary policy'
        : 'debug metadata does not expose backend-primary policy',
    ],
    evidence: {
      expected_modes: expectedModes,
      backend_primary_selection: backendPrimarySelection,
      debug_policy_aligned: debugPolicyAligned,
      bundled_static_primary_only_in_development: developmentBundled && previewBackend && productionBackend,
    },
  };
}

function buildCatalogCompletenessCategory(historicalCoverageReport) {
  const config = getCategoryConfig('catalog_completeness');
  const overall = historicalCoverageReport.completeness?.overall;
  const pre2024 = historicalCoverageReport.completeness?.pre_2024;
  const prioritySlice = historicalCoverageReport.migration_priority_slice;

  if (!overall || !pre2024) {
    throw new Error('Historical coverage report is missing completeness.overall or completeness.pre_2024.');
  }

  const titleTrackTarget = 0.85;
  const canonicalMvTarget = 0.35;
  const pre2024TitleTrackFloor = 0.75;
  const pre2024CanonicalMvFloor = 0.2;

  const payloadScore = clamp(overall.detail_payload_ratio / 1);
  const trustedScore = clamp(overall.detail_trusted_ratio / 1);
  const titleTrackScore = clamp(overall.title_track_resolved_ratio / titleTrackTarget);
  const canonicalMvScore = clamp(overall.canonical_mv_ratio / canonicalMvTarget);

  const weightedScore =
    payloadScore * 0.2 +
    trustedScore * 0.2 +
    titleTrackScore * 0.3 +
    canonicalMvScore * 0.3;

  const blockerReasons = [];
  if (overall.title_track_resolved_ratio < titleTrackTarget || pre2024.title_track_resolved_ratio < pre2024TitleTrackFloor) {
    blockerReasons.push(
      `title_track_resolved overall=${asPercent(overall.title_track_resolved_ratio)} pre_2024=${asPercent(pre2024.title_track_resolved_ratio)}`,
    );
  }
  if (overall.canonical_mv_ratio < canonicalMvTarget || pre2024.canonical_mv_ratio < pre2024CanonicalMvFloor) {
    blockerReasons.push(
      `canonical_mv overall=${asPercent(overall.canonical_mv_ratio)} pre_2024=${asPercent(pre2024.canonical_mv_ratio)}`,
    );
  }
  if (prioritySlice?.gates?.cutover_status === 'fail') {
    blockerReasons.push(
      `migration_priority_slice title_track=${asPercent(prioritySlice.after?.title_track_resolved_ratio ?? 0)} canonical_mv=${asPercent(prioritySlice.after?.canonical_mv_ratio ?? 0)}`,
    );
  }

  const status = blockerReasons.length > 0 ? 'fail' : deriveStatusFromScore(weightedScore, config.statusThresholds);
  const summaryLines = [...(historicalCoverageReport.summary_lines ?? [])];
  if (prioritySlice) {
    summaryLines.push(
      `migration_priority_slice rows=${prioritySlice.rows_after}/${prioritySlice.expected_rows} title_track=${asPercent(prioritySlice.after?.title_track_resolved_ratio ?? 0)} canonical_mv=${asPercent(prioritySlice.after?.canonical_mv_ratio ?? 0)} gate=${prioritySlice.gates?.cutover_status ?? 'unknown'}`,
    );
  }

  return {
    key: config.key,
    label: config.label,
    weight: config.weight,
    blocker: config.blocker,
    status,
    score_ratio: round(weightedScore, 4),
    score_percent: asPercent(weightedScore),
    weighted_points: round(weightedScore * config.weight, 2),
    blocker_reasons: blockerReasons,
    summary_lines: summaryLines,
    evidence: {
      overall: {
        detail_payload_ratio: round(overall.detail_payload_ratio, 4),
        detail_trusted_ratio: round(overall.detail_trusted_ratio, 4),
        title_track_resolved_ratio: round(overall.title_track_resolved_ratio, 4),
        canonical_mv_ratio: round(overall.canonical_mv_ratio, 4),
      },
      pre_2024: {
        detail_payload_ratio: round(pre2024.detail_payload_ratio, 4),
        detail_trusted_ratio: round(pre2024.detail_trusted_ratio, 4),
        title_track_resolved_ratio: round(pre2024.title_track_resolved_ratio, 4),
        canonical_mv_ratio: round(pre2024.canonical_mv_ratio, 4),
      },
      migration_priority_slice: prioritySlice
        ? {
            expected_rows: prioritySlice.expected_rows,
            rows_after: prioritySlice.rows_after,
            gates: prioritySlice.gates,
            after: {
              detail_payload_ratio: round(prioritySlice.after?.detail_payload_ratio ?? 0, 4),
              detail_trusted_ratio: round(prioritySlice.after?.detail_trusted_ratio ?? 0, 4),
              title_track_resolved_ratio: round(prioritySlice.after?.title_track_resolved_ratio ?? 0, 4),
              canonical_mv_ratio: round(prioritySlice.after?.canonical_mv_ratio ?? 0, 4),
            },
          }
        : null,
      review_queues: {
        title_track_review_rows: overall.title_track_review_rows,
        mv_review_rows: overall.mv_review_rows,
        title_track_unresolved_rows: overall.title_track_unresolved_rows,
        mv_unresolved_rows: overall.mv_unresolved_rows,
      },
    },
  };
}

function buildOverall(categories) {
  const totalWeight = categories.reduce((sum, category) => sum + category.weight, 0);
  const weightedPoints = categories.reduce((sum, category) => sum + category.weighted_points, 0);
  const scoreRatio = totalWeight > 0 ? weightedPoints / totalWeight : 0;
  const blockerCategories = categories.filter((category) => category.blocker && category.status === 'fail');
  let status = deriveStatusFromScore(scoreRatio, READINESS_RUBRIC.overall);
  if (blockerCategories.length > 0) {
    status = 'fail';
  }

  return {
    status,
    score_ratio: round(scoreRatio, 4),
    score_percent: asPercent(scoreRatio),
    weighted_points: round(weightedPoints, 2),
    total_weight: totalWeight,
    blocker_categories: blockerCategories.map((category) => ({
      key: category.key,
      label: category.label,
      blocker_reasons: category.blocker_reasons,
    })),
    cutover_blocked: blockerCategories.length > 0,
  };
}

function buildSummaryLines(overall, categories) {
  const lines = [
    `overall readiness: ${overall.status} (${overall.score_percent}/100)`,
  ];

  for (const category of categories) {
    const blockerNote = category.blocker && category.status === 'fail' ? ' [BLOCKER]' : '';
    const firstReason = category.blocker_reasons[0] ?? 'no blocker reason';
    lines.push(`${category.label}: ${category.status} (${category.score_percent}/100)${blockerNote} - ${firstReason}`);
  }

  return lines;
}

function renderMarkdown(report) {
  const categoryRows = report.categories
    .map((category) => {
      const blocker = category.blocker ? 'yes' : 'no';
      const reason = category.blocker_reasons[0] ?? '-';
      return `| ${category.label} | ${category.weight} | ${category.score_percent} | ${category.status} | ${blocker} | ${reason} |`;
    })
    .join('\n');

  const blockerSection =
    report.overall.blocker_categories.length === 0
      ? '- none'
      : report.overall.blocker_categories
          .map((category) => `- ${category.label}: ${(category.blocker_reasons ?? []).join('; ')}`)
          .join('\n');

  const evidenceSection = Object.entries(report.evidence_paths)
    .map(([key, value]) => `- ${key}: \`${value}\``)
    .join('\n');

  const summarySection = report.summary_lines.map((line) => `- ${line}`).join('\n');

  return `# Migration Readiness Scorecard

Generated at: ${report.generated_at}

## Overall

- status: \`${report.overall.status}\`
- score: \`${report.overall.score_percent}/100\`
- cutover blocked: \`${report.overall.cutover_blocked}\`

## Blockers

${blockerSection}

## Category Table

| Category | Weight | Score | Status | Blocker | Primary reason |
| --- | ---: | ---: | --- | --- | --- |
${categoryRows}

## Summary Lines

${summarySection}

## Evidence Paths

${evidenceSection}
`;
}

async function writeFileWithDirs(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const [
    runtimeGateReport,
    parityReport,
    shadowReport,
    historicalCoverageReport,
    fixtureRegistry,
    backendDeployWorkflowText,
    mobileRuntimeSourceText,
    mobileDatasetSourceText,
    mobileDebugMetadataText,
  ] = await Promise.all([
    readJson(options.runtimeGateReportPath),
    readJson(options.parityReportPath),
    readJson(options.shadowReportPath),
    readJson(options.historicalCoverageReportPath),
    readJson(options.fixtureRegistryPath),
    readText(options.backendDeployWorkflowPath),
    readText(options.mobileRuntimeConfigPath),
    readText(options.mobileDatasetSourcePath),
    readText(options.mobileDebugMetadataPath),
  ]);

  const categories = [
    buildBackendRuntimeCategory(runtimeGateReport),
    buildBackendDeployParityCategory(parityReport, fixtureRegistry, backendDeployWorkflowText),
    buildWebBackendOnlyStabilityCategory(shadowReport),
    buildMobileRuntimeModeCategory(mobileRuntimeSourceText, mobileDatasetSourceText, mobileDebugMetadataText),
    buildCatalogCompletenessCategory(historicalCoverageReport),
  ];

  const overall = buildOverall(categories);
  const report = {
    generated_at: new Date().toISOString(),
    rubric: READINESS_RUBRIC,
    evidence_paths: {
      runtime_gate_report: normalizePathForReport(options.runtimeGateReportPath),
      parity_report: normalizePathForReport(options.parityReportPath),
      shadow_report: normalizePathForReport(options.shadowReportPath),
      historical_coverage_report: normalizePathForReport(options.historicalCoverageReportPath),
      fixture_registry: normalizePathForReport(options.fixtureRegistryPath),
      backend_deploy_workflow: normalizePathForReport(options.backendDeployWorkflowPath),
      mobile_runtime_config: normalizePathForReport(options.mobileRuntimeConfigPath),
      mobile_dataset_source: normalizePathForReport(options.mobileDatasetSourcePath),
      mobile_debug_metadata: normalizePathForReport(options.mobileDebugMetadataPath),
    },
    overall,
    categories,
    summary_lines: buildSummaryLines(overall, categories),
  };

  const markdown = renderMarkdown(report);

  await writeFileWithDirs(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFileWithDirs(options.markdownPath, markdown);

  console.log(
    `[migration-readiness] status=${report.overall.status} score=${report.overall.score_percent}/100 blocked=${report.overall.cutover_blocked} report=${options.reportPath}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migration-readiness] failed: ${message}`);
  process.exitCode = 1;
});
