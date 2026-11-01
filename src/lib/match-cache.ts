import type { JournalMatch } from '../types'

const PREFIX = 'pubrooter.matchcache.v1.'
const TTL_MS = 30 * 60 * 1000
const MAX_ENTRIES = 12

export interface CachedMatches {
  matches: JournalMatch[]
  notices: string[]
  candidateCount: number
  at: number
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Stable key for a manuscript regardless of case, whitespace, and keyword
// order: two uploads of the same file produce the same key, so repeated
// analyses of the same manuscript return identical rankings even when the
// underlying APIs reorder their live results between requests.
export function matchCacheKey(title: string, abstract: string, keywords: string[]): string {
  const raw = [
    normalizeText(title),
    normalizeText(abstract),
    [...keywords].map(normalizeText).filter(Boolean).sort().join('|')
  ].join('\n')
  let h = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

export function readMatchCache(key: string): CachedMatches | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedMatches
    if (!parsed || !Array.isArray(parsed.matches) || parsed.matches.length === 0) return null
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeMatchCache(key: string, data: { matches: JournalMatch[]; notices: string[]; candidateCount: number }): void {
  try {
    const payload: CachedMatches = { ...data, at: Date.now() }
    localStorage.setItem(PREFIX + key, JSON.stringify(payload))
    const entries: { k: string; at: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? '{}') as CachedMatches
        entries.push({ k, at: typeof parsed.at === 'number' ? parsed.at : 0 })
      } catch {
        entries.push({ k, at: 0 })
      }
    }
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => a.at - b.at)
      for (const e of entries.slice(0, entries.length - MAX_ENTRIES)) localStorage.removeItem(e.k)
    }
  } catch {
    // Storage unavailable — analysis simply refetches.
  }
}
