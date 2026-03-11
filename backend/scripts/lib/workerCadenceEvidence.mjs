const WARMUP_GRACE_HOURS_BY_CADENCE = {
  daily: 12,
  weekly: 24,
  custom: 12,
};

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

export function parseScheduleExpectation(cron) {
  const parts = String(cron ?? '')
    .trim()
    .split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [minuteToken, hourToken, dayOfMonthToken, monthToken, dayOfWeekToken] = parts;
  const minute = parseNumber(minuteToken);
  const hour = parseNumber(hourToken);
  if (minute === null || hour === null || dayOfMonthToken !== '*' || monthToken !== '*') {
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
  const stepDays = parsedSchedule.kind === 'weekly' ? 7 : 1;

  while (cursor <= currentTime) {
    count += 1;
    const next = new Date(cursor.getTime());
    next.setUTCDate(next.getUTCDate() + stepDays);
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
  const scheduleReferenceAt =
    normalizedObservedRuns === 0 && workflowUpdatedAt && workflowCreatedAt && workflowUpdatedAt > workflowCreatedAt
      ? workflowUpdatedAt
      : workflowCreatedAt;
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
  } else if (warmupDeadlineAt && nowDate && nowDate <= warmupDeadlineAt) {
    status = 'warming_up';
    reason = 'Workflow schedule is configured, but the first scheduled sample window is still in warm-up.';
  } else if (firstExpectedRunAt && expectedScheduledRunsByNow > 0) {
    status = 'scheduled_evidence_missing';
    reason = 'Expected scheduled run windows have elapsed without a recorded scheduled sample.';
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
