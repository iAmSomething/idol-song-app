import type { MobileRuntimeConfig } from './runtime';
import {
  FEATURE_GATE_DEFINITIONS,
  getFeatureGateState,
  isFeatureGateEnabled,
  listFeatureGateStates,
} from './featureGates';

const runtimeConfig: MobileRuntimeConfig = {
  profile: 'preview',
  dataSource: {
    mode: 'backend-api',
    datasetVersion: 'preview-v1',
  },
  services: {
    apiBaseUrl: 'https://example.com/api',
    analyticsWriteKey: null,
    expoProjectId: null,
  },
  logging: {
    level: 'debug',
  },
  featureGates: {
    radar: true,
    analytics: false,
    remoteRefresh: false,
    mvEmbed: false,
    shareActions: true,
  },
  build: {
    version: '0.1.0',
    commitSha: 'abc123',
  },
};

describe('feature gate registry', () => {
  test('exposes matrix-aligned gate identifiers', () => {
    expect(FEATURE_GATE_DEFINITIONS.radar.id).toBe('radar_enabled');
    expect(FEATURE_GATE_DEFINITIONS.analytics.id).toBe('analytics_enabled');
    expect(FEATURE_GATE_DEFINITIONS.remoteRefresh.id).toBe('remote_dataset_enabled');
    expect(FEATURE_GATE_DEFINITIONS.mvEmbed.id).toBe('mv_embed_enabled');
    expect(FEATURE_GATE_DEFINITIONS.shareActions.id).toBe('share_actions_enabled');
  });

  test('returns enabled state and fallback description for a single gate', () => {
    const mvEmbedGate = getFeatureGateState('mvEmbed', runtimeConfig);

    expect(mvEmbedGate.enabled).toBe(false);
    expect(mvEmbedGate.offFallback).toContain('external watch CTA');
  });

  test('lists all configured gate states', () => {
    const gateStates = listFeatureGateStates(runtimeConfig);

    expect(gateStates).toHaveLength(5);
    expect(gateStates.map((entry) => entry.id)).toEqual([
      'radar_enabled',
      'analytics_enabled',
      'remote_dataset_enabled',
      'mv_embed_enabled',
      'share_actions_enabled',
    ]);
  });

  test('supports boolean helper lookup', () => {
    expect(isFeatureGateEnabled('radar', runtimeConfig)).toBe(true);
    expect(isFeatureGateEnabled('analytics', runtimeConfig)).toBe(false);
  });
});
