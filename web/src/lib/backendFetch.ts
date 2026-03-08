export class BackendFetchTransportError extends Error {
  requestId: string

  constructor(requestId: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'BackendFetchTransportError'
    this.requestId = requestId
  }
}

export class BackendFetchTimeoutError extends BackendFetchTransportError {
  constructor(requestId: string, message = 'Backend request timed out.') {
    super(requestId, message)
    this.name = 'BackendFetchTimeoutError'
  }
}

export class BackendFetchNetworkError extends BackendFetchTransportError {
  constructor(requestId: string, cause: unknown, message = 'Backend request failed before a response was received.') {
    super(requestId, message, { cause })
    this.name = 'BackendFetchNetworkError'
  }
}

type FetchJsonWithTimeoutOptions = {
  signal: AbortSignal
  timeoutMs: number
  headers?: HeadersInit
  fetchImpl?: typeof fetch
  requestIdPrefix?: string
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function normalizeRequestIdPrefix(value: string | undefined): string {
  const normalized = String(value ?? 'web')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'web'
}

function createRequestId(prefix: string | undefined): string {
  const normalizedPrefix = normalizeRequestIdPrefix(prefix)

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${normalizedPrefix}-${crypto.randomUUID()}`
  }

  return `${normalizedPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function readResponseRequestId(body: unknown, response: Response): string | null {
  if (body && typeof body === 'object' && 'meta' in body) {
    const meta = (body as { meta?: { request_id?: unknown } }).meta
    if (meta && typeof meta.request_id === 'string' && meta.request_id.trim().length > 0) {
      return meta.request_id.trim()
    }
  }

  const responseHeaders =
    'headers' in response && response.headers && typeof response.headers.get === 'function' ? response.headers : null
  const headerValue = responseHeaders?.get('x-request-id') ?? responseHeaders?.get('X-Request-Id') ?? null
  return typeof headerValue === 'string' && headerValue.trim().length > 0 ? headerValue.trim() : null
}

export function classifyBackendFetchError(error: unknown): 'timeout' | 'network_error' | null {
  if (error instanceof BackendFetchTimeoutError) {
    return 'timeout'
  }

  if (error instanceof BackendFetchNetworkError) {
    return 'network_error'
  }

  if (isAbortError(error)) {
    return null
  }

  return 'network_error'
}

export function extractBackendFetchRequestId(error: unknown): string | null {
  return error instanceof BackendFetchTransportError ? error.requestId : null
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  { signal, timeoutMs, headers, fetchImpl = fetch, requestIdPrefix }: FetchJsonWithTimeoutOptions,
): Promise<{ ok: boolean; status: number; body: T | null; requestId: string; responseRequestId: string | null }> {
  const controller = new AbortController()
  let didTimeout = false
  const requestId = createRequestId(requestIdPrefix)
  const requestHeaders = new Headers(headers)
  requestHeaders.set('x-request-id', requestId)

  const onAbort = () => {
    controller.abort()
  }

  if (signal.aborted) {
    controller.abort()
  } else {
    signal.addEventListener('abort', onAbort, { once: true })
  }

  const timeoutHandle = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(url, {
      headers: requestHeaders,
      signal: controller.signal,
    })

    let body: T | null = null
    try {
      body = (await response.json()) as T
    } catch {
      body = null
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      requestId,
      responseRequestId: readResponseRequestId(body, response),
    }
  } catch (error) {
    if (didTimeout && isAbortError(error)) {
      throw new BackendFetchTimeoutError(requestId)
    }

    if (!isAbortError(error)) {
      throw new BackendFetchNetworkError(requestId, error)
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
    signal.removeEventListener('abort', onAbort)
  }
}
