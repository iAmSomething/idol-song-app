const WARMUP_GRACE_HOURS_BY_CADENCE = {
  hourly: 3,
  daily: 12,
  weekly: 24,
  custom: 12,
};

function hoursBetween(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return null;
  }
  return Number((((end.getTime() - start.getTime()) / 1000) / 3600).toFixed(2));
}

function parseNumber(value) {
  return /^\d+$/.test(String(value ?? '')) ? Number(value) : null;
}

function toDate(value) {
  const parsed = new Date(value ?? '');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoString(value) {
  const parsed = value instanceof Date ? value : toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function normalizeActionsPermissions(actionsPermissions, workflowPermissions) {
  return {
    actions_enabled: actionsPermissions?.enabled ?? null,
    allowed_actions: actionsPermissions?.allowed_actions ?? null,
    sha_pinning_required: actionsPermissions?.sha_pinning_required ?? null,
    default_workflow_permissions: workflowPermissions?.default_workflow_permissions ?? null,
    can_approve_pull_request_reviews: workflowPermissions?.can_approve_pull_request_reviews ?? null,
  };
}

function buildScheduleDiagnosticsHints({ repository, normalizedPermissions, workflowDiagnostics }) {
  const hints = [];
  const activeMissingWorkflows = workflowDiagnostics.filter(
    (entry) =>
      entry.workflow_registered &&
      entry.workflow_state === 'active' &&
      entry.cadence_status === 'scheduled_evidence_missing',
  );
  const unregisteredWorkflows = workflowDiagnostics.filter((entry) => !entry.workflow_registered);
  const inactiveWorkflows = workflowDiagnostics.filter(
    (entry) => entry.workflow_registered && entry.workflow_state && entry.workflow_state !== 'active',
  );

  if (normalizedPermissions.actions_enabled === false) {
    hints.push({
      severity: 'fail',
      code: 'actions_disabled',
      summary: 'GitHub Actions is disabled for this repository.',
      details: 'Scheduled workflow delivery cannot work while repository Actions is disabled.',
      workflow_keys: [],
      suggested_actions: [
        'Open repository Settings > Actions and re-enable GitHub Actions.',
        'Re-run worker cadence diagnostics after Actions is enabled.',
      ],
    });
  }

  if (unregisteredWorkflows.length > 0) {
    hints.push({
      severity: 'fail',
      code: 'workflow_not_registered',
      summary: 'One or more scheduled workflows are not registered in GitHub Actions.',
      details: `Unregistered workflows: ${unregisteredWorkflows.map((entry) => entry.key).join(', ')}.`,
      workflow_keys: unregisteredWorkflows.map((entry) => entry.key),
      suggested_actions: [
        'Confirm the workflow file exists on the default branch.',
        'Push a no-op workflow change if GitHub has not re-registered the workflow after a rename or move.',
      ],
    });
  }

  if (inactiveWorkflows.length > 0) {
    hints.push({
      severity: 'fail',
      code: 'workflow_inactive',
      summary: 'One or more scheduled workflows are registered but not active.',
      details: inactiveWorkflows
        .map((entry) => `${entry.key} state=${entry.workflow_state ?? 'unknown'}`)
        .join('; '),
      workflow_keys: inactiveWorkflows.map((entry) => entry.key),
      suggested_actions: [
        'Open the workflow page in GitHub Actions and re-enable the workflow.',
        'Verify the workflow still contains an on.schedule trigger on the default branch.',
      ],
    });
  }

  if (activeMissingWorkflows.length > 0) {
    hints.push({
      severity: 'fail',
      code: 'scheduled_delivery_missing',
      summary: 'Active scheduled workflows have missed expected schedule windows with zero recorded scheduled runs.',
      details: activeMissingWorkflows
        .map(
          (entry) =>
            `${entry.key}: observed=${entry.observed_scheduled_runs}, expected_by_now=${entry.expected_scheduled_runs_by_now}, missed_windows=${entry.missed_scheduled_windows}, manual_runs=${entry.manual_runs}`,
        )
        .join('; '),
      workflow_keys: activeMissingWorkflows.map((entry) => entry.key),
      suggested_actions: [
        'Inspect the workflow page in GitHub Actions and confirm the schedule is attached to the current default branch.',
        'Disable and re-enable the affected workflow to force GitHub to refresh cron registration.',
        'Check repository/org policy, billing, or Actions incidents if scheduled runs are still absent after refresh.',
      ],
    });
  }

  if (normalizedPermissions.allowed_actions && normalizedPermissions.allowed_actions !== 'all') {
    hints.push({
      severity: 'needs_review',
      code: 'actions_policy_restricted',
      summary: 'Repository Actions policy is restricted.',
      details: `allowed_actions=${normalizedPermissions.allowed_actions}`,
      workflow_keys: [],
      suggested_actions: [
        'Verify the current Actions policy still permits the workflows and actions used by scheduled jobs.',
      ],
    });
  }

  const pushedAt = toDate(repository?.pushed_at);
  const now = new Date();
  const hoursSincePush = pushedAt ? hoursBetween(pushedAt, now) : null;
  if (typeof hoursSincePush === 'number' && hoursSincePush > 24 * 55) {
    hints.push({
      severity: 'needs_review',
      code: 'repository_inactive',
      summary: 'Repository push activity is old enough that scheduled workflow suspension is plausible.',
      details: `hours_since_last_push=${hoursSincePush}`,
      workflow_keys: [],
      suggested_actions: [
        'Confirm the repository has recent default-branch activity because GitHub may suspend schedules on inactive repos.',
      ],
    });
  }

  if (hints.length === 0) {
    hints.push({
      severity: 'info',
      code: 'no_schedule_delivery_findings',
      summary: 'No repository-level schedule delivery blockers were detected in this sample.',
      details: 'Use workflow-level cadence and runtime reports for deeper investigation if drift remains.',
      workflow_keys: [],
      suggested_actions: [],
    });
  }

  return hints;
}

export function buildWorkflowScheduleDiagnosticsReport({
  repo,
  repository,
  actionsPermissions,
  workflowPermissions,
  workflowDiagnostics,
}) {
  const normalizedPermissions = normalizeActionsPermissions(actionsPermissions, workflowPermissions);
  const workflows = Object.fromEntries(
    workflowDiagnostics.map((entry) => [
      entry.key,
      {
        workflow: entry.workflow,
        workflow_registered: entry.workflow_registered,
        workflow_state: entry.workflow_state,
        workflow_html_url: entry.workflow_html_url,
        cadence_label: entry.cadence_label,
        cadence_status: entry.cadence_status,
        schedule_expectation: entry.schedule_expectation,
        workflow_created_at: entry.workflow_created_at,
        workflow_updated_at: entry.workflow_updated_at,
        observed_scheduled_runs: entry.observed_scheduled_runs,
        expected_scheduled_runs_by_now: entry.expected_scheduled_runs_by_now,
        missed_scheduled_windows: entry.missed_scheduled_windows,
        first_expected_run_at: entry.first_expected_run_at,
        next_expected_run_at: entry.next_expected_run_at,
        last_success_at: entry.last_success_at,
        last_success_age_hours: entry.last_success_age_hours,
        manual_runs: entry.manual_runs,
        latest_run: entry.latest_run,
        latest_scheduled_run: entry.latest_scheduled_run,
      },
    ]),
  );

  return {
    generated_at: new Date().toISOString(),
    repo,
    repository: {
      default_branch: repository?.default_branch ?? null,
      private: repository?.private ?? null,
      archived: repository?.archived ?? null,
      disabled: repository?.disabled ?? null,
      pushed_at: toIsoString(repository?.pushed_at),
      updated_at: toIsoString(repository?.updated_at),
    },
    actions_permissions: normalizedPermissions,
    workflows,
    actionable_hints: buildScheduleDiagnosticsHints({
      repository,
      normalizedPermissions,
      workflowDiagnostics,
    }),
  };
}

export function parseScheduleExpectation(cron) {
  const parts = String(cron ?? '')
    .trim()
    .split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minuteToken, hourToken, dayOfMonthToken, monthToken, dayOfWeekToken] = parts;
  const minute = parseNumber(minuteToken);
  if (minute === null || dayOfMonthToken !== '*' || monthToken !== '*') {
    return null;
  }

  if (hourToken === '*' && dayOfWeekToken === '*') {
    return {
      kind: 'hourly',
      minute,
    };
  }

  const hour = parseNumber(hourToken);
  if (hour === null) {
    return null;
  }

  if (dayOfWeekToken === '*') {
    return {
      kind: 'daily',
      minute,
      hour,
    };
  }

  const weekday = parseNumber(dayOfWeekToken);
  if (weekday === null || weekday < 0 || weekday > 6) {
    return null;
  }

  return {
    kind: 'weekly',
    minute,
    hour,
    weekday,
  };
}

export function nextScheduledOccurrenceAfter(referenceValue, parsedSchedule) {
  const reference = toDate(referenceValue);
  if (!reference || !parsedSchedule) {
    return null;
  }

  const candidate = new Date(reference.getTime());
  candidate.setUTCSeconds(0, 0);

  if (parsedSchedule.kind === 'hourly') {
    candidate.setUTCMinutes(parsedSchedule.minute, 0, 0);
    if (candidate <= reference) {
      candidate.setUTCHours(candidate.getUTCHours() + 1);
    }
    return candidate;
  }

  candidate.setUTCHours(parsedSchedule.hour, parsedSchedule.minute, 0, 0);

  if (parsedSchedule.kind === 'daily') {
    if (candidate <= reference) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
  }

  if (parsedSchedule.kind === 'weekly') {
    const currentWeekday = candidate.getUTCDay();
    let dayOffset = parsedSchedule.weekday - currentWeekday;
    if (dayOffset < 0 || (dayOffset === 0 && candidate <= reference)) {
      dayOffset += 7;
    }
    candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
    return candidate;
  }

  return null;
}

export function countExpectedScheduledRunsByNow({
  firstExpectedRunAt,
  parsedSchedule,
  now = new Date(),
}) {
  const firstExpected = toDate(firstExpectedRunAt);
  const currentTime = toDate(now);
  if (!firstExpected || !currentTime || !parsedSchedule || firstExpected > currentTime) {
    return 0;
  }

  let count = 0;
  let cursor = firstExpected;

  while (cursor <= currentTime) {
    count += 1;
    const next = new Date(cursor.getTime());
    if (parsedSchedule.kind === 'weekly') {
      next.setUTCDate(next.getUTCDate() + 7);
    } else if (parsedSchedule.kind === 'daily') {
      next.setUTCDate(next.getUTCDate() + 1);
    } else if (parsedSchedule.kind === 'hourly') {
      next.setUTCHours(next.getUTCHours() + 1);
    } else {
      return count;
    }
    cursor = next;
  }

  return count;
}

export function buildScheduledEvidenceSummary({
  workflowRegistered,
  workflowMetadata,
  cadenceLabel,
  scheduleExpectation,
  observedScheduledRuns,
  now = new Date(),
}) {
  const normalizedObservedRuns = Number.isInteger(observedScheduledRuns) && observedScheduledRuns > 0 ? observedScheduledRuns : 0;
  const parsedSchedule = parseScheduleExpectation(scheduleExpectation);
  const workflowCreatedAt = toDate(workflowMetadata?.created_at);
  const workflowUpdatedAt = toDate(workflowMetadata?.updated_at);
  const nowDate = toDate(now);
  const warmupGraceHours = WARMUP_GRACE_HOURS_BY_CADENCE[cadenceLabel] ?? WARMUP_GRACE_HOURS_BY_CADENCE.custom;
  const scheduleReferenceAt = workflowCreatedAt ?? workflowUpdatedAt;
  const firstExpectedRunAt =
    workflowRegistered && scheduleReferenceAt && parsedSchedule
      ? nextScheduledOccurrenceAfter(scheduleReferenceAt, parsedSchedule)
      : null;
  const nextExpectedRunAt =
    workflowRegistered && nowDate && parsedSchedule ? nextScheduledOccurrenceAfter(nowDate, parsedSchedule) : null;
  const warmupDeadlineAt =
    firstExpectedRunAt !== null
      ? new Date(firstExpectedRunAt.getTime() + warmupGraceHours * 60 * 60 * 1000)
      : null;
  const expectedScheduledRunsByNow = countExpectedScheduledRunsByNow({
    firstExpectedRunAt,
    parsedSchedule,
    now: nowDate,
  });
  const missedScheduledWindows = Math.max(expectedScheduledRunsByNow - normalizedObservedRuns, 0);

  let status = 'no_scheduled_sample';
  let reason = 'No scheduled sample was found.';

  if (!workflowRegistered) {
    status = 'workflow_not_registered';
    reason = 'Workflow is not registered in GitHub Actions.';
  } else if (normalizedObservedRuns > 0) {
    status = 'has_scheduled_evidence';
    reason = 'Scheduled cadence evidence is present.';
  } else if (firstExpectedRunAt && expectedScheduledRunsByNow > 0) {
    status = 'scheduled_evidence_missing';
    reason = 'Expected scheduled run windows have elapsed without a recorded scheduled sample.';
  } else if (warmupDeadlineAt && nowDate && nowDate <= warmupDeadlineAt) {
    status = 'warming_up';
    reason = 'Workflow schedule is configured, but the first scheduled sample window is still in warm-up.';
  }

  return {
    status,
    reason,
    cadence_label: cadenceLabel ?? null,
    workflow_created_at: toIsoString(workflowCreatedAt),
    workflow_updated_at: toIsoString(workflowMetadata?.updated_at),
    schedule_reference_at: toIsoString(scheduleReferenceAt),
    workflow_state: workflowMetadata?.state ?? null,
    workflow_html_url: workflowMetadata?.html_url ?? null,
    parsed_schedule: parsedSchedule,
    warmup_grace_hours: warmupGraceHours,
    first_expected_run_at: toIsoString(firstExpectedRunAt),
    next_expected_run_at: toIsoString(nextExpectedRunAt),
    warmup_deadline_at: toIsoString(warmupDeadlineAt),
    expected_scheduled_runs_by_now: expectedScheduledRunsByNow,
    observed_scheduled_runs: normalizedObservedRuns,
    missed_scheduled_windows: missedScheduledWindows,
  };
}
