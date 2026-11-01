import type { JournalCandidate } from '../types'

/** True for absolute http(s) URLs. */
export function isHttpUrl(u: string | undefined | null): u is string {
  if (!u) return false
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** OpenAlex record pages are provenance, never a journal's own site. */
export function isUnwantedSiteUrl(u: string | undefined | null): boolean {
  if (!u) return true
  try {
    const host = new URL(u).hostname.toLowerCase()
    return host === 'openalex.org' || host.endsWith('.openalex.org')
  } catch {
    return true
  }
}

/**
 * Sync best guess at the journal's own website.
 * Only returns a real publisher/journal URL; never openalex.org, never example.com.
 */
export function journalSiteUrl(journal: Pick<JournalCandidate, 'homepageUrl' | 'issn' | 'id'>): string | undefined {
  if (isHttpUrl(journal.homepageUrl) && !isUnwantedSiteUrl(journal.homepageUrl)) {
    return journal.homepageUrl
  }
  return undefined
}

const CACHE_PREFIX = 'pubrooter.site.'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function cacheGet(key: string): string | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { url?: string; at?: number }
    if (!parsed.url || !parsed.at || Date.now() - parsed.at > CACHE_TTL_MS) return undefined
    return parsed.url
  } catch {
    return undefined
  }
}

function cacheSet(key: string, url: string | undefined): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ url: url ?? null, at: Date.now() }))
  } catch {
    /* storage unavailable. Ignore */
  }
}

function dashedIssn(issn: string | undefined): string | undefined {
  if (!issn) return undefined
  const raw = issn.trim()
  if (!raw) return undefined
  if (raw.includes('-')) return raw
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

/**
 * Resolve the journal's real website. Order:
 * 1. homepage already on the candidate (validated)
 * 2. Crossref journals API by ISSN
 * 3. OpenAlex sources API by ISSN (recovers homepages for Crossref-sourced candidates)
 * Results (including misses) are cached per journal for a week.
 */
export async function resolveJournalSite(
  journal: Pick<JournalCandidate, 'homepageUrl' | 'issn' | 'id'>,
  fetchFn: typeof fetch = fetch
): Promise<string | undefined> {
  const direct = journalSiteUrl(journal)
  if (direct) return direct

  const key = journal.id || dashedIssn(journal.issn) || journal.homepageUrl || ''
  if (!key) return undefined
  const cached = cacheGet(key)
  if (cached !== undefined) return cached || undefined

  const issn = dashedIssn(journal.issn)
  let resolved: string | undefined

  if (issn) {
    try {
      const res = await fetchFn(`https://api.crossref.org/journals/${encodeURIComponent(issn)}`)
      if (res.ok) {
        const data = (await res.json()) as { message?: { URL?: string } }
        const url = data.message?.URL
        if (isHttpUrl(url) && !isUnwantedSiteUrl(url)) resolved = url
      }
    } catch {
      /* crossref unavailable. Continue */
    }
  }

  if (!resolved && issn) {
    try {
      const res = await fetchFn(
        `https://api.openalex.org/sources?filter=issn:${encodeURIComponent(issn)}&select=homepage_url&per_page=1`
      )
      if (res.ok) {
        const data = (await res.json()) as { results?: { homepage_url?: string }[] }
        const url = data.results?.[0]?.homepage_url
        if (isHttpUrl(url) && !isUnwantedSiteUrl(url)) resolved = url
      }
    } catch {
      /* openalex unavailable. Continue */
    }
  }

  cacheSet(key, resolved)
  return resolved
}
