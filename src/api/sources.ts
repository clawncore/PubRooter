export interface SourceRow {
  id: string
  title: string
  publisher?: string
  issn?: string
  type?: string
  isOpenAccess: boolean
  worksCount: number
  citedness?: number
  homepageUrl?: string
  hostOrg?: string
}

export interface SourceQuery {
  field: 'title' | 'publisher' | 'issn' | 'subject'
  value: string
  openAccessOnly: boolean
  minWorks: number
}

interface OpenAlexSource {
  id: string
  display_name: string
  publisher_name?: string
  host_organization_name?: string
  issn_l?: string
  type?: string
  is_oa?: boolean
  works_count?: number
  summary_stats?: { '2yr_mean_citedness'?: number | null }
  homepage_url?: string
  topics?: { display_name: string; field?: { display_name?: string } }[]
}

export async function searchSources(q: SourceQuery, page = 1): Promise<{ rows: SourceRow[]; total: number }> {
  const url = new URL('https://api.openalex.org/sources')
  const filters: string[] = []
  const value = q.value.trim()

  if (value) {
    if (q.field === 'issn') {
      const raw = value.trim()
      const dashed = raw.includes('-') ? raw : raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
      filters.push(`issn:${dashed}`)
    }
    else if (q.field === 'publisher') filters.push(`display_name.search:${value}`)
    else if (q.field === 'subject') filters.push(`default.search:${value}`)
    else url.searchParams.set('search', value)
  }
  if (q.openAccessOnly) filters.push('is_oa:true')
  if (q.minWorks > 0) filters.push(`works_count:>=${q.minWorks}`)
  filters.push('type:journal')

  url.searchParams.set('filter', filters.join(','))
  url.searchParams.set('per_page', '25')
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort', 'works_count:desc')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`OpenAlex sources ${res.status}`)
  const data = await res.json()

  const rows: SourceRow[] = (data.results as OpenAlexSource[]).map((s) => ({
    id: s.id,
    title: s.display_name,
    publisher: s.publisher_name ?? s.host_organization_name,
    issn: s.issn_l,
    type: s.type,
    isOpenAccess: !!s.is_oa,
    worksCount: s.works_count ?? 0,
    citedness: s.summary_stats?.['2yr_mean_citedness'] ?? undefined,
    homepageUrl:
      s.homepage_url && /^https?:\/\//i.test(s.homepage_url) && !/openalex\.org/i.test(s.homepage_url)
        ? s.homepage_url
        : undefined,
    hostOrg: s.host_organization_name
  }))

  return { rows, total: data.meta?.count ?? rows.length }
}
