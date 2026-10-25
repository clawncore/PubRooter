import type { JournalCandidate } from '../types'

interface CrossrefWorkItem {
  ISSN?: string[]
  title?: string
  publisher?: string
  URL?: string
  subject?: string[]
  'container-title'?: string[]
}

interface CrossrefJournalItem {
  ISSN?: string[]
  title: string
  publisher?: string
  URL?: string
  'container-title'?: string[]
}

/**
 * Candidate discovery in two legs:
 * 1. Journals that published matching papers — Crossref works search by
 *    bibliographic query; each container with an ISSN becomes a candidate.
 * 2. Journals whose names match the manuscript keywords (supplementary).
 * Throws only when nothing could be retrieved at all.
 */
export async function searchCrossref(title: string, keywords: string[]): Promise<JournalCandidate[]> {
  const query = [title, ...keywords].filter(Boolean).join(' ').slice(0, 300)
  const seen = new Set<string>()
  const out: JournalCandidate[] = []
  let failed = 0

  try {
    const url = new URL('https://api.crossref.org/works')
    url.searchParams.set('query.bibliographic', query)
    url.searchParams.set('rows', '20')
    url.searchParams.set('select', 'container-title,ISSN,publisher,URL,subject')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Crossref works ${res.status}`)
    const data = await res.json()
    for (const item of ((data.message?.items ?? []) as CrossrefWorkItem[])) {
      const container = item['container-title']?.[0]
      const issn = item.ISSN?.[0]
      if (!container || !issn) continue
      const key = issn.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        id: `crossref:${issn}`,
        title: container,
        issn,
        publisher: item.publisher,
        subjects: (item.subject ?? []).slice(0, 8),
        source: 'crossref',
        sourceUrl: item.URL
      })
    }
  } catch {
    failed++
  }

  try {
    const kwQuery = keywords.filter(Boolean).join(' ').slice(0, 160) || title.slice(0, 160)
    const url = new URL('https://api.crossref.org/journals')
    url.searchParams.set('query', kwQuery)
    url.searchParams.set('rows', '15')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Crossref ${res.status}`)
    const data = await res.json()
    for (const item of ((data.message?.items ?? []) as CrossrefJournalItem[])) {
      const issn = item.ISSN?.[0]
      const key = issn ? issn.toLowerCase() : `t:${item.title.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        id: `crossref:${issn ?? item.URL}`,
        title: item.title,
        issn,
        publisher: item.publisher,
        subjects: item['container-title'] ?? [],
        source: 'crossref',
        sourceUrl: item.URL,
        homepageUrl: item.URL
      })
    }
  } catch {
    failed++
  }

  if (out.length === 0 && failed > 0) throw new Error('Crossref unreachable')
  return out
}
