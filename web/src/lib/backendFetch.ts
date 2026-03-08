export class BackendFetchTimeoutError extends Error {
  constructor(message = 'Backend request timed out.') {
    super(message)
    this.name = 'BackendFetchTimeoutError'
  }
}

type FetchJsonWithTimeoutOptions = {
  signal: AbortSignal
  timeoutMs: number
  headers?: HeadersInit
  fetchImpl?: typeof fetch
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function classifyBackendFetchError(error: unknown): 'timeout' | 'network_error' | null {
  if (error instanceof BackendFetchTimeoutError) {
    return 'timeout'
  }

  if (isAbortError(error)) {
    return null
  }

  return 'network_error'
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  { signal, timeoutMs, headers, fetchImpl = fetch }: FetchJsonWithTimeoutOptions,
): Promise<{ ok: boolean; status: number; body: T | null }> {
  const controller = new AbortController()
  let didTimeout = false

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
      headers,
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
    }
  } catch (error) {
    if (didTimeout && isAbortError(error)) {
      throw new BackendFetchTimeoutError()
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
    signal.removeEventListener('abort', onAbort)
  }
}
