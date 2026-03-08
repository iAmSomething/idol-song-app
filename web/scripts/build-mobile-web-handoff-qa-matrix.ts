import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  MOBILE_WEB_QA_BROWSER_CONTEXTS,
  buildMobileWebHandoffQaRows,
  buildMobileWebHandoffServiceNotes,
} from '../src/lib/mobileWebHandoff'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const reportDir = path.resolve(scriptDir, '..', 'reports')
const markdownPath = path.join(reportDir, 'mobile-web-handoff-qa-matrix.md')
const jsonPath = path.join(reportDir, 'mobile-web-handoff-qa-matrix.json')

const generatedAt = new Date().toISOString()
const rows = buildMobileWebHandoffQaRows()
const serviceNotes = buildMobileWebHandoffServiceNotes()

assert(rows.some((row) => row.browserContextId === 'android_chrome'))
assert(rows.some((row) => row.browserContextId === 'ios_safari'))
assert(rows.some((row) => row.container === 'in_app_browser'))
assert(rows.some((row) => row.mode === 'canonical'))
assert(rows.some((row) => row.mode === 'search'))
assert(rows.some((row) => row.appInstalled))
assert(rows.some((row) => !row.appInstalled))
assert(rows.some((row) => row.service === 'spotify'))
assert(rows.some((row) => row.service === 'youtube_music'))
assert(rows.some((row) => row.service === 'youtube_mv'))

const payload = {
  generatedAt,
  evidenceBasis:
    'Generated from the production mobile-web handoff helper. These rows describe current code-path behavior and the QA expectation each browser context should verify.',
  contexts: MOBILE_WEB_QA_BROWSER_CONTEXTS,
  serviceNotes,
  rowCount: rows.length,
  rows,
}

function renderMarkdown() {
  const lines: string[] = [
    '# Mobile Web Handoff QA Matrix',
    '',
    `- Generated at: ${generatedAt}`,
    '- Evidence basis: production `web/src/lib/mobileWebHandoff.ts` code-path evaluation',
    '- Scope: Android Chrome, iOS Safari, representative iOS in-app browser, installed/not-installed, canonical/search fallback, service-specific differences',
    '',
    '## Service Behavior Summary',
    '',
  ]

  for (const note of serviceNotes) {
    lines.push(`- \`${note.service}\`: ${note.summary}`)
  }

  lines.push('', '## Browser Contexts', '')
  for (const context of MOBILE_WEB_QA_BROWSER_CONTEXTS) {
    lines.push(`- \`${context.label}\` (${context.evidenceLabel})`)
  }

  lines.push(
    '',
    '## Detailed Matrix',
    '',
    '| Browser | Service | Mode | App Installed | Code Path | QA Class | Observed Behavior | QA Expectation | Notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  )

  for (const row of rows) {
    lines.push(
      `| ${row.browserContextLabel} | ${row.service} | ${row.mode} | ${row.appInstalled ? 'yes' : 'no'} | ${row.codePath}${row.appHref ? `<br/><small>${row.appHref}</small>` : ''} | ${row.qaClass} | ${row.observedBehavior} | ${row.qaExpectation} | ${row.notes} |`,
    )
  }

  lines.push(
    '',
    '## QA Interpretation',
    '',
    '- `expected`: the current web implementation has an app-first path and the browser context should preserve a same-service web fallback when the app does not open.',
    '- `best_effort`: the current web implementation tries app-first, but browser/container policy may suppress the external-app jump. QA should verify that the same-service web fallback still wins when the browser stays visible.',
    '- `web_only`: the current web implementation has no app-aware branch for that service/context, so the same-service web URL is the intended behavior regardless of install state.',
  )

  return `${lines.join('\n')}\n`
}

mkdirSync(reportDir, { recursive: true })
writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`)
writeFileSync(markdownPath, renderMarkdown())

console.log(`mobile web handoff QA matrix written: ${markdownPath}`)
console.log(`mobile web handoff QA matrix written: ${jsonPath}`)
