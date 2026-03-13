export type RuntimeRefreshMode = 'api' | 'bridge'

type ShouldReloadForRuntimeRefreshInput = {
  previousGeneration: string | null
  nextGeneration: string | null
  currentRuntimeMode: RuntimeRefreshMode
  currentEffectiveTarget: string | null
  diagnosticsRuntimeMode: string | null
  diagnosticsEffectiveTarget: string | null
}

function normalizeTarget(value: string | null): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().replace(/\/+$/, '')
  return normalized.length > 0 ? normalized : null
}

export function shouldReloadForRuntimeRefresh({
  previousGeneration,
  nextGeneration,
  currentRuntimeMode,
  currentEffectiveTarget,
  diagnosticsRuntimeMode,
  diagnosticsEffectiveTarget,
}: ShouldReloadForRuntimeRefreshInput): boolean {
  if (!nextGeneration || !previousGeneration) {
    return false
  }

  if (previousGeneration !== nextGeneration) {
    return true
  }

  const normalizedDiagnosticsMode = diagnosticsRuntimeMode === 'api' || diagnosticsRuntimeMode === 'bridge'
    ? diagnosticsRuntimeMode
    : null

  if (normalizedDiagnosticsMode && normalizedDiagnosticsMode !== currentRuntimeMode) {
    return true
  }

  const normalizedCurrentTarget = normalizeTarget(currentEffectiveTarget)
  const normalizedDiagnosticsTarget = normalizeTarget(diagnosticsEffectiveTarget)

  if (
    normalizedCurrentTarget &&
    normalizedDiagnosticsTarget &&
    normalizedCurrentTarget !== normalizedDiagnosticsTarget
  ) {
    return true
  }

  return false
}
