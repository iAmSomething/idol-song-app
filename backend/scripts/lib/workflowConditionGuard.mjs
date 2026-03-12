import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_CONDITION_RULE_ID = 'no_secrets_in_if';
const WORKFLOW_FILE_PATTERN = /\.ya?ml$/i;
const SECRETS_IN_IF_PATTERN = /^\s*(?:-\s*)?if:\s*\$\{\{.*\bsecrets\./;

async function* walkWorkflows(rootDirectory, relativeDirectory = '.') {
  const absoluteDirectory = path.join(rootDirectory, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relativeDirectory === '.' ? entry.name : path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      yield* walkWorkflows(rootDirectory, relativePath);
      continue;
    }
    if (entry.isFile() && WORKFLOW_FILE_PATTERN.test(entry.name)) {
      yield relativePath;
    }
  }
}

export async function collectWorkflowConditionViolations(repoDir) {
  const workflowRoot = path.join(repoDir, '.github', 'workflows');
  const violations = [];

  for await (const relativeWorkflowPath of walkWorkflows(workflowRoot)) {
    const relativePath = path.join('.github', 'workflows', relativeWorkflowPath);
    const content = await readFile(path.join(repoDir, relativePath), 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!SECRETS_IN_IF_PATTERN.test(line)) {
        return;
      }
      violations.push({
        workflow_path: relativePath,
        line: index + 1,
        rule_id: WORKFLOW_CONDITION_RULE_ID,
        reason: 'GitHub Actions does not allow direct secrets context usage inside if conditions.',
        snippet: line.trim(),
      });
    });
  }

  return violations.sort((left, right) => {
    if (left.workflow_path === right.workflow_path) {
      return left.line - right.line;
    }
    return left.workflow_path.localeCompare(right.workflow_path);
  });
}

export function buildWorkflowConditionGuardReport({ violations }) {
  return {
    generated_at: new Date().toISOString(),
    status: violations.length === 0 ? 'pass' : 'fail',
    summary_lines: [
      violations.length === 0
        ? 'workflow condition guard: no direct secrets usage found in if conditions'
        : `workflow condition guard: ${violations.length} invalid if condition(s) use secrets context directly`,
    ],
    violations,
  };
}
