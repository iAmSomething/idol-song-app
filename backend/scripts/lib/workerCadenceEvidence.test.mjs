import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduledEvidenceSummary,
  countExpectedScheduledRunsByNow,
  nextScheduledOccurrenceAfter,
  parseScheduleExpectation,
} from './workerCadenceEvidence.mjs';

test('parseScheduleExpectation supports daily and weekly cron schedules used by workers', () => {
  assert.deepEqual(parseScheduleExpectation('0 0 * * *'), {
    kind: 'daily',
    minute: 0,
    hour: 0,
  });
  assert.deepEqual(parseScheduleExpectation('0 1 * * 0'), {
    kind: 'weekly',
    minute: 0,
    hour: 1,
    weekday: 0,
  });
  assert.equal(parseScheduleExpectation('0 1 1 * *'), null);
});

test('nextScheduledOccurrenceAfter returns the next daily or weekly slot in UTC', () => {
  const daily = parseScheduleExpectation('0 0 * * *');
  const weekly = parseScheduleExpectation('0 1 * * 0');

  assert.equal(
    nextScheduledOccurrenceAfter('2026-03-06T07:34:09.000Z', daily)?.toISOString(),
    '2026-03-07T00:00:00.000Z',
  );
  assert.equal(
    nextScheduledOccurrenceAfter('2026-03-11T07:14:52.000Z', weekly)?.toISOString(),
    '2026-03-15T01:00:00.000Z',
  );
});

test('countExpectedScheduledRunsByNow counts elapsed schedule windows from the first due time', () => {
  const daily = parseScheduleExpectation('0 0 * * *');
  assert.equal(
    countExpectedScheduledRunsByNow({
      firstExpectedRunAt: '2026-03-07T00:00:00.000Z',
      parsedSchedule: daily,
      now: '2026-03-11T08:30:00.000Z',
    }),
    5,
  );
});

test('buildScheduledEvidenceSummary marks daily cadence as missing after several missed windows', () => {
  const summary = buildScheduledEvidenceSummary({
    workflowRegistered: true,
    workflowMetadata: {
      created_at: '2026-03-06T07:34:09.000Z',
      updated_at: '2026-03-06T07:34:09.000Z',
      state: 'active',
      html_url: 'https://github.com/example/weekly-kpop-scan',
    },
    cadenceLabel: 'daily',
    scheduleExpectation: '0 0 * * *',
    observedScheduledRuns: 0,
    now: '2026-03-11T08:30:00.000Z',
  });

  assert.equal(summary.status, 'scheduled_evidence_missing');
  assert.equal(summary.expected_scheduled_runs_by_now, 5);
  assert.equal(summary.missed_scheduled_windows, 5);
});

test('buildScheduledEvidenceSummary does not reset cadence warm-up from workflow updated_at churn', () => {
  const summary = buildScheduledEvidenceSummary({
    workflowRegistered: true,
    workflowMetadata: {
      created_at: '2026-03-06T07:34:09.000Z',
      updated_at: '2026-03-11T13:45:16.000Z',
      state: 'active',
      html_url: 'https://github.com/example/weekly-kpop-scan',
    },
    cadenceLabel: 'daily',
    scheduleExpectation: '0 0 * * *',
    observedScheduledRuns: 0,
    now: '2026-03-11T16:10:01.000Z',
  });

  assert.equal(summary.status, 'scheduled_evidence_missing');
  assert.equal(summary.schedule_reference_at, '2026-03-06T07:34:09.000Z');
  assert.equal(summary.expected_scheduled_runs_by_now, 5);
  assert.equal(summary.missed_scheduled_windows, 5);
  assert.equal(summary.first_expected_run_at, '2026-03-07T00:00:00.000Z');
});

test('buildScheduledEvidenceSummary keeps weekly cadence in warm-up before the first due window', () => {
  const summary = buildScheduledEvidenceSummary({
    workflowRegistered: true,
    workflowMetadata: {
      created_at: '2026-03-11T07:14:52.000Z',
      updated_at: '2026-03-11T09:25:54.000Z',
      state: 'active',
      html_url: 'https://github.com/example/catalog-enrichment-refresh',
    },
    cadenceLabel: 'weekly',
    scheduleExpectation: '0 1 * * 0',
    observedScheduledRuns: 0,
    now: '2026-03-11T08:30:00.000Z',
  });

  assert.equal(summary.status, 'warming_up');
  assert.equal(summary.expected_scheduled_runs_by_now, 0);
  assert.equal(summary.missed_scheduled_windows, 0);
  assert.equal(summary.first_expected_run_at, '2026-03-15T01:00:00.000Z');
});
