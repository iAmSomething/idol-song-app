import type { RuntimeConfigState } from '../config/runtime';

import { resolveDatasetFailurePolicy } from './datasetFailurePolicy';
import { createBundledDatasetSelection } from './datasetSource';

function createRuntimeState(mode: RuntimeConfigState['mode'] = 'normal'): RuntimeConfigState {
  return {
    mode,
    config: {
      profile: 'preview',
      dataSource: {
        mode: 'backend-api',
        datasetVersion: 'preview-v2',
      },
      services: {
        apiBaseUrl: 'https://example.com/api',
        analyticsWriteKey: null,
      },
      logging: {
        level: 'debug',
      },
      featureGates: {
        radar: true,
        analytics: false,
        remoteRefresh: false,
        mvEmbed: true,
        shareActions: true,
      },
      build: {
        version: '0.1.0',
        commitSha: 'test-sha',
      },
    },
    issues:
      mode === 'degraded'
        ? [
            {
              kind: 'invalid_runtime_config',
              message: 'Runtime config is degraded.',
            },
          ]
        : [],
  };
}

describe('dataset failure policy', () => {
  test('falls back to bundled degraded mode when runtime config is already degraded', async () => {
    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('degraded'),
    });

    expect(policy.mode).toBe('degraded');
    expect(policy.activeSource).toBe('bundled-static');
    expect(policy.selection.kind).toBe('bundled-static');
    expect(policy.selection.reason).toBe('runtime_degraded');
    expect(policy.issues).toEqual([
      expect.objectContaining({
        kind: 'invalid_runtime_config',
      }),
    ]);
  });

  test('stays in normal mode when runtime config is healthy', async () => {
    const selection = createBundledDatasetSelection('preview-v2', 'backend_api_mode');
    const policy = await resolveDatasetFailurePolicy({
      runtimeState: createRuntimeState('normal'),
      selection,
    });

    expect(policy.mode).toBe('normal');
    expect(policy.activeSource).toBe('bundled-static');
    expect(policy.selection).toEqual(selection);
    expect(policy.issues).toEqual([]);
  });
});
