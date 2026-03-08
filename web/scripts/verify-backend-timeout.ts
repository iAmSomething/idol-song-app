import assert from 'node:assert/strict'

import {
  BackendFetchNetworkError,
  BackendFetchTimeoutError,
  classifyBackendFetchError,
  extractBackendFetchRequestId,
  fetchJsonWithTimeout,
} from '../src/lib/backendFetch'

type FetchResponseLike = Pick<Response, 'ok' | 'status' | 'json'>

function buildResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as FetchResponseLike as Response
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError')
}

function delayWithAbort(ms: number, signal: AbortSignal | null | undefined) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms)

    if (!signal) {
      return
    }

    if (signal.aborted) {
      clearTimeout(timeoutId)
      reject(createAbortError())
      return
    }

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId)
        reject(createAbortError())
      },
      { once: true },
    )
  })
}

async function run() {
  await assert.rejects(
    fetchJsonWithTimeout<{ ok: true }>('https://timeout.example/test', {
      signal: new AbortController().signal,
      timeoutMs: 20,
      fetchImpl: async (_url, init) => {
        await delayWithAbort(60, init?.signal)
        return buildResponse({ ok: true })
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof BackendFetchTimeoutError)
      assert.equal(classifyBackendFetchError(error), 'timeout')
      assert.equal(typeof error.requestId, 'string')
      assert.equal(extractBackendFetchRequestId(error), error.requestId)
      return true
    },
  )

  const externalAbortController = new AbortController()
  const externalAbortPromise = fetchJsonWithTimeout<{ ok: true }>('https://abort.example/test', {
    signal: externalAbortController.signal,
    timeoutMs: 1000,
    fetchImpl: async (_url, init) => {
      await delayWithAbort(60, init?.signal)
      return buildResponse({ ok: true })
    },
  })
  externalAbortController.abort()

  await assert.rejects(externalAbortPromise, (error: unknown) => {
    assert.equal(classifyBackendFetchError(error), null)
    return true
  })

  assert.equal(classifyBackendFetchError(new Error('socket hang up')), 'network_error')
  const networkError = new BackendFetchNetworkError('web-search-123', new Error('socket hang up'))
  assert.equal(classifyBackendFetchError(networkError), 'network_error')
  assert.equal(extractBackendFetchRequestId(networkError), 'web-search-123')

  const success = await fetchJsonWithTimeout<{ ok: true }>('https://success.example/test', {
    signal: new AbortController().signal,
    timeoutMs: 50,
    fetchImpl: async () => buildResponse({ ok: true }),
  })

  assert.equal(success.ok, true)
  assert.equal(success.status, 200)
  assert.deepEqual(success.body, { ok: true })
  assert.equal(typeof success.requestId, 'string')
  assert.equal(success.responseRequestId, null)

  console.log('backend timeout verification passed')
}

void run()
