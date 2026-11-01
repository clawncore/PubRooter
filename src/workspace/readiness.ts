import type { AttachedDoc, ExtractedContent, ReadinessAudit, ReadinessCheck, ReadinessCheck as C } from './types'
import { READINESS_ENGINE_VERSION } from './types'
import type { JournalCandidate } from '../types'
import { getJournalRequirements, requiredSupportingDocs } from './submissions'

function check(id: string, label: string, status: C['status'], explanation: string, extra?: Partial<C>): ReadinessCheck {
  return { id, label, status, explanation, ...extra }
}

const UNKNOWN_JOURNAL_NOTE =
  'Journal-specific author instructions are not available from open metadata sources, so this item is Unknown. Verify on the journal site.'

/** Readiness audit. Reads the extracted manuscript AND the documents attached in the
 * journal portal (uploads and "Mark ready" declarations), so statement and figure
 * checks reflect what the author has actually prepared. Journal-side unknowns stay Unknown. */
export function runReadiness(
  edited: ExtractedContent,
  journal: JournalCandidate,
  auditId: string,
  attachedDocs: AttachedDoc[] = [],
  hasStoredFile = false
): ReadinessAudit {
  const checks: ReadinessCheck[] = []
  const src = journal.homepageUrl
  const abstractWords = edited.abstract.split(/\s+/).filter(Boolean).length
  const hasDoc = (docId: string) => attachedDocs.some((d) => d.docId === docId)
  const docNote = (docId: string) => {
    const d = attachedDocs.find((x) => x.docId === docId)
    if (!d) return ''
    return d.source === 'stored' ? ' Marked ready in the journal portal.' : ` Attached in the journal portal (${d.name}).`
  }

  checks.push(
    edited.title.trim().length > 0
      ? check('title', 'Title present', 'pass', 'A title was extracted and confirmed.', { evidence: edited.title.slice(0, 160) })
      : check('title', 'Title present', 'attention', 'No title found. Add the manuscript title before submission.')
  )

  if (abstractWords === 0) {
    checks.push(check('abstract', 'Abstract present', 'attention', 'No abstract detected. Required by nearly all journals.'))
  } else if (abstractWords < 50) {
    checks.push(check('abstract', 'Abstract length', 'attention', `Abstract is only ${abstractWords} words. Most journals expect 150–300 words. Verify the journal limit.`, { sourceUrl: src }))
  } else if (abstractWords > 350) {
    checks.push(check('abstract', 'Abstract length', 'attention', `Abstract is ${abstractWords} words. Some journals cap at 250–300. Verify the journal limit.`, { sourceUrl: src }))
  } else {
    checks.push(check('abstract', 'Abstract length', 'pass', `Abstract is ${abstractWords} words, within the common 150–350 range. Confirm the exact limit.`, { sourceUrl: src }))
  }

  checks.push(
    edited.keywords.length >= 3
      ? check('keywords', 'Keywords provided', 'pass', `${edited.keywords.length} keywords detected.`, { evidence: edited.keywords.slice(0, 8).join(', ') })
      : edited.keywords.length > 0
        ? check('keywords', 'Keywords provided', 'attention', `Only ${edited.keywords.length} keyword(s) found. Most journals ask for 4–8.`)
        : check('keywords', 'Keywords provided', 'attention', 'No keywords detected. Add a keyword list in the manuscript metadata.')
  )

  const hasIntro = edited.sections.some((s) => s.includes('introduction'))
  const hasMethods = edited.sections.some((s) => s.includes('method'))
  const hasResults = edited.sections.some((s) => s.includes('result') || s.includes('finding'))
  const hasConclusion = edited.sections.some((s) => s.includes('conclusion') || s.includes('discussion'))

  checks.push(
    hasIntro && hasConclusion
      ? check('structure', 'Required manuscript sections', 'pass', 'Introduction and conclusion/discussion sections detected.')
      : check('structure', 'Required manuscript sections', 'attention', 'Not all standard sections (introduction, methods, results, conclusion) were detected. Review structure against the journal guide.', { sourceUrl: src })
  )

  checks.push(
    hasMethods
      ? check('methods', 'Methods section', 'pass', 'A methods section appears present.')
      : check('methods', 'Methods section', 'unknown', 'No methods section detected. May be labelled differently or missing.')
  )

  checks.push(
    edited.referenceCount > 0
      ? check('references', 'Reference list', 'pass', `Approximately ${edited.referenceCount} references detected. Verify the journal's citation style.`, { sourceUrl: src })
      : check('references', 'Reference list', 'unknown', 'Reference list could not be counted from the extracted text.')
  )

  const lower = (edited.objectives + ' ' + edited.methods + ' ' + edited.abstract).toLowerCase()
  checks.push(
    /\b(funding|grant|financed by|supported by)\b/.test(lower)
      ? check('funding', 'Funding statement', 'pass', 'Funding language found in the manuscript.')
      : hasDoc('funding_statement')
      ? check('funding', 'Funding statement', 'pass', `Funding statement prepared.${docNote('funding_statement')}`)
      : check('funding', 'Funding statement', 'attention', 'No funding statement detected or attached. Most journals require one (including "no funding received"). Upload or mark it ready in the journal portal.', { sourceUrl: src })
  )

  checks.push(
    /\b(conflict of interest|competing interest|disclosure)\b/.test(lower)
      ? check('coi', 'Conflict-of-interest declaration', 'pass', 'COI/competing-interest language found.')
      : hasDoc('coi_statement')
      ? check('coi', 'Conflict-of-interest declaration', 'pass', `COI declaration prepared.${docNote('coi_statement')}`)
      : check('coi', 'Conflict-of-interest declaration', 'attention', 'No conflict-of-interest declaration detected or attached. Upload or mark it ready in the journal portal.', { sourceUrl: src })
  )

  checks.push(
    /\b(ethics (approval|committee)|irb|institutional review|consent)\b/.test(lower)
      ? check('ethics', 'Ethics / consent statement', 'pass', 'Ethics or consent language found.')
      : hasDoc('ethics_statement')
      ? check('ethics', 'Ethics / consent statement', 'pass', `Ethics statement prepared.${docNote('ethics_statement')}`)
      : /\b(patients?|participants?|human subjects?|animal models?|surveys?)\b/.test(lower)
        ? check('ethics', 'Ethics / consent statement', 'warning', 'Human/animal subject language detected without an ethics statement. Many journals require approval details. Upload or mark it ready in the journal portal.', { sourceUrl: src })
        : check('ethics', 'Ethics / consent statement', 'unknown', 'No ethics-related language detected; may not apply to this study type.')
  )

  checks.push(
    /\b(data availability|data will be shared|data are available|dataset available)\b/.test(lower)
      ? check('data', 'Data availability statement', 'pass', 'Data availability language found.')
      : hasDoc('data_availability')
      ? check('data', 'Data availability statement', 'pass', `Data availability statement prepared.${docNote('data_availability')}`)
      : check('data', 'Data availability statement', 'attention', 'No data availability statement detected or attached. Upload or mark it ready in the journal portal.', { sourceUrl: src })
  )

  // Resolve journal-specific requirements where they can be verified
  const reqs = getJournalRequirements(journal)

  checks.push(
    check('wordcount', 'Main-text word limit',
      reqs.wordLimitMainText
        ? edited.wordCount > reqs.wordLimitMainText
          ? 'attention'
          : 'pass'
        : 'unknown',
      reqs.wordLimitMainText
        ? `Manuscript is ${edited.wordCount.toLocaleString()} words. Journal limit: ${reqs.wordLimitMainText.toLocaleString()} words.` +
          (edited.wordCount > reqs.wordLimitMainText ? ' Exceeds the limit. Trim or verify with the journal.' : ' Within the limit.')
        : `${edited.wordCount.toLocaleString()} words extracted. ${UNKNOWN_JOURNAL_NOTE}`,
      { sourceUrl: reqs.sourceUrl, evidence: reqs.source }
    )
  )

  checks.push(
    hasDoc('figures_supplementary')
      ? check('figures', 'Figure and table requirements', 'pass',
          `Figure/supplementary files attached in the journal portal.${docNote('figures_supplementary')}` +
          (reqs.acceptsSeparateImageFiles || reqs.acceptsSeparateTableFiles
            ? ` Journal ${reqs.acceptsSeparateImageFiles ? 'accepts' : 'does not accept'} separate image files, ${reqs.acceptsSeparateTableFiles ? 'accepts' : 'does not accept'} separate table files.`
            : ''),
          { sourceUrl: reqs.sourceUrl, evidence: reqs.source })
      : check('figures', 'Figure and table requirements',
          reqs.acceptsSeparateImageFiles || reqs.acceptsSeparateTableFiles ? 'attention' : 'unknown',
          reqs.source === 'known'
            ? `Journal${reqs.acceptsSeparateImageFiles ? ' accepts' : ' does not accept'} separate image files,${reqs.acceptsSeparateTableFiles ? ' accepts' : ' does not accept'} separate table files. Attach figures in the journal portal, or review extraction against these rules.`
            : UNKNOWN_JOURNAL_NOTE,
          { sourceUrl: reqs.sourceUrl, evidence: reqs.source })
  )

  // Submission documents: required docs from the journal portal, linked to this audit.
  const requiredDocs = requiredSupportingDocs(reqs)
  const docStates = requiredDocs.map((d) => ({ ...d, present: hasDoc(d.id) }))
  const presentCount = docStates.filter((d) => d.present).length
  const missingLabels = docStates.filter((d) => !d.present).map((d) => d.label)
  const totalWithManuscript = requiredDocs.length + 1
  const presentWithManuscript = presentCount + (hasStoredFile || hasDoc('manuscript') ? 1 : 0)
  checks.push(
    check('documents', 'Submission documents',
      missingLabels.length === 0 ? 'pass' : 'attention',
      missingLabels.length === 0
        ? `All ${totalWithManuscript} required documents are ready (${presentWithManuscript} of ${totalWithManuscript} counted, including the manuscript).`
        : `${presentWithManuscript} of ${totalWithManuscript} required documents ready. Still needed: ${missingLabels.join(', ')}. Upload or mark them ready in the journal portal.`,
      { sourceUrl: reqs.sourceUrl, evidence: reqs.source })
  )

  const refStyleKnown =
    reqs.referenceStyle && !reqs.referenceStyle.startsWith('Verify')
  checks.push(
    check('refstyle', 'Reference style',
      refStyleKnown ? 'attention' : 'unknown',
      refStyleKnown
        ? `Required style: ${reqs.referenceStyle}. Verify references are formatted accordingly.`
        : UNKNOWN_JOURNAL_NOTE,
      { sourceUrl: reqs.sourceUrl, evidence: reqs.source }
    )
  )

  checks.push(
    check('files', 'File-format requirements',
      reqs.source === 'known' && (reqs.figureFormat.length > 0 || reqs.tableFormat.length > 0) ? 'attention' : 'unknown',
      reqs.source === 'known'
        ? `Accepted formats. Figures: ${reqs.figureFormat.join(', ') || 'verify'}; tables: ${reqs.tableFormat.join(', ') || 'verify'}; supplementary: ${reqs.supplementaryFormat.join(', ') || 'verify'}.`
        : UNKNOWN_JOURNAL_NOTE,
      { sourceUrl: reqs.sourceUrl, evidence: reqs.source }
    )
  )
  checks.push(
    check('apc', 'Publication charges', journal.apcUsd != null ? 'attention' : 'unknown',
      journal.apcUsd != null
        ? `Open metadata lists an APC near US$${journal.apcUsd.toLocaleString()}. Confirm current fees and any institutional agreement on the journal site.`
        : UNKNOWN_JOURNAL_NOTE,
      { sourceUrl: src })
  )
  checks.push(
    check('article-type', 'Article type compatibility', 'unknown',
      edited.articleType ? `Your article type: ${edited.articleType}. ${UNKNOWN_JOURNAL_NOTE}` : UNKNOWN_JOURNAL_NOTE,
      { sourceUrl: src })
  )

  return {
    id: auditId,
    journalId: journal.id,
    journalTitle: journal.title,
    runAt: new Date().toISOString(),
    engineVersion: READINESS_ENGINE_VERSION,
    checks
  }
}

export function auditSummary(audit: ReadinessAudit): Record<C['status'], number> {
  const counts: Record<C['status'], number> = { pass: 0, attention: 0, warning: 0, 'not-checked': 0, unknown: 0 }
  for (const c of audit.checks) counts[c.status] += 1
  return counts
}
