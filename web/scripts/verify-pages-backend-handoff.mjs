import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')
const handoffPath = resolveArtifactPath(process.env.BACKEND_FRESHNESS_HANDOFF_PATH)

const expectedApiBaseUrl = normalizeApiBaseUrl(process.env.VITE_API_BASE_URL ?? '')
const explicitTargetEnvironment = normalizeTargetEnvironment(process.env.VITE_BACKEND_TARGET_ENV ?? '')
const expectedTargetClassification = classifyBackendTarget(expectedApiBaseUrl)
const expectedTargetEnvironment = explicitTargetEnvironment || (expectedApiBaseUrl ? expectedTargetClassification : 'bridge')

const handoff = await readJson(handoffPath)
const target = handoff?.target ?? {}
const checks = handoff?.prerequisite_checks ?? {}

ensurePass('release_pipeline_sync', checks.release_pipeline_sync)
ensurePass('upcoming_pipeline_sync', checks.upcoming_pipeline_sync)
ensurePass('projection_row_counts', checks.projection_row_counts)
ensurePass('sequence_after_sync', checks.sequence_after_sync)
ensurePass('artifact_freshness', checks.artifact_freshness)
ensurePass('target_binding', checks.target_binding)

const handoffTargetEnvironment = normalizeTargetEnvironment(target.environment ?? '')
const handoffTargetClassification = normalizeTargetClassification(target.classification ?? '')
const handoffApiBaseUrl = normalizeApiBaseUrl(target.backend_public_url ?? '')

if (handoff.status !== 'pass') {
  throw new Error(`Backend freshness handoff status must be pass. Got ${String(handoff.status)}.`)
}

if (handoffTargetEnvironment !== expectedTargetEnvironment) {
  throw new Error(
    `Backend freshness handoff target environment mismatch. Expected ${expectedTargetEnvironment}, got ${handoffTargetEnvironment || '(empty)'}.`,
  )
}

if (handoffTargetClassification && handoffTargetClassification !== expectedTargetClassification) {
  throw new Error(
    `Backend freshness handoff target classification mismatch. Expected ${expectedTargetClassification}, got ${handoffTargetClassification || '(empty)'}.`,
  )
}

if (handoffApiBaseUrl && handoffApiBaseUrl !== expectedApiBaseUrl) {
  throw new Error(
    `Backend freshness handoff API base mismatch. Expected ${expectedApiBaseUrl || '(empty)'}, got ${handoffApiBaseUrl || '(empty)'}.`,
  )
}

console.log(
  JSON.stringify(
    {
      handoffPath: path.relative(repoRoot, handoffPath),
      generatedAt: handoff.generated_at ?? null,
      targetEnvironment: handoffTargetEnvironment,
      targetClassification: handoffTargetClassification,
      backendPublicUrl: handoffApiBaseUrl || null,
      summaryLines: Array.isArray(handoff.summary_lines) ? handoff.summary_lines : [],
    },
    null,
    2,
  ),
)

function resolveArtifactPath(value) {
  if (!value) {
    return path.join(repoRoot, 'backend', 'reports', 'backend_freshness_handoff.json')
  }

  return path.isAbsolute(value) ? value : path.resolve(webRoot, value)
}

function ensurePass(label, check) {
  if (!check || check.status !== 'pass') {
    throw new Error(`Backend freshness prerequisite ${label} must be pass. Got ${String(check?.status ?? 'missing')}.`)
  }
}

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
