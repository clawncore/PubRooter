import type { AttachedDoc, ManuscriptProject, PackageCheck, PackageCheckStatus } from './types'
import type { JournalRequirements } from './submissions'
import { countWords, extractPdfText } from './pdf'

export interface PackageCheckInput {
  project: ManuscriptProject
  requirements: JournalRequirements | null
  docs: AttachedDoc[]
  extras: AttachedDoc[]
  getFile: (key: string) => Promise<File | null | undefined>
  docKey: (docId: string) => string
}

function ext(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : ''
}

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g

/**
 * Final prepare-time validation: every attached document against this
 * journal's hard requirements (format, size, word limits, declarations,
 * double-blind heuristic, figure/table counts). Advisory only: failures are
 * surfaced prominently but never silently block the export.
 */
export async function runPackageChecks(input: PackageCheckInput): Promise<PackageCheck[]> {
  const { project, requirements, docs, extras, getFile, docKey } = input
  const checks: PackageCheck[] = []
  const push = (id: string, label: string, status: PackageCheckStatus, detail: string) => {
    checks.push({ id, label, status, detail })
  }
  const reqDoc = (docId: string) => docs.find((d) => d.docId === docId)

  // ---- Manuscript file ----
  const msUpload = reqDoc('manuscript')
  const msFile = msUpload
    ? await getFile(docKey('manuscript'))
    : project.hasStoredFile
      ? await getFile(project.id)
      : null
  const msName = msUpload?.name || (project.hasStoredFile ? project.fileName || 'manuscript.pdf' : '')
  const msSize = msUpload?.size ?? msFile?.size ?? 0

  if (!msFile) {
    push('manuscript-present', 'Manuscript file', 'fail', 'No manuscript file stored. Upload it in Required Documents.')
  } else {
    push('manuscript-present', 'Manuscript file', 'pass', msUpload ? `Attached: ${msName}` : `Stored: ${msName}`)

    const accepted = (requirements?.manuscriptFormat ?? ['DOC', 'DOCX', 'PDF']).map((a) => a.toUpperCase())
    const e = ext(msName || msFile.name || '')
    if (e && accepted.includes(e)) {
      push('manuscript-format', 'Manuscript format', 'pass', `${e} is accepted (${accepted.join(', ')})`)
    } else if (e) {
      push('manuscript-format', 'Manuscript format', 'fail', `${e} is not in the accepted list (${accepted.join(', ')})`)
    } else {
      push('manuscript-format', 'Manuscript format', 'unknown', `Could not determine the file type. Accepted: ${accepted.join(', ')}`)
    }

    const maxMb = requirements?.maxFileSizeMb
    if (maxMb) {
      const mb = msSize / (1024 * 1024)
      if (msSize > maxMb * 1024 * 1024) {
        push('manuscript-size', 'Manuscript file size', 'fail', `${mb.toFixed(1)} MB exceeds the ${maxMb} MB limit`)
      } else {
        push('manuscript-size', 'Manuscript file size', 'pass', `${mb.toFixed(1)} MB within the ${maxMb} MB limit`)
      }
    }
  }

  // ---- Word limits (from analysis counts, no re-extraction needed) ----
  const abstract = (project.edited?.abstract || '').trim()
  const abstractWords = abstract ? countWords(abstract) : 0
  if (requirements?.wordLimitAbstract) {
    const limit = requirements.wordLimitAbstract
    if (abstractWords > 0) {
      push(
        'abstract-words',
        'Abstract word limit',
        abstractWords <= limit ? 'pass' : 'fail',
        abstractWords <= limit
          ? `${abstractWords} words, within the ${limit}-word limit`
          : `${abstractWords} words, over the ${limit}-word limit`
      )
    } else {
      push('abstract-words', 'Abstract word limit', 'unknown', `Limit is ${limit} words. No abstract text available to count.`)
    }
  }
  if (requirements?.wordLimitMainText) {
    const limit = requirements.wordLimitMainText
    const counted = project.edited?.wordCount ?? 0
    if (counted > 0) {
      const status: PackageCheckStatus =
        counted <= limit ? 'pass' : counted <= Math.ceil(limit * 1.2) ? 'warn' : 'fail'
      const suffix =
        counted > limit
          ? ' (analysis count includes abstract and references, so the main text may still fit)'
          : ''
      push(
        'main-words',
        'Main text word limit',
        status,
        `${counted.toLocaleString()} words counted at analysis vs ${limit.toLocaleString()} limit${suffix}`
      )
    } else {
      push('main-words', 'Main text word limit', 'unknown', `Limit is ${limit.toLocaleString()} words. Run analysis to count words.`)
    }
  }

  // ---- Required supporting documents ----
  if (requirements) {
    const requiredDocs: Array<[string, string, boolean]> = [
      ['cover_letter', 'Cover letter', requirements.requiresCoverLetter],
      ['title_page', 'Title page', requirements.requiresTitlePage],
      ['structured_abstract', 'Structured abstract', requirements.requiresStructuredAbstract],
      ['data_availability', 'Data availability statement', requirements.requiresDataAvailability],
      ['ethics_statement', 'Ethics statement', requirements.requiresEthicsStatement],
      ['coi_statement', 'Conflict of interest statement', requirements.requiresConflictOfInterest],
      ['funding_statement', 'Funding statement', requirements.requiresFunding],
      ['orcid', 'ORCID IDs', requirements.requiresORCID]
    ]
    for (const [id, label, required] of requiredDocs) {
      if (!required) continue
      const doc = reqDoc(id)
      if (!doc) {
        push(`${id}-present`, label, 'fail', 'Required by this journal but not attached or marked ready.')
      } else if (doc.source === 'stored') {
        push(`${id}-present`, label, 'pass', 'Marked ready (declared, no file needed)')
      } else {
        const e = ext(doc.name)
        if (id !== 'orcid' && e && !['DOC', 'DOCX', 'PDF'].includes(e)) {
          push(`${id}-present`, label, 'warn', `${doc.name} attached, but ${e} is outside the usual DOC/DOCX/PDF set. Verify on the journal site.`)
        } else {
          push(`${id}-present`, label, 'pass', `Attached: ${doc.name}`)
        }
      }
    }
  }

  // ---- Double-blind heuristic scan of the opening pages ----
  if (requirements?.requiresDoubleBlind && msFile && (msFile.type === 'application/pdf' || /\.pdf$/i.test(msFile.name || ''))) {
    try {
      const head = (await extractPdfText(msFile, 2)).slice(0, 4000)
      const emails = head.match(EMAIL_RE) || []
      if (emails.length > 0) {
        push(
          'double-blind',
          'Double-blind scan',
          'warn',
          `Found ${emails.length} email address${emails.length === 1 ? '' : 'es'} in the opening pages. This journal requires double-blind review.`
        )
      } else {
        push('double-blind', 'Double-blind scan', 'pass', 'No email addresses detected in the opening pages (heuristic).')
      }
    } catch {
      push('double-blind', 'Double-blind scan', 'unknown', 'Could not read the manuscript text for the blind scan.')
    }
  }

  // ---- Extracted figures / tables vs journal caps ----
  const figCount = extras.filter((f) => (f.type || '').startsWith('image/')).length
  const tableCount = extras.filter((f) => f.type === 'text/csv').length
  if (requirements?.acceptsSeparateImageFiles) {
    const maxF = requirements.maxFigures
    if (maxF && figCount > maxF) {
      push('figures-count', 'Figure count', 'fail', `${figCount} extracted figures exceeds the ${maxF}-figure limit.`)
    } else if (figCount === 0) {
      push('figures-count', 'Figures', 'warn', 'No embedded images could be extracted from the manuscript PDF. Upload figure files manually if needed.')
    } else {
      push('figures-count', 'Figures', 'pass', `${figCount} figure${figCount === 1 ? '' : 's'} extracted${maxF ? ` (limit ${maxF})` : ''}.`)
    }
  }
  if (requirements?.acceptsSeparateTableFiles) {
    const maxT = requirements.maxTables
    if (maxT && tableCount > maxT) {
      push('tables-count', 'Table count', 'fail', `${tableCount} extracted tables exceeds the ${maxT}-table limit.`)
    } else if (tableCount > 0) {
      push('tables-count', 'Tables', 'pass', `${tableCount} table${tableCount === 1 ? '' : 's'} extracted${maxT ? ` (limit ${maxT})` : ''}.`)
    }
  }

  return checks
}
