import type { JournalCandidate } from '../types'

interface OpenAlexSource {
  id: string
  display_name: string
  issn_l?: string
  issn?: string[]
  host_organization_name?: string
  is_oa?: boolean
  apc_usd?: number
  works_count?: number
  homepage_url?: string
  summary_stats?: { '2yr_mean_citedness'?: number | null; '4yr_mean_citedness'?: number | null }
  topics?: { display_name: string }[]
}

const SOURCE_SELECT =
  'id,display_name,issn_l,issn,host_organization_name,is_oa,apc_usd,works_count,summary_stats,topics,homepage_url'

function toCandidate(s: OpenAlexSource): JournalCandidate {
  return {
    id: `openalex:${s.id}`,
    title: s.display_name,
    issn: s.issn_l,
    publisher: s.host_organization_name,
    isOpenAccess: s.is_oa,
    apcUsd: s.apc_usd,
    subjects: (s.topics ?? []).slice(0, 8).map((t) => t.display_name),
    worksCount: s.works_count,
    citedness: s.summary_stats?.['2yr_mean_citedness'] ?? undefined,
    citedness4: s.summary_stats?.['4yr_mean_citedness'] ?? undefined,
    homepageUrl: s.homepage_url,
    source: 'openalex' as const,
    sourceUrl: s.id
  }
}

/**
 * Candidate discovery in two legs:
 * 1. Where do papers like this one get published — search works, collect the
 *    journals those papers appeared in, then fetch the full source records.
 * 2. Journals whose names match the manuscript keywords (supplementary).
 * Throws only when nothing could be retrieved at all.
 */
export async function searchOpenAlex(title: string, keywords: string[]): Promise<JournalCandidate[]> {
  const query = [title, ...keywords].filter(Boolean).join(' ').slice(0, 300)
  const seen = new Set<string>()
  const out: JournalCandidate[] = []
  let failed = 0

  try {
    const worksUrl = new URL('https://api.openalex.org/works')
    worksUrl.searchParams.set('search', query)
    worksUrl.searchParams.set('per_page', '25')
    worksUrl.searchParams.set('select', 'primary_location')
    const res = await fetch(worksUrl.toString())
    if (!res.ok) throw new Error(`OpenAlex works ${res.status}`)
    const data = await res.json()
    const sourceIds = [...new Set(((data.results ?? []) as { primary_location?: { source?: { id?: string } } }[])
      .map((w) => w?.primary_location?.source?.id)
      .filter((id): id is string => Boolean(id)))]
      .map((id) => id.replace('https://openalex.org/', ''))
      .slice(0, 30)
    if (sourceIds.length > 0) {
      const srcUrl = new URL('https://api.openalex.org/sources')
      srcUrl.searchParams.set('filter', 'ids.openalex:' + sourceIds.join('|'))
      srcUrl.searchParams.set('per_page', String(sourceIds.length))
      srcUrl.searchParams.set('select', SOURCE_SELECT)
      const sres = await fetch(srcUrl.toString())
      if (!sres.ok) throw new Error(`OpenAlex sources ${sres.status}`)
      const sdata = await sres.json()
      for (const s of (sdata.results ?? []) as OpenAlexSource[]) {
        if (seen.has(s.id)) continue
        seen.add(s.id)
        out.push(toCandidate(s))
      }
    }
  } catch {
    failed++
  }

  try {
    const kwQuery = keywords.filter(Boolean).join(' ').slice(0, 160) || title.slice(0, 160)
    const url = new URL('https://api.openalex.org/sources')
    url.searchParams.set('search', kwQuery)
    url.searchParams.set('per_page', '10')
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`OpenAlex ${res.status}`)
    const data = await res.json()
    for (const s of (data.results ?? []) as OpenAlexSource[]) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      out.push(toCandidate(s))
    }
  } catch {
    failed++
  }

  if (out.length === 0 && failed > 0) throw new Error('OpenAlex unreachable')
  return out
}
