export type BridgeSearchIndexEntity = {
  entity_slug?: string
  canonical_path?: string
  display_name?: string
  canonical_name?: string
  entity_type?: string
  agency_name?: string | null
  matched_alias?: string | null
  match_reason?: string
  search_terms?: string[]
  latest_release?: {
    release_id?: string
    release_title?: string
    release_date?: string
    stream?: string
    release_kind?: string | null
  } | null
  next_upcoming?: {
    headline?: string
    scheduled_date?: string | null
    scheduled_month?: string | null
    date_precision?: string
    date_status?: string
    release_format?: string | null
    confidence_score?: number | null
  } | null
}

export type BridgeSearchIndexRelease = {
  release_id?: string
  canonical_path?: string
  detail_path?: string
  entity_path?: string
  entity_slug?: string
  display_name?: string
  release_title?: string
  release_date?: string
  stream?: string
  release_kind?: string | null
  release_format?: string | null
  matched_alias?: string | null
  match_reason?: string
  search_terms?: string[]
}

export type BridgeSearchIndexUpcoming = {
  upcoming_signal_id?: string
  entity_path?: string
  entity_slug?: string
  display_name?: string
  headline?: string
  scheduled_date?: string | null
  scheduled_month?: string | null
  date_precision?: string
  date_status?: string
  release_format?: string | null
  confidence_score?: number | null
  source_type?: string | null
  source_url?: string | null
  source_domain?: string | null
  evidence_summary?: string | null
  matched_alias?: string | null
  match_reason?: string
  search_terms?: string[]
}

export type BridgeSearchIndex = {
  entities?: BridgeSearchIndexEntity[]
  releases?: BridgeSearchIndexRelease[]
  upcoming?: BridgeSearchIndexUpcoming[]
}

export type BridgeSearchApiData = {
  entities: BridgeSearchIndexEntity[]
  releases: BridgeSearchIndexRelease[]
  upcoming: BridgeSearchIndexUpcoming[]
}

export function normalizeBridgeSearchTerm(value: string) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_./]+/g, '')
    .trim()
}

function compareBridgeSearchMatch(left: { _score: number; _label: string }, right: { _score: number; _label: string }) {
  if (right._score !== left._score) {
    return right._score - left._score
  }

  return left._label.localeCompare(right._label)
}

export function buildBridgeSearchApiData(index: BridgeSearchIndex, search: string): BridgeSearchApiData {
  const query = normalizeBridgeSearchTerm(search)
  if (!query) {
    return {
      entities: [],
      releases: [],
      upcoming: [],
    }
  }

  const entities = (Array.isArray(index.entities) ? index.entities : [])
    .flatMap((item) => {
      const displayName = typeof item.display_name === 'string' ? item.display_name : ''
      const searchTerms = Array.isArray(item.search_terms) ? item.search_terms : []
      let bestScore = 0
      let matchedAlias: string | null = null

      for (const term of searchTerms) {
        const normalized = normalizeBridgeSearchTerm(term)
        if (!normalized) {
          continue
        }

        if (normalized === query) {
          bestScore = Math.max(bestScore, 300)
          matchedAlias = term
          continue
        }

        if (normalized.includes(query) || query.includes(normalized)) {
          bestScore = Math.max(bestScore, 150)
          matchedAlias = term
        }
      }

      if (!bestScore && normalizeBridgeSearchTerm(displayName).includes(query)) {
        bestScore = 120
      }

      if (!bestScore) {
        return []
      }

      return [
        {
          ...item,
          matched_alias: matchedAlias,
          match_reason: bestScore >= 300 ? 'alias_exact' : 'partial',
          _score: bestScore,
          _label: displayName,
        },
      ]
    })
    .sort(compareBridgeSearchMatch)
    .slice(0, 20)
    .map((item) => {
      const { _score, _label, ...next } = item
      void _score
      void _label
      return next
    })

  const releases = (Array.isArray(index.releases) ? index.releases : [])
    .flatMap((item) => {
      const releaseTitle = typeof item.release_title === 'string' ? item.release_title : ''
      const searchTerms = Array.isArray(item.search_terms) ? item.search_terms : []
      let bestScore = 0
      let matchedAlias: string | null = null

      for (const term of searchTerms) {
        const normalized = normalizeBridgeSearchTerm(term)
        if (!normalized) {
          continue
        }

        if (normalized === query) {
          bestScore = Math.max(bestScore, 260)
          matchedAlias = term
          continue
        }

        if (normalized.includes(query) || query.includes(normalized)) {
          bestScore = Math.max(bestScore, 130)
          matchedAlias = term
        }
      }

      if (!bestScore && normalizeBridgeSearchTerm(releaseTitle).includes(query)) {
        bestScore = 110
      }

      if (!bestScore) {
        return []
      }

      return [
        {
          ...item,
          matched_alias: matchedAlias,
          match_reason: bestScore >= 260 ? 'release_title_exact' : 'release_title_partial',
          _score: bestScore,
          _label: releaseTitle,
        },
      ]
    })
    .sort(compareBridgeSearchMatch)
    .slice(0, 20)
    .map((item) => {
      const { _score, _label, ...next } = item
      void _score
      void _label
      return next
    })

  const upcoming = (Array.isArray(index.upcoming) ? index.upcoming : [])
    .flatMap((item) => {
      const headline = typeof item.headline === 'string' ? item.headline : ''
      const searchTerms = Array.isArray(item.search_terms) ? item.search_terms : []
      let bestScore = 0
      let matchedAlias: string | null = null

      for (const term of searchTerms) {
        const normalized = normalizeBridgeSearchTerm(term)
        if (!normalized) {
          continue
        }

        if (normalized === query) {
          bestScore = Math.max(bestScore, 240)
          matchedAlias = term
          continue
        }

        if (normalized.includes(query) || query.includes(normalized)) {
          bestScore = Math.max(bestScore, 120)
          matchedAlias = term
        }
      }

      if (!bestScore && normalizeBridgeSearchTerm(headline).includes(query)) {
        bestScore = 100
      }

      if (!bestScore) {
        return []
      }

      return [
        {
          ...item,
          matched_alias: matchedAlias,
          match_reason: bestScore >= 240 ? 'entity_exact' : 'partial',
          _score: bestScore,
          _label: headline,
        },
      ]
    })
    .sort(compareBridgeSearchMatch)
    .slice(0, 20)
    .map((item) => {
      const { _score, _label, ...next } = item
      void _score
      void _label
      return next
    })

  return {
    entities,
    releases,
    upcoming,
  }
}
