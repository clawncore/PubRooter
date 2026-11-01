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
      'Very little extractable text was found. This PDF may be scanned or image-based. Provide a text-based PDF or enter details manually.'
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
      out.extractionWarnings.push('Abstract section not clearly labelled. Review the extracted text carefully.')
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
    out.extractionWarnings.push('Could not identify standard manuscript sections. Verify structure manually.')
  }
  if (!out.abstract) {
    out.extractionWarnings.push('No abstract detected. Paste it in the review step before analysis.')
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
  result.extractionWarnings.push('Extracted fields are machine-derived. Review and correct before analysis.')
  return result
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export interface ExtractedFigure {
  name: string
  blob: Blob
}

export interface ExtractedTable {
  name: string
  csv: string
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href
  return pdfjs
}

/** Pull embedded raster images out of the manuscript PDF as standalone PNGs. */
export async function extractFiguresFromPdf(file: File): Promise<ExtractedFigure[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const figures: ExtractedFigure[] = []
  const seen = new Set<string>()
  const maxPages = Math.min(doc.numPages, 40)
  for (let i = 1; i <= maxPages && figures.length < 20; i++) {
    const page = await doc.getPage(i)
    let opList: Awaited<ReturnType<Awaited<ReturnType<typeof doc.getPage>>['getOperatorList']>>
    try {
      opList = await page.getOperatorList()
    } catch {
      continue
    }
    for (let j = 0; j < opList.fnArray.length; j++) {
      const op = opList.fnArray[j]
      const isImage = op === pdfjs.OPS.paintImageXObject || op === pdfjs.OPS.paintInlineImageXObject
      if (!isImage) continue
      try {
        const args = opList.argsArray[j] as unknown[]
        const img =
          op === pdfjs.OPS.paintImageXObject
            ? (page.objs.get(args[0] as string) as { width?: number; height?: number; data?: Uint8ClampedArray } | undefined)
            : (args[0] as { width?: number; height?: number; data?: Uint8ClampedArray } | undefined)
        if (!img || !img.width || !img.height || !img.data) continue
        if (img.width < 80 || img.height < 80) continue
        const sig = `${img.width}x${img.height}x${img.data.length}`
        if (seen.has(sig)) continue
        seen.add(sig)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (!blob) continue
        figures.push({ name: `figure-${figures.length + 1}.png`, blob })
      } catch {
        /* skip unpaintable image objects */
      }
    }
  }
  return figures
}

/** Heuristic tabular-text extraction: runs of wide rows become CSV tables. */
export async function extractTablesFromPdf(file: File): Promise<ExtractedTable[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const tables: ExtractedTable[] = []
  const maxPages = Math.min(doc.numPages, 40)

  type Cell = { x: number; y: number; w: number; str: string }

  function cellsOf(line: Cell[]): string[] {
    const sorted = [...line].sort((a, b) => a.x - b.x)
    if (sorted.length === 0) return []
    const cells: string[] = []
    let current = sorted[0].str
    let prevEnd = sorted[0].x + sorted[0].w
    for (let k = 1; k < sorted.length; k++) {
      const it = sorted[k]
      if (it.x - prevEnd > 8) {
        cells.push(current.trim())
        current = it.str
      } else {
        current += ' ' + it.str
      }
      prevEnd = it.x + it.w
    }
    if (current.trim()) cells.push(current.trim())
    return cells
  }

  function pushTable(run: string[][]) {
    const cols = Math.max(...run.map((c) => c.length))
    const csv = run
      .map((c) =>
        Array.from({ length: cols }, (_, n) => `"${(c[n] ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n')
    tables.push({ name: `table-${tables.length + 1}.csv`, csv })
  }

  for (let i = 1; i <= maxPages && tables.length < 10; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items: Cell[] = []
    for (const raw of content.items) {
      if (!('str' in raw) || typeof raw.str !== 'string') continue
      const str = raw.str.trim()
      if (!str) continue
      const tx = raw.transform
      items.push({ x: tx[4], y: tx[5], w: (raw as { width?: number }).width ?? 0, str })
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x)
    const lines: Cell[][] = []
    for (const it of items) {
      const last = lines[lines.length - 1]
      if (last && Math.abs(last[0].y - it.y) < 3) last.push(it)
      else lines.push([it])
    }
    let run: string[][] | null = null
    for (const line of lines) {
      const cells = cellsOf(line)
      if (cells.length >= 3) {
        if (!run) run = []
        run.push(cells)
      } else {
        if (run && run.length >= 2) pushTable(run)
        run = null
      }
    }
    if (run && run.length >= 2) pushTable(run)
  }
  return tables
}


export async function extractFromDocx(file: File): Promise<ExtractedContent> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value || ''
  const words = text.split(/\s+/).filter(Boolean)
  const pageCount = Math.max(1, Math.ceil(words.length / 500))
  return deriveMetadata(text, pageCount)
}

/** Full extracted text of a PDF (capped) for word counting and blind scans. */
export async function extractPdfText(file: File, maxPages = 40): Promise<string> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const parts: string[] = []
  const n = Math.min(doc.numPages, maxPages)
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    for (const raw of content.items) {
      if ('str' in raw && typeof raw.str === 'string') parts.push(raw.str)
    }
    parts.push('\n')
  }
  return parts.join(' ')
}

/** Raw text of a DOCX for word counting and blind scans. */
export async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return result.value || ''
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
