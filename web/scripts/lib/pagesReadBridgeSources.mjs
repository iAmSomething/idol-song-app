import fs from 'node:fs/promises'
import path from 'node:path'

const EXPORT_ROOT = path.join('backend', 'exports', 'non_runtime_web_snapshots')
const DATA_ROOT = path.join('web', 'src', 'data')

export async function resolvePreferredBridgeSourcePath(repoRoot, fileName) {
  const exportPath = path.join(repoRoot, EXPORT_ROOT, fileName)
  try {
    await fs.access(exportPath)
    return exportPath
  } catch {
    return path.join(repoRoot, DATA_ROOT, fileName)
  }
}

export async function readPreferredBridgeJson(repoRoot, fileName) {
  const sourcePath = await resolvePreferredBridgeSourcePath(repoRoot, fileName)
  const contents = await fs.readFile(sourcePath, 'utf8')
  return JSON.parse(contents)
}
