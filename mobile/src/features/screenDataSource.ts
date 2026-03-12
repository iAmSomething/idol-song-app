import type { RuntimeConfigState } from '../config/runtime';

export type ScreenDataSourceActiveSource =
  | 'backend-api'
  | 'backend-cache';

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
