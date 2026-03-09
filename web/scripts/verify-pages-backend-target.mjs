import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const metadataPath = path.join(webRoot, 'public', '__bridge', 'v1', 'meta', 'backend-target.json')

const expectedApiBaseUrl = normalizeApiBaseUrl(process.env.VITE_API_BASE_URL ?? '')
const explicitTargetEnvironment = normalizeTargetEnvironment(process.env.VITE_BACKEND_TARGET_ENV ?? '')
const metadata = await readJson(metadataPath)
const data = metadata?.data ?? {}
const runtimeMode = data.runtime_mode
const configuredApiBaseUrl = normalizeApiBaseUrl(data.configured_api_base_url ?? '')
const targetEnvironment = normalizeTargetEnvironment(data.target_environment ?? '')
const targetClassification = normalizeTargetClassification(data.target_classification ?? '')
const effectiveTarget = String(data.effective_target ?? '')
const expectedClassification = classifyBackendTarget(expectedApiBaseUrl)
const expectedEnvironment = explicitTargetEnvironment || (expectedApiBaseUrl ? expectedClassification : 'bridge')

if (runtimeMode !== (expectedApiBaseUrl ? 'api' : 'bridge')) {
  throw new Error(`Runtime mode mismatch. Expected ${expectedApiBaseUrl ? 'api' : 'bridge'}, got ${String(runtimeMode)}.`)
}

if (configuredApiBaseUrl !== expectedApiBaseUrl) {
  throw new Error(`Configured API base mismatch. Expected ${expectedApiBaseUrl || '(empty)'}, got ${configuredApiBaseUrl || '(empty)'}.`)
}

if (targetEnvironment !== expectedEnvironment) {
  throw new Error(`Target environment mismatch. Expected ${expectedEnvironment}, got ${targetEnvironment || '(empty)'}.`)
}

if (targetClassification !== expectedClassification) {
  throw new Error(`Target classification mismatch. Expected ${expectedClassification}, got ${targetClassification || '(empty)'}.`)
}

if (explicitTargetEnvironment === 'production' || explicitTargetEnvironment === 'preview' || explicitTargetEnvironment === 'local') {
  if (!expectedApiBaseUrl) {
    throw new Error(`Missing VITE_API_BASE_URL for ${explicitTargetEnvironment} target.`)
  }

  if (targetClassification !== explicitTargetEnvironment) {
    throw new Error(
      `Explicit target environment ${explicitTargetEnvironment} does not match classified backend target ${targetClassification}.`,
    )
  }
}

if (explicitTargetEnvironment === 'bridge' && expectedApiBaseUrl) {
  throw new Error('Explicit bridge target must not set VITE_API_BASE_URL.')
}

if (runtimeMode === 'bridge' && effectiveTarget !== '/__bridge/v1') {
  throw new Error(`Bridge target mismatch. Expected /__bridge/v1, got ${effectiveTarget}.`)
}

if (runtimeMode === 'api' && effectiveTarget !== expectedApiBaseUrl) {
  throw new Error(`Effective target mismatch. Expected ${expectedApiBaseUrl}, got ${effectiveTarget}.`)
}

if (!String(data.diagnostics_path ?? '').endsWith('/__bridge/v1/meta/backend-target.json')) {
  throw new Error('Expected diagnostics_path to point at /__bridge/v1/meta/backend-target.json.')
}

console.log(
  JSON.stringify(
    {
      requestId: metadata?.meta?.request_id ?? null,
      runtimeMode,
      targetEnvironment,
      targetClassification,
      configuredApiBaseUrl: configuredApiBaseUrl || null,
      effectiveTarget,
      diagnosticsPath: data.diagnostics_path ?? null,
    },
    null,
    2,
  ),
)

function normalizeApiBaseUrl(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/\/+$/, '')
}

function normalizeTargetEnvironment(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'production' || normalized === 'preview' || normalized === 'local' || normalized === 'bridge'
    ? normalized
    : ''
}

function normalizeTargetClassification(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'production' ||
    normalized === 'preview' ||
    normalized === 'local' ||
    normalized === 'bridge' ||
    normalized === 'unknown'
    ? normalized
    : ''
}

function classifyBackendTarget(apiBaseUrl) {
  if (!apiBaseUrl) {
    return 'bridge'
  }

  try {
    const hostname = new URL(apiBaseUrl).hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      hostname.startsWith('127.')
    ) {
      return 'local'
    }

    if (
      hostname.includes('preview') ||
      hostname.includes('staging') ||
      hostname.includes('dev') ||
      hostname.includes('test')
    ) {
      return 'preview'
    }

    return 'production'
  } catch {
    return 'unknown'
  }
}

async function readJson(targetPath) {
  const contents = await readFile(targetPath, 'utf8')
  return JSON.parse(contents)
}
