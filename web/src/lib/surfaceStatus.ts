export type SurfaceStatusSource = 'json' | 'api' | 'json_fallback' | 'api_error'
export type SurfaceFallbackReasonKey =
  | 'timeout'
  | 'network_error'
  | 'not_found'
  | 'stale_projection'
  | 'disallowed_origin'
  | 'invalid_request'
  | 'unknown'

type SurfaceStatusLabels = {
  sourceLabel: string
  reasonLabel: string
  traceLabel: string
  sourceStateLabels: Record<SurfaceStatusSource, string>
  fallbackReasonLabels: Record<SurfaceFallbackReasonKey, string>
}

export function getSurfaceFallbackReasonKey(errorCode: string | null): SurfaceFallbackReasonKey | null {
  if (!errorCode) {
    return null
  }

  if (errorCode === 'timeout') {
    return 'timeout'
  }

  if (errorCode === 'network_error') {
    return 'network_error'
  }

  if (errorCode === 'stale_projection') {
    return 'stale_projection'
  }

  if (errorCode === 'disallowed_origin') {
    return 'disallowed_origin'
  }

  if (errorCode === 'invalid_request') {
    return 'invalid_request'
  }

  if (errorCode === 'not_found' || /_(404)$/.test(errorCode)) {
    return 'not_found'
  }

  if (/_(400|422)$/.test(errorCode)) {
    return 'invalid_request'
  }

  return 'unknown'
}

export function buildSurfaceStatusMeta({
  source,
  errorCode,
  traceId,
  labels,
}: {
  source: SurfaceStatusSource
  errorCode: string | null
  traceId?: string | null
  labels: SurfaceStatusLabels
}) {
  const parts = [`${labels.sourceLabel}: ${labels.sourceStateLabels[source]}`]
  const reason = source === 'json_fallback' || source === 'api_error' ? getSurfaceFallbackReasonKey(errorCode) : null

  if (reason) {
    parts.push(`${labels.reasonLabel}: ${labels.fallbackReasonLabels[reason]}`)
  }

  if (traceId) {
    parts.push(`${labels.traceLabel}: ${traceId}`)
  }

  return parts.join(' · ')
}
