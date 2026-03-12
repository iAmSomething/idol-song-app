import { getRuntimeConfig, type MobileRuntimeConfig } from './runtime';

export type FeatureGateKey = keyof MobileRuntimeConfig['featureGates'];
export type FeatureGateId =
  | 'radar_enabled'
  | 'analytics_enabled'
  | 'remote_dataset_enabled'
  | 'mv_embed_enabled'
  | 'share_actions_enabled';

export type FeatureGateDefinition = {
  id: FeatureGateId;
  key: FeatureGateKey;
  label: string;
  offFallback: string;
};

export type FeatureGateState = FeatureGateDefinition & {
  enabled: boolean;
};

export const FEATURE_GATE_DEFINITIONS: Record<FeatureGateKey, FeatureGateDefinition> = {
  radar: {
    id: 'radar_enabled',
    key: 'radar',
    label: 'Radar',
    offFallback: 'Hide the tab or keep a read-only placeholder without breaking navigation.',
  },
  analytics: {
    id: 'analytics_enabled',
    key: 'analytics',
    label: 'Analytics',
    offFallback: 'Do not emit events. UI stays unchanged.',
  },
  remoteRefresh: {
    id: 'remote_dataset_enabled',
    key: 'remoteRefresh',
    label: 'Remote dataset refresh',
    offFallback: 'Keep cached backend snapshots when available; otherwise show an explicit error state.',
  },
  mvEmbed: {
    id: 'mv_embed_enabled',
    key: 'mvEmbed',
    label: 'MV embed',
    offFallback: 'Hide the embed and keep the external watch CTA.',
  },
  shareActions: {
    id: 'share_actions_enabled',
    key: 'shareActions',
    label: 'Share actions',
    offFallback: 'Hide share buttons and keep the rest of the surface intact.',
  },
};

export function getFeatureGateState(
  key: FeatureGateKey,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): FeatureGateState {
  const definition = FEATURE_GATE_DEFINITIONS[key];

  return {
    ...definition,
    enabled: runtimeConfig.featureGates[key],
  };
}

export function isFeatureGateEnabled(
  key: FeatureGateKey,
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): boolean {
  return getFeatureGateState(key, runtimeConfig).enabled;
}

export function listFeatureGateStates(
  runtimeConfig: MobileRuntimeConfig = getRuntimeConfig(),
): FeatureGateState[] {
  return (Object.keys(FEATURE_GATE_DEFINITIONS) as FeatureGateKey[]).map((key) =>
    getFeatureGateState(key, runtimeConfig),
  );
}
