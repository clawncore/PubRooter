import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchOpenAlex } from '../src/api/openalex'
import { searchCrossref } from '../src/api/crossref'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchOpenAlex', () => {
  it('discovers journals from similar works, bulk-fetches their entities, and dedupes the name-search leg', async () => {
    const worksCall = jsonResponse({
      results: [
        { primary_location: { source: { id: 'https://openalex.org/S1' } } },
        { primary_location: { source: { id: 'https://openalex.org/S2' } } },
        { primary_location: null }
      ]
    })
    const bulkCall = jsonResponse({
      results: [
        { id: 'https://openalex.org/S1', display_name: 'Eye Journal', topics: [{ display_name: 'Ophthalmology' }], issn_l: '0000-0001', is_oa: false, apc_usd: 2000, works_count: 100 },
        { id: 'https://openalex.org/S2', display_name: 'Screening Weekly', topics: [], host_organization_name: 'ACME Press' }
      ]
    })
    const nameCall = jsonResponse({
      results: [
        { id: 'https://openalex.org/S2', display_name: 'Screening Weekly' },
        { id: 'https://openalex.org/S9', display_name: 'Journal of Keyword Match', topics: [], is_oa: true }
      ]
    })
    const fetchMock = vi.fn().mockResolvedValueOnce(worksCall).mockResolvedValueOnce(bulkCall).mockResolvedValueOnce(nameCall)
    vi.stubGlobal('fetch', fetchMock)

    const res = await searchOpenAlex('A title', ['keyword one', 'keyword two'])

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.openalex.org/works')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('search=')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('ids.openalex%3AS1%7CS2')
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('api.openalex.org/sources')

    expect(res.map((c) => c.title)).toEqual(['Eye Journal', 'Screening Weekly', 'Journal of Keyword Match'])
    const eye = res[0]!
    expect(eye.issn).toBe('0000-0001')
    expect(eye.apcUsd).toBe(2000)
    expect(eye.subjects).toEqual(['Ophthalmology'])
    expect(eye.source).toBe('openalex')
    expect(res.filter((c) => c.title === 'Screening Weekly')).toHaveLength(1)
  })

  it('returns an empty list when both legs succeed but find nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))
    await expect(searchOpenAlex('Nothing', ['nothing'])).resolves.toEqual([])
  })

  it('throws only when a leg fails and no results were found', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(searchOpenAlex('Title', ['kw'])).rejects.toThrow('OpenAlex unreachable')
  })

  it('returns partial results without throwing when one leg fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 'https://openalex.org/S5', display_name: 'Fallback Journal', topics: [] }] }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await searchOpenAlex('Title', ['kw'])
    expect(res).toHaveLength(1)
    expect(res[0]!.title).toBe('Fallback Journal')
  })
})

describe('searchCrossref', () => {
  it('collects container journals with ISSNs and dedupes against the name-search leg', async () => {
    const worksCall = jsonResponse({
      message: {
        items: [
          { 'container-title': ['Acta Ophthalmologica'], ISSN: ['1755-375X'], publisher: 'Wiley', URL: 'https://doi.org/10.1/x', subject: ['Ophthalmology'] },
          { 'container-title': ['Acta Ophthalmologica'], ISSN: ['1755-375X'], publisher: 'Wiley', URL: 'https://doi.org/10.1/y', subject: ['Medicine'] },
          { 'container-title': ['No ISSN Book'], publisher: 'Some Press' },
          { ISSN: ['1234-5678'], publisher: 'No container' }
        ]
      }
    })
    const journalsCall = jsonResponse({
      message: {
        items: [
          { title: 'Acta Ophthalmologica', ISSN: ['1755-375X'], publisher: 'Wiley', URL: 'https://example.org/acta' },
          { title: 'Journal of Keyword Match', ISSN: ['9999-9999'], publisher: 'Elsevier', URL: 'https://example.org/jkm', 'container-title': ['Medicine'] }
        ]
      }
    })
    const fetchMock = vi.fn().mockResolvedValueOnce(worksCall).mockResolvedValueOnce(journalsCall)
    vi.stubGlobal('fetch', fetchMock)

    const res = await searchCrossref('A title', ['keyword'])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.crossref.org/works')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('query.bibliographic=')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('api.crossref.org/journals')

    expect(res.map((c) => c.title)).toEqual(['Acta Ophthalmologica', 'Journal of Keyword Match'])
    expect(res[0]!.issn).toBe('1755-375X')
    expect(res[0]!.source).toBe('crossref')
    expect(res[1]!.subjects).toEqual(['Medicine'])
    expect(res.filter((c) => c.issn === '1755-375X')).toHaveLength(1)
  })

  it('returns an empty list when both legs succeed but find nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: { items: [] } })))
    await expect(searchCrossref('Nothing', ['nothing'])).resolves.toEqual([])
  })

  it('throws only when a leg fails and no results were found', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse({ message: { items: [] } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(searchCrossref('Title', ['kw'])).rejects.toThrow('Crossref unreachable')
  })
})
