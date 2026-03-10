import type { RuntimeConfigState } from '../config/runtime';

export type ScreenDataSourceActiveSource =
  | 'bundled-static'
  | 'backend-api'
  | 'backend-cache'
  | 'bundled-static-fallback';

export type ScreenDataFreshness = {
  rollingReferenceAt: string | null;
  staleFreshnessClasses: string[];
  cachedAt?: string | null;
  generatedAt?: string | null;
};

export type ScreenDataSource<T = unknown> = {
  activeSource: ScreenDataSourceActiveSource;
  sourceLabel: string;
  issues: string[];
  freshness: ScreenDataFreshness;
  runtimeState: RuntimeConfigState;
  data: T;
};
