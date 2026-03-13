import { normalizeBridgeSearchTerm } from './bridgeSearch'

type SearchEntityLike = {
  entity_slug?: string
  display_name?: string
  canonical_name?: string
  canonical_path?: string
  matched_alias?: string | null
}

export type EntityDetailRecoveryCandidate = {
  entitySlug: string
  displayName: string
}

export function buildEntityDetailRecoverySearchTerms(entitySlug: string) {
  const rawSlug = String(entitySlug ?? '').trim()
  if (!rawSlug) {
    return []
  }

  const humanized = rawSlug
    .split('-')
    .filter(Boolean)
    .join(' ')
    .trim()

  return Array.from(new Set([rawSlug, humanized].filter(Boolean)))
}

export function pickEntityDetailRecoveryCandidate(
  entities: SearchEntityLike[] | null | undefined,
  entitySlug: string,
  searchTerm: string,
) {
  if (!Array.isArray(entities) || !entities.length) {
    return null
  }

  const normalizedSlug = normalizeBridgeSearchTerm(entitySlug)
  const normalizedSearchTerm = normalizeBridgeSearchTerm(searchTerm)
  const canonicalPath = `/artists/${entitySlug}`

  const scored = entities
    .map((item, index) => {
      const candidateSlug = typeof item.entity_slug === 'string' ? item.entity_slug.trim() : ''
      const displayName = typeof item.display_name === 'string' ? item.display_name.trim() : ''
      const canonicalName = typeof item.canonical_name === 'string' ? item.canonical_name.trim() : ''
      const matchedAlias = typeof item.matched_alias === 'string' ? item.matched_alias.trim() : ''
      const candidatePath = typeof item.canonical_path === 'string' ? item.canonical_path.trim() : ''

      if (!candidateSlug || !displayName) {
        return null
      }

      let score = 0
      if (normalizeBridgeSearchTerm(candidateSlug) === normalizedSlug) {
        score = Math.max(score, 500)
      }
      if (candidatePath === canonicalPath) {
        score = Math.max(score, 450)
      }
      if (normalizeBridgeSearchTerm(displayName) === normalizedSearchTerm) {
        score = Math.max(score, 400)
      }
      if (normalizeBridgeSearchTerm(canonicalName) === normalizedSearchTerm) {
        score = Math.max(score, 380)
      }
      if (normalizeBridgeSearchTerm(matchedAlias) === normalizedSearchTerm) {
        score = Math.max(score, 360)
      }

      if (!score) {
        return null
      }

      return {
        entitySlug: candidateSlug,
        displayName,
        score,
        index,
      }
    })
    .filter((item): item is { entitySlug: string; displayName: string; score: number; index: number } => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.index - right.index
    })

  return scored[0]
    ? {
        entitySlug: scored[0].entitySlug,
        displayName: scored[0].displayName,
      }
    : null
}
