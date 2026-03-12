import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

import {
  buildWorkflowConditionGuardReport,
  collectWorkflowConditionViolations,
} from './workflowConditionGuard.mjs';

test('collectWorkflowConditionViolations reports direct secrets usage inside if conditions', async () => {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), 'idol-workflow-guard-'));
  try {
    await mkdir(path.join(repoDir, '.github', 'workflows'), { recursive: true });
    await writeFile(
      path.join(repoDir, '.github', 'workflows', 'broken.yml'),
      [
        'name: Broken Workflow',
        'jobs:',
        '  test:',
        '    steps:',
        "      - if: ${{ secrets.DATABASE_URL != '' }}",
        "        run: echo 'broken'",
        '',
      ].join('\n'),
      'utf8',
    );

    const violations = await collectWorkflowConditionViolations(repoDir);

    assert.equal(violations.length, 1);
    assert.equal(violations[0].workflow_path, '.github/workflows/broken.yml');
    assert.equal(violations[0].line, 5);
    assert.equal(violations[0].rule_id, 'no_secrets_in_if');
  } finally {
    await rm(repoDir, { recursive: true, force: true });
  }
});

test('buildWorkflowConditionGuardReport summarizes pass and fail states', () => {
  const passReport = buildWorkflowConditionGuardReport({ violations: [] });
  assert.equal(passReport.status, 'pass');

  const failReport = buildWorkflowConditionGuardReport({
    violations: [
      {
        workflow_path: '.github/workflows/broken.yml',
        line: 5,
        rule_id: 'no_secrets_in_if',
        reason: 'GitHub Actions does not allow direct secrets context usage inside if conditions.',
        snippet: "if: ${{ secrets.DATABASE_URL != '' }}",
      },
    ],
  });
  assert.equal(failReport.status, 'fail');
  assert.match(failReport.summary_lines[0], /1 invalid if condition/);
});
