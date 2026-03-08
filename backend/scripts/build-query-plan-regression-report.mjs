#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import pg from 'pg';

const { Client } = pg;

const DEFAULT_REPORT_PATH = resolve(process.cwd(), './reports/query_plan_regression_report.json');

const PROJECTION_INDEXES = {
  entity_search_documents: [
    'idx_entity_search_documents_entity_id',
    'idx_entity_search_documents_slug',
    'idx_entity_search_documents_normalized_terms',
  ],
  release_detail_projection: [
    'idx_release_detail_projection_release_id',
    'idx_release_detail_projection_legacy_lookup',
  ],
  entity_detail_projection: [
    'idx_entity_detail_projection_entity_id',
    'idx_entity_detail_projection_slug',
  ],
  calendar_month_projection: [
    'idx_calendar_month_projection_month_start',
    'idx_calendar_month_projection_month_key',
  ],
  radar_projection: ['idx_radar_projection_key'],
};

const BASELINE_PLANNER_SETTINGS = [['enable_seqscan', 'off']];
const DEGRADED_PLANNER_SETTINGS = [['enable_seqscan', 'off']];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--report-path') {
      options.reportPath = resolve(process.cwd(), argv[index + 1] ?? DEFAULT_REPORT_PATH);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function asString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readExplainPlan(resultRow) {
  const explainValue = resultRow?.['QUERY PLAN'] ?? resultRow?.query_plan;
  if (!Array.isArray(explainValue) || explainValue.length === 0) {
    throw new Error('EXPLAIN did not return a JSON plan payload');
  }

  const root = explainValue[0];
  if (!root || typeof root !== 'object' || !root.Plan) {
    throw new Error('EXPLAIN JSON root did not contain Plan');
  }

  return root.Plan;
}

function collectPlanDetails(planNode, accumulator = {
  nodeTypes: [],
  relationScans: [],
  indexNames: [],
}) {
  if (!planNode || typeof planNode !== 'object') {
    return accumulator;
  }

  const nodeType = asString(planNode['Node Type']);
  const relationName = asString(planNode['Relation Name']);
  const indexName = asString(planNode['Index Name']);

  if (nodeType) {
    accumulator.nodeTypes.push(nodeType);
  }

  if (relationName || nodeType) {
    accumulator.relationScans.push({
      node_type: nodeType,
      relation_name: relationName,
    });
  }

  if (indexName) {
    accumulator.indexNames.push(indexName);
  }

  const childPlans = Array.isArray(planNode.Plans) ? planNode.Plans : [];
  for (const childPlan of childPlans) {
    collectPlanDetails(childPlan, accumulator);
  }

  return accumulator;
}

function summarizePlannerSettings(entries) {
  if (!entries.length) {
    return 'default';
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

async function explainQuery(client, sql, params, plannerSettings) {
  await client.query('begin');

  try {
    for (const [key, value] of plannerSettings) {
      await client.query(`set local ${key} = ${value}`);
    }

    const result = await client.query(`explain (format json) ${sql}`, params);
    const plan = readExplainPlan(result.rows[0]);
    const details = collectPlanDetails(plan);

    return {
      planner_settings: summarizePlannerSettings(plannerSettings),
      root_node_type: asString(plan['Node Type']),
      relation_scans: details.relationScans,
      index_names: details.indexNames,
      node_types: details.nodeTypes,
    };
  } finally {
    await client.query('rollback');
  }
}

async function fetchExistingIndexes(client) {
  const requiredIndexNames = Object.values(PROJECTION_INDEXES).flat();
  const result = await client.query(
    `
      select
        tablename,
        indexname
      from pg_indexes
      where schemaname = 'public'
        and indexname = any($1::text[])
    `,
    [requiredIndexNames],
  );

  return new Set(result.rows.map((row) => row.indexname));
}

function evaluatePlan(planSummary, querySpec) {
  const expectedIndexes = new Set(querySpec.expected_indexes);
  const usedExpectedIndexes = planSummary.index_names.filter((indexName) => expectedIndexes.has(indexName));
  const hasSeqScanOnTargetRelation = planSummary.relation_scans.some(
    (entry) => entry.relation_name === querySpec.target_relation && entry.node_type === 'Seq Scan',
  );

  return {
    used_expected_indexes: usedExpectedIndexes,
    has_seq_scan_on_target_relation: hasSeqScanOnTargetRelation,
    ok: usedExpectedIndexes.length > 0 && !hasSeqScanOnTargetRelation,
  };
}

async function loadRepresentativeSamples(client) {
  const entityResult = await client.query(
    `
      select entity_slug
      from entity_detail_projection
      order by entity_slug asc
      limit 1
    `,
  );
  const releaseResult = await client.query(
    `
      select
        release_id::text as release_id,
        entity_slug,
        normalized_release_title,
        release_date::text as release_date,
        stream
      from release_detail_projection
      order by release_date desc, entity_slug asc
      limit 1
    `,
  );
  const calendarResult = await client.query(
    `
      select month_key
      from calendar_month_projection
      order by month_key desc
      limit 1
    `,
  );

  const entitySlug = asString(entityResult.rows[0]?.entity_slug);
  const releaseRow = releaseResult.rows[0] ?? {};
  const calendarMonth = asString(calendarResult.rows[0]?.month_key);

  if (!entitySlug) {
    throw new Error('entity_detail_projection did not provide a representative entity_slug');
  }

  if (
    !asString(releaseRow.release_id) ||
    !asString(releaseRow.entity_slug) ||
    !asString(releaseRow.normalized_release_title) ||
    !asString(releaseRow.release_date) ||
    !asString(releaseRow.stream)
  ) {
    throw new Error('release_detail_projection did not provide a representative release lookup sample');
  }

  if (!calendarMonth) {
    throw new Error('calendar_month_projection did not provide a representative month_key');
  }

  return {
    entitySlug,
    releaseId: releaseRow.release_id,
    releaseLookupEntitySlug: releaseRow.entity_slug,
    releaseLookupTitle: releaseRow.normalized_release_title,
    releaseLookupDate: releaseRow.release_date,
    releaseLookupStream: releaseRow.stream,
    calendarMonth,
  };
}

function buildQuerySpecs(samples) {
  return [
    {
      query_id: 'search_context_entity_by_slug',
      target_relation: 'entity_search_documents',
      expected_indexes: ['idx_entity_search_documents_slug'],
      description: 'Search endpoint context hydration by exact entity slug list',
      sql: `
        select
          entity_id::text as entity_id,
          entity_slug,
          aliases,
          payload,
          generated_at
        from entity_search_documents
        where entity_slug = any($1::text[])
      `,
      degraded_sql: `
        select
          entity_id::text as entity_id,
          entity_slug,
          aliases,
          payload,
          generated_at
        from entity_search_documents
        where exists (
          select 1
          from unnest($1::text[]) as requested_slug
          where projection_normalize_text(entity_slug) = projection_normalize_text(requested_slug)
        )
      `,
      params: [[samples.entitySlug]],
      representative_lookup: {
        entity_slug: samples.entitySlug,
      },
    },
    {
      query_id: 'entity_detail_by_slug',
      target_relation: 'entity_detail_projection',
      expected_indexes: ['idx_entity_detail_projection_slug'],
      description: 'Entity detail projection lookup by stable slug',
      sql: `
        select
          entity_slug,
          payload,
          generated_at
        from entity_detail_projection
        where entity_slug = $1
        limit 1
      `,
      degraded_sql: `
        select
          entity_slug,
          payload,
          generated_at
        from entity_detail_projection
        where projection_normalize_text(entity_slug) = projection_normalize_text($1)
        limit 1
      `,
      params: [samples.entitySlug],
      representative_lookup: {
        entity_slug: samples.entitySlug,
      },
    },
    {
      query_id: 'release_detail_by_id',
      target_relation: 'release_detail_projection',
      expected_indexes: ['idx_release_detail_projection_release_id'],
      description: 'Release detail projection lookup by UUID',
      sql: `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where release_id = $1::uuid
        limit 1
      `,
      degraded_sql: `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where release_id::text = $1::text
        limit 1
      `,
      params: [samples.releaseId],
      representative_lookup: {
        release_id: samples.releaseId,
      },
    },
    {
      query_id: 'release_lookup_by_legacy_key',
      target_relation: 'release_detail_projection',
      expected_indexes: ['idx_release_detail_projection_legacy_lookup'],
      description: 'Legacy release lookup by entity slug, normalized title, date, and stream',
      sql: `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where entity_slug = $1
          and normalized_release_title = projection_normalize_text($2)
          and release_date = $3::date
          and stream = $4
        limit 1
      `,
      degraded_sql: `
        select
          release_id::text as release_id,
          entity_slug,
          normalized_release_title,
          release_date::text as release_date,
          stream,
          payload,
          generated_at
        from release_detail_projection
        where projection_normalize_text(entity_slug) = projection_normalize_text($1)
          and projection_normalize_text(normalized_release_title) = projection_normalize_text($2)
          and release_date::text = $3::text
          and projection_normalize_text(stream) = projection_normalize_text($4)
        limit 1
      `,
      params: [
        samples.releaseLookupEntitySlug,
        samples.releaseLookupTitle,
        samples.releaseLookupDate,
        samples.releaseLookupStream,
      ],
      representative_lookup: {
        entity_slug: samples.releaseLookupEntitySlug,
        title: samples.releaseLookupTitle,
        date: samples.releaseLookupDate,
        stream: samples.releaseLookupStream,
      },
    },
    {
      query_id: 'calendar_month_by_key',
      target_relation: 'calendar_month_projection',
      expected_indexes: ['idx_calendar_month_projection_month_key'],
      description: 'Calendar month projection lookup by month_key',
      sql: `
        select
          month_key,
          payload,
          generated_at
        from calendar_month_projection
        where month_key = $1
        limit 1
      `,
      degraded_sql: `
        select
          month_key,
          payload,
          generated_at
        from calendar_month_projection
        where to_char(month_start, 'YYYY-MM') = $1
        limit 1
      `,
      params: [samples.calendarMonth],
      representative_lookup: {
        month_key: samples.calendarMonth,
      },
    },
    {
      query_id: 'radar_default_projection',
      target_relation: 'radar_projection',
      expected_indexes: ['idx_radar_projection_key'],
      description: 'Radar projection lookup by singleton projection_key',
      sql: `
        select
          payload,
          generated_at
        from radar_projection
        where projection_key = $1
        limit 1
      `,
      degraded_sql: `
        select
          payload,
          generated_at
        from radar_projection
        where projection_normalize_text(projection_key) = projection_normalize_text($1)
        limit 1
      `,
      params: ['default'],
      representative_lookup: {
        projection_key: 'default',
      },
    },
  ];
}

function buildSummaryLines(queryResults, baselinePassed, degradedDetected, missingIndexes) {
  const lines = queryResults.map((entry) => {
    const baselineStatus = entry.baseline.ok ? 'pass' : 'fail';
    const degradedStatus = entry.degraded.ok ? 'missed' : 'detected';
    return `${entry.query_id}: baseline ${baselineStatus}, degraded ${degradedStatus}, expected indexes=${entry.expected_indexes.join(', ')}`;
  });

  lines.push(
    `baseline: ${baselinePassed ? 'pass' : 'fail'} (${queryResults.filter((entry) => entry.baseline.ok).length}/${queryResults.length})`,
  );
  lines.push(
    `controlled degraded scenario: ${degradedDetected ? 'detected' : 'missed'} (${queryResults.filter((entry) => !entry.degraded.ok).length}/${queryResults.length})`,
  );
  lines.push(
    `projection index inventory: ${missingIndexes.length === 0 ? 'pass' : `fail (${missingIndexes.length} missing)`}`,
  );

  return lines;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = new Client({
    connectionString: requiredEnv('DATABASE_URL'),
    application_name: 'idol-song-app-query-plan-regression',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const existingIndexes = await fetchExistingIndexes(client);
    const samples = await loadRepresentativeSamples(client);
    const querySpecs = buildQuerySpecs(samples);

    const missingIndexes = Object.entries(PROJECTION_INDEXES).flatMap(([relation, indexNames]) =>
      indexNames
        .filter((indexName) => !existingIndexes.has(indexName))
        .map((indexName) => ({ relation, index_name: indexName })),
    );

    const queryResults = [];
    for (const querySpec of querySpecs) {
      const defaultPlan = await explainQuery(client, querySpec.sql, querySpec.params, []);
      const baselinePlan = await explainQuery(client, querySpec.sql, querySpec.params, BASELINE_PLANNER_SETTINGS);
      const degradedPlan = await explainQuery(
        client,
        querySpec.degraded_sql ?? querySpec.sql,
        querySpec.params,
        DEGRADED_PLANNER_SETTINGS,
      );

      queryResults.push({
        query_id: querySpec.query_id,
        description: querySpec.description,
        target_relation: querySpec.target_relation,
        expected_indexes: querySpec.expected_indexes,
        representative_lookup: querySpec.representative_lookup,
        default_plan: defaultPlan,
        baseline: {
          ...evaluatePlan(baselinePlan, querySpec),
          plan: baselinePlan,
        },
        degraded: {
          ...evaluatePlan(degradedPlan, querySpec),
          plan: degradedPlan,
        },
      });
    }

    const baselinePassed = missingIndexes.length === 0 && queryResults.every((entry) => entry.baseline.ok);
    const degradedDetected = queryResults.some((entry) => !entry.degraded.ok);

    const report = {
      generated_at: new Date().toISOString(),
      clean: baselinePassed && degradedDetected,
      strategy: {
        baseline: 'required projection indexes present + EXPLAIN JSON with enable_seqscan=off must still find an expected index path',
        controlled_degraded_scenario:
          'run degraded predicate variants that intentionally bypass supporting indexes while keeping enable_seqscan=off',
      },
      representative_samples: samples,
      projection_index_inventory: {
        expected: PROJECTION_INDEXES,
        missing: missingIndexes,
      },
      summary_lines: buildSummaryLines(queryResults, baselinePassed, degradedDetected, missingIndexes),
      summary: {
        total_queries: queryResults.length,
        baseline_passed_queries: queryResults.filter((entry) => entry.baseline.ok).length,
        degraded_detected_queries: queryResults.filter((entry) => !entry.degraded.ok).length,
        missing_projection_indexes: missingIndexes.length,
        baseline_passed: baselinePassed,
        controlled_degraded_scenario_detected: degradedDetected,
      },
      queries: queryResults,
    };

    await writeReport(options.reportPath, report);

    console.log(
      JSON.stringify(
        {
          report_path: options.reportPath,
          baseline_passed: report.summary.baseline_passed,
          degraded_detected: report.summary.controlled_degraded_scenario_detected,
          missing_projection_indexes: report.summary.missing_projection_indexes,
        },
        null,
        2,
      ),
    );

    if (!report.clean) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
