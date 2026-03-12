import { readFile } from 'node:fs/promises'
import path from 'node:path'

export function normalizeApiBaseUrl(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return ''
  }

  return normalized.replace(/\/+$/, '')
}

export function normalizeTargetEnvironment(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'production' || normalized === 'preview' || normalized === 'local' || normalized === 'bridge'
    ? normalized
    : ''
}

export function classifyBackendTarget(apiBaseUrl) {
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

export async function readBackendHandoffTarget(handoffPath) {
  const contents = await readFile(handoffPath, 'utf8')
  const payload = JSON.parse(contents)
  return {
    backendPublicUrl: normalizeApiBaseUrl(payload?.target?.backend_public_url ?? ''),
    targetEnvironment: normalizeTargetEnvironment(payload?.target?.environment ?? ''),
    targetClassification: classifyBackendTarget(payload?.target?.backend_public_url ?? ''),
  }
}

export async function resolvePagesApiRuntimeConfig({
  repoRoot,
  configuredApiBaseUrl,
  configuredTargetEnvironment,
}) {
  const normalizedConfiguredApiBaseUrl = normalizeApiBaseUrl(configuredApiBaseUrl)
  const normalizedConfiguredTargetEnvironment = normalizeTargetEnvironment(configuredTargetEnvironment)
  const handoffPath = path.join(repoRoot, 'backend', 'reports', 'backend_freshness_handoff.json')
  const handoffTarget = await readBackendHandoffTarget(handoffPath)
  const resolvedApiBaseUrl = normalizedConfiguredApiBaseUrl || handoffTarget.backendPublicUrl

  if (!resolvedApiBaseUrl) {
    throw new Error(
      'Unable to resolve a Pages API base URL. Set VITE_API_BASE_URL or provide backend/reports/backend_freshness_handoff.json with target.backend_public_url.',
    )
  }

  let resolvedTargetEnvironment = normalizedConfiguredTargetEnvironment || handoffTarget.targetEnvironment
  if (!resolvedTargetEnvironment || resolvedTargetEnvironment === 'bridge') {
    resolvedTargetEnvironment = 'production'
  }

  let parsedUrl
  try {
    parsedUrl = new URL(resolvedApiBaseUrl)
  } catch {
    throw new Error(`Resolved Pages API base URL is not a valid absolute URL: ${resolvedApiBaseUrl}`)
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`Resolved Pages API base URL must use https: ${resolvedApiBaseUrl}`)
  }

  const resolvedClassification = classifyBackendTarget(resolvedApiBaseUrl)

  if (resolvedTargetEnvironment !== resolvedClassification) {
    throw new Error(
      `Resolved Pages target environment ${resolvedTargetEnvironment} does not match classified API target ${resolvedClassification}.`,
    )
  }

  return {
    apiBaseUrl: resolvedApiBaseUrl,
    targetEnvironment: resolvedTargetEnvironment,
    targetClassification: resolvedClassification,
    source: normalizedConfiguredApiBaseUrl ? 'env' : 'backend_freshness_handoff',
    handoffPath,
  }
}
