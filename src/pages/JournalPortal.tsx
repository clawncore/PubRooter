import { useState, useEffect, type ReactNode } from 'react'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { ManuscriptProject, AttachedDoc, SubmissionPackage } from '../workspace/types'
import type { JournalCandidate } from '../types'
import type { JournalPortal as JournalPortalType, JournalSpecificRequirements } from '../workspace/journal-scraper'
import { journalScraper } from '../workspace/journal-scraper'
import { getJournalRequirements, createDraftAttempt, transitionAttempt, allowedTransitions, SUBMISSION_STATUS_LABEL, type JournalRequirements } from '../workspace/submissions'
import { auditSummary, runReadiness } from '../workspace/readiness'
import { storeFile, deleteFile, getFile } from '../workspace/storage'
import { uid } from '../lib/storage'
import { formatBytes, extractFiguresFromPdf, extractTablesFromPdf } from '../workspace/pdf'
import { runPackageChecks } from '../workspace/package-checks'
import { journalSiteUrl, resolveJournalSite } from '../workspace/journal-url'
import { buildZip, downloadBlob, type ZipEntry } from '../workspace/zip'
import { SHELL_KEY } from './workspace/WorkspaceApp'
import * as mammoth from 'mammoth'
import '../workspace/journal-portal.css'

interface JournalPortalProps {
  project: ManuscriptProject
  selectedJournal: JournalCandidate
  onNavigate: (view: string, draft?: any) => void
}

const PORTAL_SECTIONS = [
  { id: 'documents', label: 'Required Documents' },
  { id: 'guidelines', label: 'Submission Guidelines' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'timeline', label: 'Timeline & Process' },
  { id: 'package', label: 'Submission Package' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'contact', label: 'Contact' }
] as const

// Attached docs + prepared packages persist on the project (local mode).
// Cloud projects have no spare JSON column yet, so keep per-device mirrors.
function loadLocalDocs(projectId: string): AttachedDoc[] {
  try {
    return JSON.parse(localStorage.getItem(`pubrooter.docs.${projectId}`) || '[]')
  } catch {
    return []
  }
}

function saveLocalDocs(projectId: string, list: AttachedDoc[]): void {
  try {
    localStorage.setItem(`pubrooter.docs.${projectId}`, JSON.stringify(list))
  } catch {
    /* storage unavailable. Ignore */
  }
}

function loadLocalPackages(projectId: string): Record<string, SubmissionPackage> {
  try {
    return JSON.parse(localStorage.getItem(`pubrooter.packages.${projectId}`) || '{}')
  } catch {
    return {}
  }
}

function saveLocalPackages(projectId: string, map: Record<string, SubmissionPackage>): void {
  try {
    localStorage.setItem(`pubrooter.packages.${projectId}`, JSON.stringify(map))
  } catch {
    /* storage unavailable. Ignore */
  }
}

// PubMed-style content box: solid blue title bar + bordered body.
function PortalBox({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="pm-box">
      <div className="pm-box-head">
        <h3>{title}</h3>
        {meta ? <span className="pm-box-meta">{meta}</span> : null}
      </div>
      <div className="pm-box-body">{children}</div>
    </section>
  )
}

export function JournalPortal({ project, selectedJournal, onNavigate }: JournalPortalProps) {
  const { update, profile, signOut, mode, data } = useWorkspace()
  // App.tsx mounts the portal from an in-memory snapshot of the project
  // (the navigation draft), so prepare/reroute mutations in the workspace
  // never reach the prop. Attempt and package state must come from the LIVE
  // project in context — otherwise a freshly prepared attempt is invisible
  // here (no status badge, no "Mark as submitted").
  const liveProject = data?.projects.find((p) => p.id === project.id) ?? project
  const [portalData, setPortalData] = useState<JournalPortalType | null>(null)
  const [requirements, setRequirements] = useState<JournalRequirements | null>(null)
  const [portalRequirements, setPortalRequirements] = useState<JournalSpecificRequirements | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('documents')
  const [sideOpen, setSideOpen] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [docNotice, setDocNotice] = useState('')
  const [localDocs, setLocalDocs] = useState<AttachedDoc[]>(() => loadLocalDocs(project.id))
  const [localPackages, setLocalPackages] = useState<Record<string, SubmissionPackage>>(() => loadLocalPackages(project.id))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyExporting, setBusyExporting] = useState(false)
  const [packageNotice, setPackageNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [docPreview, setDocPreview] = useState<{ name: string; url: string; kind: 'loading' | 'pdf' | 'docx' | 'image' | 'other' } | null>(null)

  /** Hand the user back to the workspace Publications view — the last stop of
   *  the upload → readiness → portal workflow, where attempts get tracked. */
  const goToPublications = () => {
    try {
      sessionStorage.setItem(SHELL_KEY, JSON.stringify({ name: 'pipeline' }))
    } catch {
      /* storage unavailable — workspace will restore its last view instead */
    }
    onNavigate('tool')
  }
  const [docPreviewHtml, setDocPreviewHtml] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<{ docId: string; label: string } | null>(null)
  // The journal's own website. Resolved by ISSN when the candidate has no
  // usable homepage, so links never fall through to openalex.org or /undefined.
  const [siteUrl, setSiteUrl] = useState<string | undefined>(() => journalSiteUrl(selectedJournal))

  useEffect(() => {
    let cancelled = false
    const direct = journalSiteUrl(selectedJournal)
    setSiteUrl(direct)
    if (direct) return
    void resolveJournalSite(selectedJournal).then((url) => {
      if (!cancelled) setSiteUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [selectedJournal])

  // Close the profile menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-menu')) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Load portal data and requirements
  useEffect(() => {
    const loadPortalData = async () => {
      try {
        setIsLoading(true)
        // Scrape journal-specific requirements
        const portal = await journalScraper.scrapeJournalRequirements(selectedJournal)
        setPortalData(portal)
        setPortalRequirements(portal.portalData.requirements)

        // Flat, curated requirements the checklist reads from
        setRequirements(getJournalRequirements(selectedJournal))
      } catch (error) {
        console.error('Failed to load portal data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPortalData()
  }, [selectedJournal])

  // Flat attached docs: reusable across journals, keyed `${projectId}--${docId}`.
  const attachedDocs = project.attachedDocs ?? localDocs
  const uploadedFor = (docId: string) => attachedDocs.find((f) => f.docId === docId)
  // The manuscript file is stored under the project id (see ManuscriptDetail), not
  // under the per-doc key. Preview it from there directly.
  const manuscriptStorageKey = project.id
  const docKey = (docId: string) => `${project.id}--${docId}`

  /** Preview lookup order. For the manuscript, prefer the project-level stored
   *  file when no dedicated per-doc upload exists — storage answers the
   *  `${id}--manuscript` probe with a 400 and every cold preview paid for two
   *  round-trips before rendering. Mirrors the ZIP export logic. */
  const previewKeys = (docId: string): string[] =>
    docId === 'manuscript' && !uploadedFor('manuscript')
      ? [manuscriptStorageKey, docKey(docId)]
      : [docKey(docId), ...(docId === 'manuscript' ? [manuscriptStorageKey] : [])]

  /** Decide the renderer from actual bytes, never the file name — cloud
   *  storage historically returned every download named `.pdf`. */
  const detectPreviewKind = async (file: File): Promise<'pdf' | 'docx' | 'image' | 'other'> => {
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
      if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf' // %PDF
      if (head[0] === 0x50 && head[1] === 0x4b) return 'docx' // PK zip container (docx)
    } catch {
      /* fall through to name/type checks */
    }
    if (file.type === 'application/pdf') return 'pdf'
    if (file.type.startsWith('image/')) return 'image'
    const lower = (file.name || '').toLowerCase()
    if (lower.endsWith('.pdf')) return 'pdf'
    if (lower.match(/\.docx?$/)) return 'docx'
    if (lower.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image'
    return 'other'
  }

  /** Load a stored file and open the preview panel. `keys` are tried in order
   *  (per-doc upload first, then the project-level stored manuscript). Opens a
   *  loading panel immediately so the click always gives visible feedback, and
   *  a failed key never aborts the chain (IndexedDB/storage rejections used to
   *  reject the whole handler: click did nothing, no alert either). */
  const openDocPreview = async (keys: string[], fallbackName: string) => {
    setDocPreview({ name: fallbackName, url: '', kind: 'loading' })
    setDocPreviewHtml(null)
    let f: File | null = null
    for (const key of keys) {
      try {
        // A hung storage request must not leave the loading panel stuck forever.
        f = await Promise.race([
          getFile(key),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000))
        ])
      } catch {
        f = null
      }
      if (f) break
    }
    if (!f) {
      setDocPreview(null)
      alert('Could not load the file. It may have been removed or never stored.')
      return
    }
    let kind = await detectPreviewKind(f)
    const url = URL.createObjectURL(f)
    // Legacy cloud rows predate the name sidecar and show `${id}.pdf` — prefer
    // the human name the caller already knows (project.fileName, upload name).
    const stored = f.name && !/^[0-9a-f]{8}-[0-9a-f-]{27}(\.[a-z0-9]+)?$/i.test(f.name) ? f.name : fallbackName
    setDocPreview({ name: stored, url, kind })
    if (kind === 'docx') {
      try {
        const buf = await f.arrayBuffer()
        const res = await mammoth.convertToHtml({ arrayBuffer: buf })
        setDocPreviewHtml(res.value || '<p>Could not render document.</p>')
      } catch {
        // Not actually a docx (or unreadable) — fall back to download.
        kind = 'other'
        setDocPreview({ name: stored, url, kind })
        setDocPreviewHtml(null)
      }
    } else {
      setDocPreviewHtml(null)
    }
  }

  // Prepared packages, per journal id.
  const packages = liveProject.journalPackages ?? localPackages
  const currentPkg = packages[selectedJournal.id]
  // The attempt for THIS journal (latest first). Rerouted and switched
  // journals each have their own attempt — only this journal's is shown.
  const attemptForJournal = [...liveProject.submissions]
    .filter((a) => a.targetJournalId === selectedJournal.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  function writeDocs(next: AttachedDoc[]) {
    setLocalDocs(next)
    saveLocalDocs(project.id, next)
    void update((ws) => ({
      ...ws,
      projects: ws.projects.map((p) => (p.id === project.id ? { ...p, attachedDocs: next } : p))
    }))
  }

  // Prepare for submission: snapshot this journal's requirements + attached docs
  // into a reusable package, extract standalone figures/tables when accepted,
  // create a draft attempt, and stay on the portal at the Package section.
  const handlePrepareForSubmission = async () => {
    try {
      setIsSubmitting(true)
      setPackageNotice('')

      // Pull standalone figure/table files out of the stored manuscript PDF
      // when this journal accepts them as separate files.
      const extras: AttachedDoc[] = []
      if (requirements && project.hasStoredFile && (requirements.acceptsSeparateImageFiles || requirements.acceptsSeparateTableFiles)) {
        const srcFile = await getFile(project.id)
        if (srcFile && (srcFile.type === 'application/pdf' || /\.pdf$/i.test(srcFile.name || ''))) {
          if (requirements.acceptsSeparateImageFiles) {
            const figs = await extractFiguresFromPdf(srcFile).catch(() => [])
            for (const fig of figs) {
              const extraKey = `${project.id}--extra--${fig.name}`
              await storeFile(extraKey, new File([fig.blob], fig.name, { type: 'image/png' })).catch(() => undefined)
              extras.push({ docId: `extra--${fig.name}`, name: fig.name, size: fig.blob.size, type: 'image/png', storedAt: new Date().toISOString(), source: 'extracted' })
            }
          }
          if (requirements.acceptsSeparateTableFiles) {
            const tables = await extractTablesFromPdf(srcFile).catch(() => [])
            for (const t of tables) {
              const blob = new Blob([t.csv], { type: 'text/csv' })
              const extraKey = `${project.id}--extra--${t.name}`
              await storeFile(extraKey, new File([blob], t.name, { type: 'text/csv' })).catch(() => undefined)
              extras.push({ docId: `extra--${t.name}`, name: t.name, size: blob.size, type: 'text/csv', storedAt: new Date().toISOString(), source: 'extracted' })
            }
          }
        }
      }

      // Final refined check: validate every document against this journal.
      const checks = await runPackageChecks({
        project,
        requirements,
        docs: attachedDocs,
        extras,
        getFile,
        docKey
      })

      // Readiness audit for this journal, aware of the attached documents.
      // Saved to the project so the readiness page and this package agree.
      const editedSource = project.edited ?? project.extracted
      const audit = editedSource
        ? runReadiness(editedSource, selectedJournal, uid(), attachedDocs, project.hasStoredFile)
        : null
      const sums = audit ? auditSummary(audit) : null
      const readinessSummary = sums && audit
        ? {
            pass: sums.pass,
            attention: sums.attention,
            warning: sums.warning,
            unknown: sums.unknown,
            runAt: audit.runAt
          }
        : undefined

      // Reuse the open attempt for this journal when one exists (a rerouted
      // attempt already carries its link); only start a fresh attempt when
      // there is none yet or the latest one is terminal. Preparing a package
      // must never duplicate an attempt row.
      const latestForJournal = liveProject.submissions
        .filter((a) => a.targetJournalId === selectedJournal.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const reusedAttemptId =
        latestForJournal && allowedTransitions(latestForJournal.status).length > 0 ? latestForJournal.id : null
      const attempt = reusedAttemptId
        ? null
        : createDraftAttempt(liveProject, selectedJournal, liveProject.submissions.length + 1)

      const pkg: SubmissionPackage = {
        journalId: selectedJournal.id,
        journalTitle: selectedJournal.title,
        citationStyle: requirements?.referenceStyle ?? 'Verify on journal site',
        docs: attachedDocs,
        extras,
        preparedAt: new Date().toISOString(),
        checks,
        readiness: readinessSummary
      }
      const nextPackages = { ...packages, [selectedJournal.id]: pkg }
      setLocalPackages(nextPackages)
      saveLocalPackages(project.id, nextPackages)

      // Update project with new submission + package + readiness audit
      await update((ws) => {
        const existing = ws.projects.find(p => p.id === project.id)
        if (!existing) return ws
        const updatedProject: ManuscriptProject = {
          ...existing,
          submissions: attempt ? [...existing.submissions, attempt] : existing.submissions,
          selectedJournalId: selectedJournal.id,
          journalPackages: nextPackages,
          audits: audit ? [audit, ...existing.audits].slice(0, 20) : existing.audits,
          actionsCompleted: existing.actionsCompleted.includes('submission_prepared')
            ? existing.actionsCompleted
            : [...existing.actionsCompleted, 'submission_prepared']
        }
        return {
          ...ws,
          projects: ws.projects.map(p => p.id === project.id ? updatedProject : p)
        }
      })

      const passCount = checks.filter((c) => c.status === 'pass').length
      const failCount = checks.filter((c) => c.status === 'fail').length
      const warnCount = checks.filter((c) => c.status === 'warn').length
      const readinessNote = readinessSummary
        ? ` Readiness: ${readinessSummary.pass} pass · ${readinessSummary.attention + readinessSummary.warning} to review · ${readinessSummary.unknown} unknown.`
        : ''
      setPackageNotice(`Package prepared for ${selectedJournal.title}. Checks: ${passCount} pass · ${warnCount} to review · ${failCount} failed.${readinessNote}`)
      setActiveTab('package')
    } catch (error) {
      console.error('Failed to prepare submission:', error)
      setPackageNotice(`Prepare failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Record that the researcher actually submitted this package to the
  // journal's portal. PubRooter never submits anywhere itself — this is a
  // user-confirmed fact, appended to the attempt's event history.
  const handleRecordSubmitted = async () => {
    if (!attemptForJournal || attemptForJournal.status !== 'draft') return
    try {
      const next = transitionAttempt(attemptForJournal, 'submitted', 'Recorded as submitted from the journal portal.')
      await update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === project.id
            ? { ...p, submissions: p.submissions.map((a) => (a.id === next.id ? next : a)) }
            : p
        )
      }))
      setPackageNotice(`Recorded: submitted to ${attemptForJournal.targetJournalTitle}. Track it in Publications.`)
    } catch (error) {
      setPackageNotice(`Could not record submission: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  // Re-run the final document checks for an already-prepared package.
  async function handleRunChecks() {
    if (!currentPkg) return
    try {
      setBusyExporting(true)
      setPackageNotice('Running document checks...')
      const checks = await runPackageChecks({
        project,
        requirements,
        docs: currentPkg.docs,
        extras: currentPkg.extras,
        getFile,
        docKey
      })
      const nextPkg: SubmissionPackage = { ...currentPkg, checks }
      const nextPackages = { ...packages, [selectedJournal.id]: nextPkg }
      setLocalPackages(nextPackages)
      saveLocalPackages(project.id, nextPackages)
      void update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === project.id ? { ...p, journalPackages: nextPackages } : p
        )
      }))
      const passCount = checks.filter((c) => c.status === 'pass').length
      const failCount = checks.filter((c) => c.status === 'fail').length
      const warnCount = checks.filter((c) => c.status === 'warn').length
      setPackageNotice(`Checks complete: ${passCount} pass · ${warnCount} to review · ${failCount} failed.`)
    } catch (error) {
      setPackageNotice(`Checks failed to run: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setBusyExporting(false)
    }
  }

  // Export the prepared package as a ZIP: manifest + every doc and extra file.
  async function handleExportZip() {
    if (!currentPkg) return
    try {
      setBusyExporting(true)
      setPackageNotice('')
      const entries: ZipEntry[] = []
      const manifest = {
        journal: currentPkg.journalTitle,
        citationStyle: currentPkg.citationStyle,
        preparedAt: currentPkg.preparedAt,
        docs: currentPkg.docs.map((d) => ({ docId: d.docId, name: d.name, size: d.size, type: d.type, source: d.source ?? 'upload' })),
        extras: currentPkg.extras.map((d) => ({ docId: d.docId, name: d.name, size: d.size, type: d.type })),
        checks: (currentPkg.checks ?? []).map((c) => ({ id: c.id, label: c.label, status: c.status, detail: c.detail })),
        readiness: currentPkg.readiness ?? null,
        note: 'Citation style is a snapshot of the journal requirement. Confirm wording on the journal site before submitting.'
      }
      entries.push({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) })

      const used = new Set<string>(['manifest.json'])
      const uniqueName = (n: string) => {
        let name = n
        let i = 2
        while (used.has(name)) {
          const dot = n.lastIndexOf('.')
          name = dot > 0 ? `${n.slice(0, dot)}-${i}${n.slice(dot)}` : `${n}-${i}`
          i++
        }
        used.add(name)
        return name
      }

      for (const doc of [...currentPkg.docs, ...currentPkg.extras]) {
        const key = doc.docId.startsWith('extra--')
          ? `${project.id}--${doc.docId}`
          : doc.docId === 'manuscript' && !uploadedFor('manuscript')
            ? project.id
            : docKey(doc.docId)
        const f = await getFile(key).catch(() => null)
        if (!f) continue
        entries.push({ name: uniqueName(doc.name), data: new Uint8Array(await f.arrayBuffer()) })
      }

      if (entries.length <= 1) {
        setPackageNotice('No stored files were found to export. Upload the documents first, then export again.')
        return
      }

      const zip = buildZip(entries)
      const slug = currentPkg.journalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'journal'
      downloadBlob(`submission-${slug}.zip`, zip)
      setPackageNotice(`Exported ${entries.length - 1} file${entries.length === 2 ? '' : 's'} as submission-${slug}.zip`)
    } catch (error) {
      setPackageNotice(`Export failed: ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setBusyExporting(false)
    }
  }

  // Statement-style docs (no file to upload: the author declares them ready).
  const DECLARABLE_DOCS = new Set([
    'orcid', 'data_availability', 'ethics_statement', 'coi_statement', 'funding_statement', 'structured_abstract'
  ])

  async function handleMarkReady(docId: string, label: string) {
    const meta: AttachedDoc = {
      docId,
      name: `${label} (declared ready)`,
      size: 0,
      type: 'text/plain',
      storedAt: new Date().toISOString(),
      source: 'stored'
    }
    writeDocs([...attachedDocs.filter((f) => f.docId !== docId), meta])
    setDocNotice(`Marked ${label} as ready`)
  }

  async function handleUpload(docId: string, file: File | null | undefined) {
    if (!file) return
    setUploadingId(docId)
    setDocNotice('')
    try {
      await storeFile(docKey(docId), file)
      const meta: AttachedDoc = {
        docId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        storedAt: new Date().toISOString(),
        source: 'upload'
      }
      writeDocs([...attachedDocs.filter((f) => f.docId !== docId), meta])
      setDocNotice(`Uploaded ${file.name}`)
    } catch (error) {
      setDocNotice(`Upload failed: ${error instanceof Error ? error.message : 'could not store the file'}`)
    } finally {
      setUploadingId(null)
    }
  }

  async function handleRemoveUpload(docId: string) {
    const existing = uploadedFor(docId)
    if (!existing) return
    setUploadingId(docId)
    setDocNotice('')
    try {
      await deleteFile(docKey(docId)).catch(() => undefined)
      writeDocs(attachedDocs.filter((f) => f.docId !== docId))
      setDocNotice(`Removed ${existing.name}`)
    } finally {
      setUploadingId(null)
    }
  }

  // Accepted formats per document type, driven by the requirements registry.
  function docFormat(docId: string): string {
    if (docId === 'manuscript') return (requirements?.manuscriptFormat ?? ['DOC', 'DOCX', 'PDF']).join(' · ')
    if (docId === 'orcid') return 'ORCID iD'
    if (docId === 'figures_supplementary') {
      const fmts = [
        ...(requirements?.figureFormat ?? []),
        ...(requirements?.tableFormat ?? []),
        ...(requirements?.supplementaryFormat ?? [])
      ]
      return fmts.length > 0 ? [...new Set(fmts)].join(' · ') : 'Verify on journal site'
    }
    return 'DOC · DOCX · PDF'
  }

  function docAccept(docId: string): string {
    if (docId === 'figures_supplementary') {
      return '.tif,.tiff,.eps,.png,.jpeg,.jpg,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip'
    }
    return '.doc,.docx,.pdf'
  }

  // Get required documents checklist
  const getRequiredDocuments = () => {
    if (!requirements) return []

    const docs = []

    // Core required documents
    docs.push({
      id: 'manuscript',
      label: 'Manuscript file',
      required: true,
      status: project.hasStoredFile ? 'present' : 'missing',
      note: project.hasStoredFile ? 'Stored manuscript PDF uploaded' : 'Required: Final manuscript PDF'
    })

    if (requirements.requiresCoverLetter) {
      docs.push({
        id: 'cover_letter',
        label: 'Cover letter',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresTitlePage) {
      docs.push({
        id: 'title_page',
        label: 'Title page',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresStructuredAbstract && project.edited?.abstract) {
      docs.push({
        id: 'structured_abstract',
        label: 'Structured abstract',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresDataAvailability) {
      docs.push({
        id: 'data_availability',
        label: 'Data availability statement',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresEthicsStatement) {
      docs.push({
        id: 'ethics_statement',
        label: 'Ethics statement',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresConflictOfInterest) {
      docs.push({
        id: 'coi_statement',
        label: 'Conflict of interest statement',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresFunding) {
      docs.push({
        id: 'funding_statement',
        label: 'Funding statement',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    if (requirements.requiresORCID) {
      docs.push({
        id: 'orcid',
        label: 'ORCID IDs for all authors',
        required: true,
        status: 'unknown',
        note: requirements.source === 'known'
          ? 'Required by journal guidelines'
          : 'Verify requirement on journal website'
      })
    }

    // Files section
    if (requirements.acceptsSeparateImageFiles || requirements.acceptsSeparateTableFiles) {
      docs.push({
        id: 'figures_supplementary',
        label: 'Figures and supplementary material',
        required: false,
        status: 'unknown',
        note: requirements.source === 'known'
          ? `Journal accepts separate ${requirements.acceptsSeparateImageFiles ? 'image' : ''} and ${requirements.acceptsSeparateTableFiles ? 'table' : ''} files`
          : 'Verify file format requirements on journal website'
      })
    }

    // Overlay files the user uploaded for this journal
    return docs.map((d) => {
      const base = { ...d, format: docFormat(d.id) }
      const uploaded = uploadedFor(d.id)
      if (uploaded) {
        return {
          ...base,
          status: 'present' as const,
          note: `${uploaded.name} · ${formatBytes(uploaded.size)} · uploaded ${new Date(uploaded.storedAt).toLocaleDateString()}`
        }
      }
      return base
    })
  }

  // Get ready documents based on requirements
  const getReadyDocuments = () => {
    const docs = getRequiredDocuments()
    const readyDocs = docs.filter(doc => doc.status === 'present' || doc.status === 'ready')
    const missingDocs = docs.filter(doc => doc.status === 'missing' || doc.status === 'unknown')

    return { readyDocs, missingDocs }
  }

  // Get guidelines from portal
  const getSubmissionGuidelines = () => {
    if (!portalData) return []
    return portalData.portalData.submissionGuidelines
  }

  // Get timeline from portal
  const getSubmissionTimeline = () => {
    if (!portalData) return []
    return portalData.portalData.timeline
  }

  if (isLoading) {
    return (
      <div className="journal-portal">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading journal portal...</p>
        </div>
      </div>
    )
  }

  const { readyDocs, missingDocs } = getReadyDocuments()

  // Overall submission progress shown in the sidebar
  const latestAudit = project.audits
    .filter(a => a.journalId === selectedJournal.id)
    .sort((a, b) => b.runAt.localeCompare(a.runAt))[0]
  const auditCounts = latestAudit ? auditSummary(latestAudit) : null
  const totalDocs = readyDocs.length + missingDocs.length
  // Only required docs gate preparation. Optional items (figures/supplementary)
  // must never block the package forever.
  const requiredOutstanding = missingDocs.filter((d) => d.required)
  const packagePrepared = !!currentPkg
  const pkgChecks = currentPkg?.checks ?? []
  const checkCounts = {
    pass: pkgChecks.filter((c) => c.status === 'pass').length,
    warn: pkgChecks.filter((c) => c.status === 'warn').length,
    fail: pkgChecks.filter((c) => c.status === 'fail').length,
    unknown: pkgChecks.filter((c) => c.status === 'unknown').length
  }

  // Next-best journals (excluding the one being viewed) with a requirement delta.
  const switchCandidates = (project.analysis?.matches ?? [])
    .filter((m) => m.journal.id !== selectedJournal.id)
    .slice(0, 4)
    .map((m) => {
      const reqs = getJournalRequirements(m.journal)
      const gains: string[] = []
      const losses: string[] = []
      if (requirements) {
        if (requirements.requiresCoverLetter && !reqs.requiresCoverLetter) gains.push('No cover letter')
        if (!requirements.requiresCoverLetter && reqs.requiresCoverLetter) losses.push('Cover letter required')
        if (requirements.requiresTitlePage && !reqs.requiresTitlePage) gains.push('No title page')
        if (!requirements.requiresTitlePage && reqs.requiresTitlePage) losses.push('Title page required')
        if (requirements.requiresDoubleBlind && !reqs.requiresDoubleBlind) gains.push('No double-blind formatting')
        if (!requirements.requiresDoubleBlind && reqs.requiresDoubleBlind) losses.push('Double-blind required')
        if (requirements.wordLimitMainText && reqs.wordLimitMainText && reqs.wordLimitMainText > requirements.wordLimitMainText) {
          gains.push(`Longer limit (${reqs.wordLimitMainText} words)`)
        }
        if (requirements.wordLimitMainText && reqs.wordLimitMainText && reqs.wordLimitMainText < requirements.wordLimitMainText) {
          losses.push(`Shorter limit (${reqs.wordLimitMainText} words)`)
        }
      }
      return { match: m, gains, losses }
    })

  const steps = [
    {
      id: 'analysis',
      label: 'Analysis complete',
      done: !!project.analysis,
      detail: project.analysis
        ? `${project.analysis.matches.length} candidate journals ranked`
        : 'Run analysis from the manuscript page'
    },
    {
      id: 'journal',
      label: 'Journal selected',
      done: project.selectedJournalId === selectedJournal.id,
      detail: project.selectedJournalId === selectedJournal.id
        ? selectedJournal.title
        : 'Pick a journal for this submission'
    },
    {
      id: 'readiness',
      label: 'Readiness check',
      done: !!auditCounts,
      detail: auditCounts
        ? `${auditCounts.pass} check${auditCounts.pass === 1 ? '' : 's'} pass · ${auditCounts.attention} need${auditCounts.attention === 1 ? 's' : ''} attention`
        : 'Not run yet for this journal'
    },
    {
      id: 'requirements',
      label: 'Journal requirements loaded',
      done: !!portalData && !!requirements,
      detail: portalData && requirements
        ? 'Guidelines, requirements, timeline and FAQs'
        : 'Journal data failed to load'
    },
    {
      id: 'documents',
      label: 'Documents ready',
      done: totalDocs > 0 && requiredOutstanding.length === 0,
      detail: totalDocs > 0
        ? requiredOutstanding.length > 0
          ? `${readyDocs.length} of ${totalDocs} ready. Still needed: ${requiredOutstanding.map(d => d.label).join(', ')}`
          : `All required documents ready${missingDocs.length > 0 ? ` (${missingDocs.length} optional item${missingDocs.length === 1 ? '' : 's'} unknown)` : ''}`
        : 'No document requirements detected'
    },
    {
      id: 'package',
      label: 'Submission package prepared',
      done: packagePrepared,
      detail: packagePrepared
        ? `Prepared ${new Date(currentPkg!.preparedAt).toLocaleDateString()} · citation style snapshot saved`
        : 'Prepare the package when required documents are ready'
    }
  ]
  const doneCount = steps.filter(s => s.done).length
  const haveItems = steps.filter(s => s.done).map(s => s.label)
  const missingItems = steps.filter(s => !s.done).map(s => s.label)
  const journalInitials = selectedJournal.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  // Signed-in user (GitHub-style avatar menu in the top-right corner)
  const userInitials = (profile?.name || profile?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const handleSignOut = async () => {
    setMenuOpen(false)
    try {
      await signOut()
    } finally {
      onNavigate('home')
    }
  }

  return (
    <div className="journal-portal">
      {/* Portal top bar with user profile */}
      <div className="portal-topbar">
        <div className="topbar-left">
          <span className="topbar-mark" aria-hidden="true">PR</span>
          <span className="topbar-title">
            PubRooter <span className="sep">/</span> <span className="muted">Journal Portal</span>
          </span>
        </div>
        <div className="topbar-right">
          <div className="user-menu">
            <button
              type="button"
              className="user-avatar"
              title={profile?.name || profile?.email || 'Account'}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              {userInitials}
            </button>
            {menuOpen && (
              <div className="user-pop" role="menu">
                <div className="user-pop-head">
                  <span className="user-pop-avatar">{userInitials}</span>
                  <div className="user-pop-id">
                    <strong>{profile?.name || 'Researcher'}</strong>
                    <span>{profile?.email}</span>
                  </div>
                </div>
                {profile?.affiliation ? (
                  <div className="user-pop-meta">{profile.affiliation}</div>
                ) : null}
                <div className="user-pop-meta">
                  Signed in · {mode === 'cloud' ? 'Cloud workspace' : 'Local workspace'}
                </div>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onNavigate('tool') }}
                >
                  Back to Workspace
                </button>
                <button
                  type="button"
                  className="menu-item danger"
                  role="menuitem"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Journal Header */}
      <div className="journal-header">
        <div className="journal-branding">
          <div className="journal-logo">
            {portalData?.portalData.logoUrl ? (
              <img src={portalData.portalData.logoUrl} alt={`${selectedJournal.title} logo`} />
            ) : (
              <span aria-hidden="true">{journalInitials}</span>
            )}
          </div>
          <div className="journal-info">
            <h1>{selectedJournal.title}</h1>
            <div className="journal-meta-row">
              {selectedJournal.publisher && <span className="journal-meta-pill">{selectedJournal.publisher}</span>}
              <span className="journal-meta-pill">ISSN: {selectedJournal.issn || 'N/A'}</span>
              <span className={`journal-meta-pill ${selectedJournal.isOpenAccess ? 'journal-meta-pill-oa' : 'journal-meta-pill-sub'}`}>
                {selectedJournal.isOpenAccess ? 'Open Access' : 'Subscription'}
              </span>
              <span className="journal-meta-pill journal-meta-pill-src">{selectedJournal.source}</span>
            </div>
            {portalData?.portalData.description && (
              <p className="journal-description">{portalData.portalData.description}</p>
            )}
          </div>
        </div>
        <div className="portal-actions">
          <button
            onClick={() => onNavigate('tool')}
            className="btn-secondary"
          >
            ← Back to Workspace
          </button>
          <button
            onClick={() => { if (siteUrl) window.open(siteUrl, '_blank', 'noopener,noreferrer') }}
            className="btn-secondary"
            disabled={!siteUrl}
            title={siteUrl ? `Open ${siteUrl}` : 'Journal website could not be resolved. Verify on the publisher site.'}
          >
            Visit Journal Website ↗
          </button>
        </div>
      </div>

      <div className={`portal-body ${sideOpen ? '' : 'side-collapsed'}`}>
      <div className="portal-main">
      {!sideOpen && (
        <div className="side-expand-wrap">
          <button type="button" className="side-expand" onClick={() => setSideOpen(true)}>
            Show sections ›
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'guidelines' && (
          <div className="guidelines-section">
            <PortalBox title="Submission Guidelines" meta={`${getSubmissionGuidelines().length} guidelines`}>
              {getSubmissionGuidelines().map(guide => (
                <div key={guide.id} className={`guideline-item ${guide.type}`}>
                  <h4>{guide.title}</h4>
                  <p>{guide.content}</p>
                  {guide.sourceUrl && (
                    <a href={guide.sourceUrl} target="_blank" rel="noopener noreferrer">
                      View on journal website
                    </a>
                  )}
                </div>
              ))}
            </PortalBox>
          </div>
        )}

        {activeTab === 'requirements' && requirements && portalRequirements && (
          <div className="requirements-section">
            <PortalBox title="Manuscript Requirements" meta="Length & structure">
              <div className="requirement-grid">
                <div className="requirement-item is-required">
                  <strong>Word Count:</strong> {portalRequirements.manuscript.wordCount?.min || 'N/A'} - {portalRequirements.manuscript.wordCount?.max || 'N/A'} words
                </div>
                <div className="requirement-item is-required">
                  <strong>Pages:</strong> {portalRequirements.manuscript.minPages || 'N/A'} - {portalRequirements.manuscript.maxPages || 'N/A'} pages
                </div>
                <div className="requirement-item is-required">
                  <strong>Sections Required:</strong> {portalRequirements.manuscript.sections.filter(s => s.required).map(s => s.title).join(', ')}
                </div>
                <div className="requirement-item is-required">
                  <strong>Abstract:</strong> {portalRequirements.content.abstract.required ? 'Required' : 'Optional'}
                  {portalRequirements.content.abstract.wordLimit && ` (${portalRequirements.content.abstract.wordLimit} words max)`}
                </div>
              </div>
            </PortalBox>

            <PortalBox title="Content Requirements" meta="Statements & declarations">
              <div className="requirement-grid">
                <div className="requirement-item">
                  <strong>Cover Letter:</strong> {requirements.requiresCoverLetter ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>Structured Abstract:</strong> {requirements.requiresStructuredAbstract ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>Data Availability:</strong> {requirements.requiresDataAvailability ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>Ethics Statement:</strong> {requirements.requiresEthicsStatement ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>Conflict of Interest:</strong> {requirements.requiresConflictOfInterest ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>Funding Statement:</strong> {requirements.requiresFunding ? 'Required' : 'Optional'}
                </div>
                <div className="requirement-item">
                  <strong>ORCID Required:</strong> {requirements.requiresORCID ? 'All authors' : 'Not required'}
                </div>
              </div>
            </PortalBox>

            <PortalBox title="Formatting Requirements" meta="Citations & files">
              <div className="requirement-grid">
                <div className="requirement-item">
                  <strong>Manuscript file:</strong> {requirements.manuscriptFormat.join(', ')}
                </div>
                <div className="requirement-item">
                  <strong>Citation Style:</strong> {portalRequirements.formatting.citationStyle}
                </div>
                <div className="requirement-item">
                  <strong>Reference Format:</strong> {portalRequirements.formatting.references.format}
                </div>
                <div className="requirement-item">
                  <strong>File Formats:</strong> {portalRequirements.formatting.figures[0]?.formats.join(', ') || 'Verify on site'}
                </div>
                <div className="requirement-item">
                  <strong>Max File Size:</strong> {portalRequirements.technical.fileSize?.maxSize}{portalRequirements.technical.fileSize?.unit || ' MB'}
                </div>
              </div>
            </PortalBox>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-section">
            <PortalBox title="Submission Timeline & Process" meta={`${getSubmissionTimeline().length} phases`}>
              <div className="timeline-track">
                {getSubmissionTimeline().map((phase, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-phase">
                      <span className="phase-number">{index + 1}</span>
                      <div className="phase-content">
                        <h4>{phase.phase}</h4>
                        <p className="phase-duration">{phase.duration}</p>
                        <p className="phase-description">{phase.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </PortalBox>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="documents-section" style={{ width: '100%' }}>
            <PortalBox title="Required Documents" meta={`${readyDocs.length} ready · ${missingDocs.length} missing`}>
              <div className="documents-summary">
              <div className="doc-stats">
                <span className="ready-count">{readyDocs.length} ready</span>
                <span className="missing-count">{missingDocs.length} missing</span>
                <span className="unknown-count">{missingDocs.filter(d => d.status === 'unknown').length} unknown</span>
              </div>
            </div>

            {docNotice && <p className="doc-notice" role="status">{docNotice}</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: '1.5rem', alignItems: 'start', width: '100%' }}>
              <div>
                {readyDocs.length > 0 && (
                  <div className="documents-group">
                    <h4>Ready</h4>
                    {readyDocs.map(doc => {
                      const uploaded = uploadedFor(doc.id) || (doc.id === 'manuscript' && project.hasStoredFile ? { name: 'Stored manuscript', size: 0, type: 'application/pdf', storedAt: '' } : undefined)
                      return (
                      <div key={doc.id} className="document-item ready" style={{ flexDirection: 'row', alignItems: 'center', padding: '0.75rem', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <div className="doc-status" style={{ width: '24px', height: '24px' }}>
                          <span className="status-icon" style={{ fontSize: '0.9rem' }}>✓</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0c0f12' }}>{doc.label}</h5>
                            {uploaded && (
                              <span style={{ fontSize: '0.7rem', color: '#0c8930', background: '#e9f9ee', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 600 }}>
                                ✓ {uploaded.name}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#1c1c1c', fontWeight: 500 }}>{doc.format ? `Accepted: ${doc.format}` : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          <label className="upload-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }} title={`Replace ${doc.label}`}>
                            {uploadingId === doc.id ? '...' : uploaded ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept={docAccept(doc.id)}
                              disabled={uploadingId !== null}
                              onChange={(e) => {
                                void handleUpload(doc.id, e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {uploaded && (
                            <>
                              <button type="button" className="ws-linkish" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} onClick={() => { void openDocPreview(previewKeys(doc.id), uploaded?.name || doc.label) }}>
                                Preview
                              </button>
                              <button type="button" className="remove-btn" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} disabled={uploadingId !== null} onClick={() => void handleRemoveUpload(doc.id)}>
                                Remove
                              </button>
                            </>
                          )}
                          {doc.id === 'manuscript' && project.hasStoredFile && !uploaded && (
                            <button type="button" className="ws-linkish" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} onClick={() => { void openDocPreview(previewKeys('manuscript'), project.fileName || 'Manuscript.pdf') }}>
                              Preview
                            </button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}

                {missingDocs.length > 0 && (
                  <div className="documents-group">
                    <h4>Missing or unknown</h4>
                    {missingDocs.map(doc => {
                      const uploaded = uploadedFor(doc.id)
                      return (
                      <div key={doc.id} className="document-item missing" style={{ flexDirection: 'row', alignItems: 'center', padding: '0.75rem', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <div className="doc-status" style={{ width: '24px', height: '24px' }}>
                          <span className="status-icon" style={{ fontSize: '0.9rem' }}>!</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <h5 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0c0f12' }}>{doc.label} {doc.required && <span className="required-badge" style={{ fontSize: '0.65rem' }}>Required</span>}</h5>
                            {uploaded && (
                              <span style={{ fontSize: '0.7rem', color: '#b34700', background: '#fff3e6', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 600 }}>
                                ✓ {uploaded.name}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#1c1c1c', fontWeight: 500 }}>{doc.format ? `Accepted: ${doc.format}` : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          <label className="upload-btn" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>
                            {uploadingId === doc.id ? '...' : uploaded ? 'Replace' : 'Upload'}
                            <input
                              type="file"
                              accept={docAccept(doc.id)}
                              disabled={uploadingId !== null}
                              onChange={(e) => {
                                void handleUpload(doc.id, e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          {!uploaded && DECLARABLE_DOCS.has(doc.id) && (
                            <button type="button" className="ws-linkish" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} onClick={() => void handleMarkReady(doc.id, doc.label)}>
                              Mark ready
                            </button>
                          )}
                          {uploaded && (
                            <>
                              <button type="button" className="ws-linkish" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} onClick={() => { void openDocPreview(previewKeys(doc.id), uploaded?.name || doc.label) }}>
                                Preview
                              </button>
                              <button type="button" className="remove-btn" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} disabled={uploadingId !== null} onClick={() => void handleRemoveUpload(doc.id)}>
                                Remove
                              </button>
                            </>
                          )}
                          {doc.id === 'manuscript' && project.hasStoredFile && !uploaded && (
                            <button type="button" className="ws-linkish" style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem' }} onClick={() => { void openDocPreview(previewKeys('manuscript'), project.fileName || 'Manuscript.pdf') }}>
                              Preview
                            </button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ border: '2px solid #d0d0d0', borderRadius: '8px', background: '#dfe5ec', height: 'calc(100vh - 250px)', minHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {docPreview ? (
                  <>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docPreview.name}</strong>
                      <button type="button" className="ws-btn ws-btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', flexShrink: 0 }} onClick={() => { if (docPreview.url) URL.revokeObjectURL(docPreview.url); setDocPreview(null); setDocPreviewHtml(null); }}>
                        Close
                      </button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, position: 'relative', background: docPreview.kind === 'pdf' ? '#4a4f55' : '#eef1f5' }}>
                      {docPreview.kind === 'loading' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.8rem', background: '#eef1f5' }}>
                          <span className="ws-boot-spin" aria-hidden="true" />
                          <span style={{ color: '#48525e', fontSize: '0.9rem' }}>Loading preview…</span>
                        </div>
                      ) : docPreview.kind === 'pdf' ? (
                        <iframe src={`${docPreview.url}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block' }} title={docPreview.name} />
                      ) : docPreview.kind === 'image' ? (
                        <div style={{ padding: '1.25rem', textAlign: 'center', overflow: 'auto', height: '100%' }}>
                          <span style={{ display: 'inline-block', background: '#fff', padding: '0.75rem', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
                            <img src={docPreview.url} alt={docPreview.name} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                          </span>
                        </div>
                      ) : docPreview.kind === 'docx' ? (
                        <div style={{ overflow: 'auto', height: '100%', padding: '1.25rem' }}>
                          <div
                            style={{ background: '#fff', maxWidth: '760px', minHeight: 'calc(100% - 0.5rem)', margin: '0 auto', padding: '1.75rem 2rem', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                            dangerouslySetInnerHTML={{ __html: docPreviewHtml || '<p>Loading…</p>' }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
                          <p style={{ color: '#48525e', margin: 0 }}>Preview not available for this file type.</p>
                          <a href={docPreview.url} download={docPreview.name} style={{ padding: '0.5rem 1rem', background: '#0056d6', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>Download file</a>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', background: '#eef1f5' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#8a94a1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <div style={{ textAlign: 'center' }}>
                      <strong style={{ color: '#333', fontSize: '1.1rem' }}>Document Preview</strong>
                      <p style={{ color: '#5a6472', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>Click Preview on an uploaded document to view it here</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </PortalBox>
          </div>
        )}

        {activeTab === 'package' && (
          <div className="package-section" style={{ width: '100%' }}>
            <PortalBox
              title="Submission Package"
              meta={currentPkg ? `Prepared ${new Date(currentPkg.preparedAt).toLocaleDateString()}` : 'Not prepared yet'}
            >
              {packageNotice && <p className="pkg-notice" role="status">{packageNotice}</p>}

              {currentPkg ? (
                <>
                  <div className="pkg-summary">
                    <div className="pkg-summary-row">
                      <span className="pkg-label">Journal</span>
                      <span className="pkg-value">{currentPkg.journalTitle}</span>
                    </div>
                    <div className="pkg-summary-row">
                      <span className="pkg-label">Citation style snapshot</span>
                      <span className="pkg-value">{currentPkg.citationStyle}</span>
                    </div>
                    <div className="pkg-summary-row">
                      <span className="pkg-label">Prepared</span>
                      <span className="pkg-value">{new Date(currentPkg.preparedAt).toLocaleString()}</span>
                    </div>
                    {currentPkg.readiness && (
                      <div className="pkg-summary-row">
                        <span className="pkg-label">Readiness audit</span>
                        <span className="pkg-value">
                          {currentPkg.readiness.pass} pass · {currentPkg.readiness.attention + currentPkg.readiness.warning} to review · {currentPkg.readiness.unknown} unknown
                        </span>
                      </div>
                    )}
                    <p className="pkg-note">
                      The citation style is a snapshot of the journal requirement at prepare time.
                      Confirm wording and formatting on the journal site before submitting.
                    </p>
                  </div>

                  {pkgChecks.length > 0 ? (
                    <div className="pkg-checks">
                      <h4>
                        Document checks
                        <span className="pkg-checks-counts">
                          {checkCounts.pass} pass · {checkCounts.warn} to review · {checkCounts.fail} failed{checkCounts.unknown > 0 ? ` · ${checkCounts.unknown} unknown` : ''}
                        </span>
                      </h4>
                      <ul className="pkg-check-list">
                        {pkgChecks.map((c) => (
                          <li key={c.id} className={`pkg-check pkg-check-${c.status}`}>
                            <span className="pkg-check-dot" aria-hidden="true" />
                            <span className="pkg-check-label">{c.label}</span>
                            <span className="pkg-check-detail">{c.detail}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="pkg-note">
                        Checks ran against this journal's requirements at prepare time.
                        They catch format, size, word-limit and completeness problems,
                        but a human pass is still needed before you submit.
                      </p>
                    </div>
                  ) : (
                    <div className="pkg-checks">
                      <h4>Document checks</h4>
                      <p className="pkg-note">This package was prepared before checks existed, or checks have not run yet.</p>
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={busyExporting}
                        onClick={() => void handleRunChecks()}
                      >
                        {busyExporting ? 'Running checks...' : 'Run document checks'}
                      </button>
                    </div>
                  )}

                  <div className="pkg-files">
                    <h4>Included documents ({currentPkg.docs.length + currentPkg.extras.length})</h4>
                    <ul className="pkg-file-list">
                      {[...currentPkg.docs, ...currentPkg.extras].map((d) => (
                        <li key={d.docId} className="pkg-file-item">
                          <span className="pkg-file-name">{d.name}</span>
                          <span className="pkg-file-meta">
                            {formatBytes(d.size)}
                            {d.source === 'extracted' ? ' · extracted from manuscript' : ''}
                          </span>
                        </li>
                      ))}
                      {currentPkg.docs.length + currentPkg.extras.length === 0 && (
                        <li className="pkg-file-item pkg-empty">No files were attached when this package was prepared.</li>
                      )}
                    </ul>
                  </div>

                  <div className="pkg-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busyExporting}
                      onClick={() => void handleExportZip()}
                    >
                      {busyExporting ? 'Building ZIP...' : 'Export package as ZIP'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={isSubmitting || requiredOutstanding.length > 0}
                      onClick={() => void handlePrepareForSubmission()}
                      title={requiredOutstanding.length > 0 ? 'Some required documents are still missing' : undefined}
                    >
                      {isSubmitting ? 'Updating...' : 'Update package'}
                    </button>
                    {attemptForJournal && attemptForJournal.status === 'draft' && (
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => void handleRecordSubmitted()}
                        title="Record that you submitted this package to the journal's portal"
                      >
                        Mark as submitted
                      </button>
                    )}
                    {attemptForJournal && attemptForJournal.status !== 'draft' && (
                      <span className={`jp-sub-badge jp-sub-${attemptForJournal.status}`}>
                        {SUBMISSION_STATUS_LABEL[attemptForJournal.status]}
                      </span>
                    )}
                    <button type="button" className="btn-outline" onClick={goToPublications}>
                      Track in Publications →
                    </button>
                  </div>
                  {requiredOutstanding.length > 0 && (
                    <p className="pkg-note">
                      {requiredOutstanding.length} required document{requiredOutstanding.length === 1 ? '' : 's'} missing.
                      Update the package once they are uploaded.
                    </p>
                  )}
                </>
              ) : (
                <div className="pkg-empty-state">
                  <p>
                    Prepare once to validate this journal's requirements against your documents,
                    then switch to another journal and export again without re-uploading.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSubmitting || requiredOutstanding.length > 0}
                    onClick={() => void handlePrepareForSubmission()}
                  >
                    {isSubmitting ? 'Preparing...' : 'Prepare for Submission'}
                  </button>
                  {requiredOutstanding.length > 0 && (
                    <p className="pkg-note">
                      {requiredOutstanding.length} required document{requiredOutstanding.length === 1 ? '' : 's'} still needed:{' '}
                      {requiredOutstanding.map((d) => d.label).join(', ')}.
                    </p>
                  )}
                </div>
              )}

              {switchCandidates.length > 0 && (
                <div className="pkg-switch">
                  <h4>Switch to another journal</h4>
                  <p className="pkg-note">
                    Your attached documents stay with the project. Opening another journal re-checks
                    its requirements against the same files.
                  </p>
                  <ul className="pkg-switch-list">
                    {switchCandidates.map(({ match, gains, losses }) => (
                      <li key={match.journal.id} className="pkg-switch-item">
                        <div className="pkg-switch-head">
                          <strong>{match.journal.title}</strong>
                          <span className="pkg-switch-pub">{match.journal.publisher}</span>
                        </div>
                        <div className="pkg-switch-delta">
                          {gains.length > 0 && (
                            <span className="pkg-gain">Easier: {gains.join(' · ')}</span>
                          )}
                          {losses.length > 0 && (
                            <span className="pkg-loss">Stricter: {losses.join(' · ')}</span>
                          )}
                          {gains.length === 0 && losses.length === 0 && (
                            <span className="pkg-same">Similar requirements</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="ws-linkish"
                          onClick={() => onNavigate('journal-portal', { project: liveProject, selectedJournal: match.journal })}
                        >
                          Open portal
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </PortalBox>
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="faqs-section">
            <PortalBox title="Frequently Asked Questions" meta={`${portalData?.portalData.faqs.length ?? 0} FAQs`}>
              {portalData?.portalData.faqs.map((faq, index) => (
                <div key={index} className="faq-item">
                  <h4>{faq.question}</h4>
                  <p>{faq.answer}</p>
                  {faq.category && (
                    <span className="faq-category">{faq.category}</span>
                  )}
                </div>
              ))}
            </PortalBox>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="contact-section">
            <PortalBox title="Contact the Journal" meta={selectedJournal.publisher}>
              <ul className="contact-list">
              {portalData?.portalData.contactInfo.email && (
                <li>
                  <span className="label">Email</span>
                  <a href={`mailto:${portalData.portalData.contactInfo.email}`}>{portalData.portalData.contactInfo.email}</a>
                </li>
              )}
              {portalData?.portalData.contactInfo.phone && (
                <li>
                  <span className="label">Phone</span>
                  <span>{portalData.portalData.contactInfo.phone}</span>
                </li>
              )}
              {siteUrl && (
                <li>
                  <span className="label">Website</span>
                  <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                    {siteUrl}
                  </a>
                </li>
              )}
              {portalData?.portalData.contactInfo.address && (
                <li>
                  <span className="label">Address</span>
                  <span>{portalData.portalData.contactInfo.address}</span>
                </li>
              )}
            </ul>
            {!portalData && <p className="contact-note">Contact details could not be loaded.</p>}
            <p className="contact-note">
              Details come from the journal's site. If anything looks wrong, verify on the journal website.
            </p>
            <button
              className="btn-outline"
              disabled={!siteUrl}
              onClick={() => { if (siteUrl) window.open(siteUrl, '_blank', 'noopener,noreferrer') }}
            >
              Open Journal Website
            </button>
            {!siteUrl && (
              <p className="contact-note">
                The journal website could not be resolved from open metadata. Search for the journal by name or ISSN to find its official site.
              </p>
            )}
            </PortalBox>
          </div>
        )}
      </div>
      </div>

      {/* Progress + sections sidebar (collapsible) */}
      <aside className="progress-sidebar" aria-label="Portal sections and submission progress">
        <div className="side-nav-head">
          <h3>Sections</h3>
          <button
            type="button"
            className="side-collapse"
            onClick={() => setSideOpen(false)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            ›
          </button>
        </div>
        <nav className="side-nav" aria-label="Portal sections">
          {PORTAL_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`side-nav-item ${activeTab === s.id ? 'active' : ''}`}
              aria-current={activeTab === s.id ? 'page' : undefined}
              onClick={() => setActiveTab(s.id)}
            >
              <span>{s.label}</span>
              {s.id === 'documents' && requiredOutstanding.length > 0 && (
                <span className="side-badge">{requiredOutstanding.length} missing</span>
              )}
              {s.id === 'package' && currentPkg && (
                <span className="side-badge side-badge-ok">Ready</span>
              )}
            </button>
          ))}
        </nav>

        <div className="progress-head">
          <h3>Submission Progress</h3>
          <span className="progress-count">{doneCount} of {steps.length}</span>
        </div>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={steps.length}
        >
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
          />
        </div>

        <ol className="progress-steps">
          {steps.map((step, i) => (
            <li key={step.id} className={`progress-step ${step.done ? 'done' : 'todo'}`}>
              <span className="step-mark" aria-hidden="true">{step.done ? '✓' : i + 1}</span>
              <div className="step-text">
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="progress-summary">
          <div className="summary-block have">
            <h4>What we have</h4>
            {haveItems.length > 0 ? (
              <ul>{haveItems.map(item => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p className="none">Nothing yet</p>
            )}
          </div>
          <div className="summary-block missing">
            <h4>What we're missing</h4>
            {missingItems.length > 0 ? (
              <ul>{missingItems.map(item => <li key={item}>{item}</li>)}</ul>
            ) : (
              <p className="none">Nothing. All steps complete</p>
            )}
          </div>
        </div>

        <div className="sidebar-cta">
          <button
            onClick={() => {
              void handlePrepareForSubmission()
            }}
            className="btn-primary"
            disabled={isSubmitting || requiredOutstanding.length > 0}
          >
            {isSubmitting ? 'Preparing...' : currentPkg ? 'Update package' : 'Prepare for Submission'}
          </button>
          {requiredOutstanding.length > 0 ? (
            <p className="cta-reason">
              {requiredOutstanding.length} required document{requiredOutstanding.length === 1 ? '' : 's'} missing before you can prepare.
            </p>
          ) : currentPkg ? (
            <p className="cta-reason cta-ok">Package prepared. Export the ZIP from the Package section, then track it in Publications.</p>
          ) : (
            <p className="cta-reason cta-ok">All required documents ready. You can prepare the package.</p>
          )}
        </div>
      </aside>
      </div>

      {/* Portal Footer */}
      <div className="portal-footer" style={{ display: 'none' }}>
      </div>
    </div>
  )
}

export default JournalPortal