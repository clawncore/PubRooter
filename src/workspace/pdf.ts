import type { ExtractedContent } from './types'
import { emptyExtracted } from './types'

const MAX_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 25)
export const MAX_UPLOAD_BYTES = MAX_MB * 1024 * 1024

export interface PdfValidation {
  ok: boolean
  error?: string
}

export function validatePdfFile(file: { name: string; size: number; type: string; slice?: (start: number, end: number) => Blob }): PdfValidation {
  if (file.size === 0) return { ok: false, error: 'The selected file is empty.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `File is larger than the ${MAX_MB} MB limit.` }
  }
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.pdf')) return { ok: false, error: 'Only PDF files are accepted.' }
  return { ok: true }
}

/** PDF spec allows junk before the header; %PDF- must appear within the first 1024 bytes. */
export async function validatePdfMagic(file: Blob): Promise<PdfValidation> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const marker = new TextEncoder().encode('%PDF-')
  outer: for (let i = 0; i <= head.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (head[i + j] !== marker[j]) continue outer
    }
    return { ok: true }
  }
  return { ok: false, error: 'This file does not contain a valid PDF header. It may be renamed or corrupted.' }
}

const SECTION_HEADINGS = [
  'abstract',
  'keywords',
  'key words',
  'introduction',
  'background',
  'methods',
  'methodology',
  'materials and methods',
  'results',
  'findings',
  'discussion',
  'conclusion',
  'conclusions',
  'references',
  'acknowledgments',
  'acknowledgements',
  'funding',
  'data availability',
  'conflict of interest',
  'declarations'
]

/** Pure derivation of manuscript metadata from extracted PDF text. Testable without pdf.js. */
export function deriveMetadata(fullText: string, pageCount: number): ExtractedContent {
  const out = emptyExtracted()
  out.pageCount = pageCount
  const text = fullText.replace(/\r/g, '')
  const lines = text.split('\n').map((l) => l.trim())
  const nonEmpty = lines.filter(Boolean)
  out.wordCount = text.split(/\s+/).filter(Boolean).length

  if (text.replace(/\s/g, '').length < 150) {
    out.extractionWarnings.push(
      'Very little extractable text was found. This PDF may be scanned or image-based — provide a text-based PDF or enter details manually.'
    )
    return out
  }

  const titleCandidate = nonEmpty.find((l) => l.length > 8 && l.length < 300 && !/^\d+$/.test(l))
  out.title = titleCandidate ?? ''

  const absMatch = text.match(/\babstract\b[:\s]*([\s\S]{80,2500}?)(?=\n\s*(?:keywords?|key\s*words?|1\.?\s*introduction|introduction|background|methods?|article)\b)/i)
  if (absMatch) out.abstract = absMatch[1]!.replace(/\s+/g, ' ').trim()
  else {
    const generic = text.match(/(?:^|\n)([^\n]{200,}\n[^\n]{200,}[^\n]{200,})/)
    if (generic) {
      out.abstract = generic[1]!.replace(/\s+/g, ' ').trim()
      out.extractionWarnings.push('Abstract section not clearly labelled — review the extracted text carefully.')
    }
  }

  const kwMatch = text.match(/\b(?:keywords?|key\s*words?)\s*[:;]\s*([^\n]{5,400})/i)
  if (kwMatch) {
    out.keywords = kwMatch[1]!
      .split(/[,;•|]/)
      .map((k) => k.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((k) => k.length > 1 && k.length < 80)
      .slice(0, 12)
  }

  const seen = new Set<string>()
  out.sections = nonEmpty
    .filter((l) => l.length < 60)
    .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, '').replace(/[.:]+$/, '').trim().toLowerCase())
    .filter((l) => SECTION_HEADINGS.includes(l))
    .filter((l) => {
      const k = l.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

  const objMatch = text.match(/\b(?:objective|aim|purpose|goal)s?\b[:\s]*([^\n.]{20,400})/i)
  if (objMatch) out.objectives = objMatch[1]!.trim()

  const methMatch = text.match(/\b(?:methods?|methodology|materials\s+and\s+methods|experimental\s+design)\b[:\s]*([^\n]{20,800})/i)
  if (methMatch) out.methods = methMatch[1]!.trim()

  const refSection = text.match(/\b(?:references|bibliography|works cited)\b([\s\S]{80,})/i)
  if (refSection) {
    const refLines = refSection[1]!.split('\n').filter((l) => /^\s*(\[?\d{1,3}[\].]| [A-Z][a-z]+ [A-Z])/.test(l))
    out.referenceCount = Math.min(refLines.length, 200)
  }

  const DISCIPLINES: [RegExp, string][] = [
    [/\b(medicin|clinical|patient|randomized|trial|oncolog|cardio)/i, 'Medicine'],
    [/\b(biolog|cell|molecular|genom|protein|organism)/i, 'Life sciences'],
    [/\b(chemis|molecule|synthesis|catalys|spectr)/i, 'Chemistry'],
    [/\b(physics|quantum|particle|thermodynam|relativit)/i, 'Physics'],
    [/\b(machine learning|neural|algorithm|software|comput|artificial intelligence|dataset)/i, 'Computer science'],
    [/\b(engineer|circuit|robot|material|manufactur)/i, 'Engineering'],
    [/\b(economic|market|financ|monetary)/i, 'Economics'],
    [/\b(psycholog|behavio|cognitive|survey|participant)/i, 'Psychology'],
    [/\b(education|student|curriculum|teaching|learning outcome)/i, 'Education'],
    [/\b(environ|climate|ecosystem|biodiversity|sustainab)/i, 'Environmental science']
  ]
  for (const [re, label] of DISCIPLINES) {
    if (re.test(text)) {
      out.field = label
      break
    }
  }

  if (out.sections.length === 0) {
    out.extractionWarnings.push('Could not identify standard manuscript sections — verify structure manually.')
  }
  if (!out.abstract) {
    out.extractionWarnings.push('No abstract detected — paste it in the review step before analysis.')
  }

  const capWords = (out.abstract + ' ' + out.title).match(/\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,}){1,2}\b/g) ?? []
  const counts = new Map<string, number>()
  for (const w of capWords) counts.set(w, (counts.get(w) ?? 0) + 1)
  out.entities = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w)

  return out
}

export async function extractFromPdf(file: File): Promise<ExtractedContent> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const parts: string[] = []
  const maxPages = Math.min(doc.numPages, 40)
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let pageText = ''
    for (const item of content.items) {
      if ('str' in item) {
        pageText += item.str
        if ('hasEOL' in item && item.hasEOL) pageText += '\n'
        else pageText += ' '
      }
    }
    parts.push(pageText)
  }
  const fullText = parts.join('\n')
  const result = deriveMetadata(fullText, doc.numPages)
  result.extractionWarnings.push('Extracted fields are machine-derived — review and correct before analysis.')
  return result
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
