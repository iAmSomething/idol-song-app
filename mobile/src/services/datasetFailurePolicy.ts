import {
  getRuntimeConfigState,
  type RuntimeConfigIssue,
  type RuntimeConfigState,
} from '../config/runtime';
import {
  createBundledDatasetSelection,
  selectDatasetSource,
  type DatasetSelection,
} from './datasetSource';

export type DatasetFailurePolicyIssueKind =
  | RuntimeConfigIssue['kind'];

export type DatasetFailurePolicyIssue = {
  kind: DatasetFailurePolicyIssueKind;
  message: string;
};

export type DatasetFailurePolicy = {
  mode: 'normal' | 'degraded';
  activeSource: DatasetSelection['kind'];
  selection: DatasetSelection;
  issues: DatasetFailurePolicyIssue[];
};

function toFailurePolicyIssues(issues: RuntimeConfigIssue[]): DatasetFailurePolicyIssue[] {
  return issues.map((issue) => ({
    kind: issue.kind,
    message: issue.message,
  }));
}

export async function resolveDatasetFailurePolicy(options: {
  runtimeState?: RuntimeConfigState;
  selection?: DatasetSelection;
} = {}): Promise<DatasetFailurePolicy> {
  const runtimeState = options.runtimeState ?? getRuntimeConfigState();

  if (runtimeState.mode === 'degraded') {
    return {
      mode: 'degraded',
      activeSource: 'bundled-static',
      selection: createBundledDatasetSelection(
        runtimeState.config.dataSource.datasetVersion,
        'runtime_degraded',
      ),
      issues: toFailurePolicyIssues(runtimeState.issues),
    };
  }

  const selection = options.selection ?? selectDatasetSource(runtimeState.config);
  return {
    mode: 'normal',
    activeSource: selection.kind,
    selection,
    issues: [],
  };
}
