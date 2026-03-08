import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PROJECTION_FRESHNESS_PASS_LAG_MINUTES = 20;
const PROJECTION_FRESHNESS_DEGRADED_LAG_MINUTES = 60;

type ReadyStatus = 'ready' | 'degraded' | 'not_ready';
type ProjectionStatus = 'healthy' | 'degraded' | 'not_ready';
type DependencyStatus = 'healthy' | 'degraded' | 'missing';

type ReportSummary = {
  generated_at: string | null;
  summary_lines: string[];
};

export type ProjectionHealth = ReportSummary & {
  status: ProjectionStatus;
  lag_minutes: number | null;
  thresholds: {
    pass_lag_minutes: number;
    degraded_lag_minutes: number;
  };
  row_counts: Record<string, number> | null;
};

export type DependencyHealth = ReportSummary & {
  status: DependencyStatus;
  clean: boolean | null;
};

export type RuntimeGateHealth = ReportSummary & {
  status: DependencyStatus;
  stage_gates: {
    shadow_to_web_cutover: string | null;
    web_cutover_to_json_demotion: string | null;
  };
};

export type ReadyStatusSnapshot = {
  status: ReadyStatus;
  reasons: string[];
  projections: ProjectionHealth;
  dependencies: {
    parity_report: DependencyHealth;
    shadow_report: DependencyHealth;
    runtime_gate_report: RuntimeGateHealth;
  };
};

export type ReadyStatusProvider = () => Promise<ReadyStatusSnapshot>;

const PROJECTION_REFRESH_SUMMARY_URL = new URL('../../reports/projection_refresh_summary.json', import.meta.url);
const PARITY_REPORT_URL = new URL('../../reports/backend_json_parity_report.json', import.meta.url);
const SHADOW_REPORT_URL = new URL('../../reports/backend_shadow_read_report.json', import.meta.url);
const RUNTIME_GATE_REPORT_URL = new URL('../../reports/runtime_gate_report.json', import.meta.url);

function asIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function asSummaryLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function minutesSince(timestamp: string | null): number | null {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Number((((Date.now() - parsed.getTime()) / 1000) / 60).toFixed(2));
}

async function loadReport(url: URL): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(fileURLToPath(url), 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    return null;
  }
}

function buildProjectionHealth(report: Record<string, unknown> | null): { health: ProjectionHealth; reasons: string[] } {
  if (!report) {
    return {
      health: {
        status: 'not_ready',
        generated_at: null,
        summary_lines: [],
        lag_minutes: null,
        thresholds: {
          pass_lag_minutes: PROJECTION_FRESHNESS_PASS_LAG_MINUTES,
          degraded_lag_minutes: PROJECTION_FRESHNESS_DEGRADED_LAG_MINUTES,
        },
        row_counts: null,
      },
      reasons: ['projection_report_missing'],
    };
  }

  const generatedAt = asIsoTimestamp(report.generated_at);
  const lagMinutes = minutesSince(generatedAt);

  if (!generatedAt || lagMinutes === null) {
    return {
      health: {
        status: 'not_ready',
        generated_at: generatedAt,
        summary_lines: [],
        lag_minutes: lagMinutes,
        thresholds: {
          pass_lag_minutes: PROJECTION_FRESHNESS_PASS_LAG_MINUTES,
          degraded_lag_minutes: PROJECTION_FRESHNESS_DEGRADED_LAG_MINUTES,
        },
        row_counts: null,
      },
      reasons: ['projection_generated_at_invalid'],
    };
  }

  const status: ProjectionStatus =
    lagMinutes <= PROJECTION_FRESHNESS_PASS_LAG_MINUTES
      ? 'healthy'
      : lagMinutes <= PROJECTION_FRESHNESS_DEGRADED_LAG_MINUTES
        ? 'degraded'
        : 'not_ready';

  const reasons =
    status === 'healthy'
      ? []
      : status === 'degraded'
        ? ['projection_freshness_degraded']
        : ['projection_freshness_not_ready'];

  const rowCountsRaw = report.row_counts;
  const rowCounts =
    rowCountsRaw && typeof rowCountsRaw === 'object' && !Array.isArray(rowCountsRaw)
      ? Object.fromEntries(
          Object.entries(rowCountsRaw).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
        )
      : null;

  return {
    health: {
      status,
      generated_at: generatedAt,
      summary_lines: [],
      lag_minutes: lagMinutes,
      thresholds: {
        pass_lag_minutes: PROJECTION_FRESHNESS_PASS_LAG_MINUTES,
        degraded_lag_minutes: PROJECTION_FRESHNESS_DEGRADED_LAG_MINUTES,
      },
      row_counts: rowCounts,
    },
    reasons,
  };
}

function buildDependencyHealth(
  report: Record<string, unknown> | null,
  missingReason: string,
  uncleanReason: string,
): { health: DependencyHealth; reasons: string[] } {
  if (!report) {
    return {
      health: {
        status: 'missing',
        generated_at: null,
        summary_lines: [],
        clean: null,
      },
      reasons: [missingReason],
    };
  }

  const clean = typeof report.clean === 'boolean' ? report.clean : null;
  const status: DependencyStatus = clean === true ? 'healthy' : 'degraded';

  return {
    health: {
      status,
      generated_at: asIsoTimestamp(report.generated_at),
      summary_lines: asSummaryLines(report.summary_lines),
      clean,
    },
    reasons: status === 'healthy' ? [] : [uncleanReason],
  };
}

function buildRuntimeGateHealth(report: Record<string, unknown> | null): { health: RuntimeGateHealth; reasons: string[] } {
  if (!report) {
    return {
      health: {
        status: 'missing',
        generated_at: null,
        summary_lines: [],
        stage_gates: {
          shadow_to_web_cutover: null,
          web_cutover_to_json_demotion: null,
        },
      },
      reasons: ['runtime_gate_report_missing'],
    };
  }

  const rawStageGates =
    report.stage_gates && typeof report.stage_gates === 'object' && !Array.isArray(report.stage_gates)
      ? (report.stage_gates as Record<string, unknown>)
      : {};
  const shadowToWebCutover =
    typeof rawStageGates.shadow_to_web_cutover === 'string' ? rawStageGates.shadow_to_web_cutover : null;
  const webCutoverToJsonDemotion =
    typeof rawStageGates.web_cutover_to_json_demotion === 'string' ? rawStageGates.web_cutover_to_json_demotion : null;
  const status: DependencyStatus =
    shadowToWebCutover === 'pass' && webCutoverToJsonDemotion === 'pass' ? 'healthy' : 'degraded';

  return {
    health: {
      status,
      generated_at: asIsoTimestamp(report.generated_at),
      summary_lines: asSummaryLines(report.summary_lines),
      stage_gates: {
        shadow_to_web_cutover: shadowToWebCutover,
        web_cutover_to_json_demotion: webCutoverToJsonDemotion,
      },
    },
    reasons: status === 'healthy' ? [] : ['runtime_gate_degraded'],
  };
}

export function createReadyStatusProvider(): ReadyStatusProvider {
  return async () => {
    const [projectionReport, parityReport, shadowReport, runtimeGateReport] = await Promise.all([
      loadReport(PROJECTION_REFRESH_SUMMARY_URL),
      loadReport(PARITY_REPORT_URL),
      loadReport(SHADOW_REPORT_URL),
      loadReport(RUNTIME_GATE_REPORT_URL),
    ]);

    const projection = buildProjectionHealth(projectionReport);
    const parity = buildDependencyHealth(parityReport, 'parity_report_missing', 'parity_report_unclean');
    const shadow = buildDependencyHealth(shadowReport, 'shadow_report_missing', 'shadow_report_unclean');
    const runtimeGate = buildRuntimeGateHealth(runtimeGateReport);

    const reasons = [...projection.reasons, ...parity.reasons, ...shadow.reasons, ...runtimeGate.reasons];
    const status: ReadyStatus =
      projection.health.status === 'not_ready'
        ? 'not_ready'
        : reasons.length > 0
          ? 'degraded'
          : 'ready';

    return {
      status,
      reasons,
      projections: projection.health,
      dependencies: {
        parity_report: parity.health,
        shadow_report: shadow.health,
        runtime_gate_report: runtimeGate.health,
      },
    };
  };
}
