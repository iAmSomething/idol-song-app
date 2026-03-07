export function buildNotImplementedEnvelope(route: string, timezone: string) {
  return {
    meta: {
      route,
      generated_at: new Date().toISOString(),
      timezone,
    },
    error: {
      code: 'not_implemented',
      message: 'Route shell is registered but not implemented yet.',
    },
  };
}
