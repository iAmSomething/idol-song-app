import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendFile } from 'node:fs/promises'

import { resolvePagesApiRuntimeConfig } from './lib/pagesApiRuntimeConfig.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(webRoot, '..')

const config = await resolvePagesApiRuntimeConfig({
  repoRoot,
  configuredApiBaseUrl: process.env.VITE_API_BASE_URL ?? '',
  configuredTargetEnvironment: process.env.VITE_BACKEND_TARGET_ENV ?? '',
})

if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `api_base_url=${config.apiBaseUrl}\n` +
      `target_environment=${config.targetEnvironment}\n` +
      `target_classification=${config.targetClassification}\n` +
      `source=${config.source}\n`,
  )
}

console.log(
  JSON.stringify(
    {
      apiBaseUrl: config.apiBaseUrl,
      targetEnvironment: config.targetEnvironment,
      targetClassification: config.targetClassification,
      source: config.source,
      handoffPath: path.relative(repoRoot, config.handoffPath),
    },
    null,
    2,
  ),
)
