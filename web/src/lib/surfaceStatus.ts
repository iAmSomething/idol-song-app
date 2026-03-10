export type SurfaceStatusSource = 'api' | 'json' | 'json_fallback' | 'backend_unavailable'
export type SurfaceFallbackReasonKey =
  | 'timeout'
  | 'network_error'
  | 'not_found'
  | 'stale_projection'
  | 'disallowed_origin'
  | 'invalid_request'
  | 'unknown'

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
