import { DragEvent, FormEvent, useRef, useState } from 'react'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { storeFile } from '../../workspace/storage'
import { extractFromPdf, formatBytes, validatePdfFile, validatePdfMagic, MAX_UPLOAD_BYTES } from '../../workspace/pdf'
import { runAnalysis } from '../../workspace/pipeline'
import { uid } from '../../lib/storage'
import { DEFAULT_PREFERENCES, emptyExtracted, type ExtractedContent, type ManuscriptProject, type ResearchPreferences } from '../../workspace/types'
import { logActivity } from '../../workspace/activity'
import type { WorkspaceView } from './WorkspaceApp'

type Step = 'upload' | 'review' | 'constraints' | 'analyze'

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'upload', label: '1 · Upload' },
  { key: 'review', label: '2 · Review extraction' },
  { key: 'constraints', label: '3 · Constraints' },
  { key: 'analyze', label: '4 · Analyze' }
]

export function NewManuscript({ go }: { go: (v: WorkspaceView) => void }) {
  const { data, update, log } = useWorkspace()
  const [step, setStep] = useState<Step>('upload')
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [readProgress, setReadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [extractionError, setExtractionError] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedContent | null>(null)
  const [prefs, setPrefs] = useState<ResearchPreferences | null>(null)
  const [phaseNote, setPhaseNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (!data) return null

  function newProject(id: string, f: File, content: ExtractedContent | null, stored: boolean): ManuscriptProject {
    const now = new Date().toISOString()
    return {
      id,
      createdAt: now,
      updatedAt: now,
      name: content?.title?.trim() || f.name.replace(/\.pdf$/i, ''),
      fileName: f.name,
      fileSize: f.size,
      hasStoredFile: stored,
      status: content ? 'reviewing' : 'extracting',
      error: null,
      extracted: content,
      edited: null,
      preferences: { ...DEFAULT_PREFERENCES, ...data!.defaultPreferences },
      analysis: null,
      audits: [],
      selectedJournalId: null,
      comparedJournalIds: [],
      actionsCompleted: [],
      submissions: []
    }
  }

  async function handleFile(f: File | null | undefined) {
    if (!f || !data) return
    setUploadError('')
    const basic = validatePdfFile(f)
    if (!basic.ok) {
      setUploadError(basic.error!)
      return
    }
    const magic = await validatePdfMagic(f)
    if (!magic.ok) {
      setUploadError(magic.error!)
      return
    }

    setFile(f)
    setReadProgress(0)
    const readOk = await new Promise<boolean>((resolve) => {
      const reader = new FileReader()
      reader.onprogress = (e) => {
        if (e.lengthComputable) setReadProgress(Math.round((e.loaded / e.total) * 100))
      }
      reader.onload = () => {
        setReadProgress(100)
        resolve(true)
      }
      reader.onerror = () => {
        setUploadError('Could not read the selected file.')
        resolve(false)
      }
      reader.readAsArrayBuffer(f)
    })
    if (!readOk) return
    {
      const id = uid()
      setPhaseNote('Extracting text from PDF…')
      let stored = true
      try {
        await storeFile(id, f)
      } catch {
        stored = false
      }
      let content: ExtractedContent | null = null
      try {
        content = await extractFromPdf(f)
      } catch (e) {
        setExtractionError(e instanceof Error ? e.message : 'Text extraction failed. You can still enter details manually.')
        content = emptyExtracted()
        content.extractionWarnings.push('Automated extraction failed — enter the manuscript details manually.')
      }
      if (!stored) {
        content.extractionWarnings.push('The PDF file itself could not be stored — analysis will still run from the extracted text, but the original file will not be available for download.')
      }
      setProjectId(id)
      setExtracted(content)
      setPrefs({ ...DEFAULT_PREFERENCES, ...data.defaultPreferences })
      await update((ws) => logActivity({ ...ws, projects: [newProject(id, f, content, stored), ...ws.projects] }, 'project', `Uploaded "${f.name}" (${formatBytes(f.size)}).`, id))
      setPhaseNote('')
      setStep('review')
      window.scrollTo({ top: 0 })
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    setDrag(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  async function analyze(e: FormEvent) {
    e.preventDefault()
    if (!data || !projectId || !extracted || !prefs) return
    setStep('analyze')
    setPhaseNote('Running analysis…')

    const current = data.projects.find((p) => p.id === projectId)
    if (!current) return
    const base: ManuscriptProject = { ...current, edited: extracted, preferences: prefs, status: 'extracting', updatedAt: new Date().toISOString() }
    await update((ws) => ({ ...ws, projects: ws.projects.map((p) => (p.id === projectId ? base : p)) }))

    try {
      const result = await runAnalysis(base, prefs, (status) => {
        setPhaseNote(
          status === 'matching' ? 'Querying OpenAlex and Crossref…' : status === 'generating' ? 'Ranking and assigning fit tiers…' : 'Done'
        )
        void update((ws) => ({
          ...ws,
          projects: ws.projects.map((p) => (p.id === projectId ? { ...p, status, updatedAt: new Date().toISOString() } : p))
        }))
      })
      await update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => (p.id === projectId ? result : p))
      }))
      log('analysis', `Analysis completed for "${result.name}" — ${result.analysis?.matches.length ?? 0} recommendations.`, projectId)
      go({ name: 'project', id: projectId })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Analysis failed'
      await update((ws) => ({
        ...ws,
        projects: ws.projects.map((p) => (p.id === projectId ? { ...p, status: 'failed', error: msg } : p))
      }))
      log('analysis', `Analysis failed for "${current.name}": ${msg}`, projectId)
      go({ name: 'project', id: projectId })
    }
  }

  const stages: Record<Step, 'active' | 'done' | 'idle'> = {
    upload: step === 'upload' ? 'active' : 'done',
    review: step === 'review' ? 'active' : step === 'upload' ? 'idle' : 'done',
    constraints: step === 'constraints' ? 'active' : step === 'review' ? 'idle' : 'done',
    analyze: step === 'analyze' ? 'active' : step === 'constraints' ? 'idle' : 'idle'
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 className="ws-h1">Analyze a manuscript</h1>
      <p className="ws-sub">
        Upload a text-based PDF. PubRooter extracts the details on this device, lets you correct them, applies your
        constraints, and runs a live analysis against OpenAlex and Crossref.
      </p>

      <div className="ws-steps" aria-label="Progress">
        {STEP_LABELS.map((s) => (
          <span key={s.key} className={`ws-step ${stages[s.key] === 'active' ? 'active' : stages[s.key] === 'done' ? 'done' : ''}`}>
            <i>{stages[s.key] === 'done' ? '✓' : ''}</i>
            {s.label}
          </span>
        ))}
      </div>

      {step === 'upload' && (
        <>
          <div
            className={`ws-drop ${drag ? 'drag' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={drop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
            }}
            aria-label="Upload manuscript PDF"
          >
            <strong>Drop your manuscript PDF here</strong>
            <p>or click to choose a file — PDF only, up to {formatBytes(MAX_UPLOAD_BYTES)}</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </div>

          {file && (
            <div className="ws-file-row">
              <span>
                <strong>{file.name}</strong>
                <span className="meta"> · {formatBytes(file.size)}</span>
                {readProgress > 0 && readProgress < 100 && <span className="meta"> · reading {readProgress}%</span>}
              </span>
              <button type="button" className="ws-btn ws-btn-ghost" onClick={() => { setFile(null); setReadProgress(0); setUploadError('') }}>
                Remove
              </button>
            </div>
          )}

          {uploadError && <p role="alert" className="ws-error-box" style={{ marginTop: '0.85rem' }}>{uploadError}</p>}
          {phaseNote && <p className="ws-notice" style={{ marginTop: '0.85rem' }} role="status">{phaseNote}</p>}
          {extractionError && <p className="ws-notice" style={{ marginTop: '0.85rem' }}>{extractionError}</p>}

          <p className="ws-hint" style={{ marginTop: '1rem' }}>
            Files are stored privately (in this browser, or in your Colabwize storage bucket when cloud mode is on) for the current workspace and are only readable by
            you. Nothing is uploaded to a server. Valid PDFs are verified by their actual header bytes, not just the
            filename. Scanned or image-only PDFs cannot be read — you will be able to type the details manually.
          </p>
        </>
      )}

      {(step === 'review' || step === 'constraints') && extracted && (
        <form onSubmit={(e) => (step === 'review' ? (e.preventDefault(), setStep('constraints'), void window.scrollTo({ top: 0 })) : analyze(e))}>
          {step === 'review' && (
            <div className="ws-card">
              <h2 className="ws-h2" style={{ marginTop: 0 }}>
                Review extracted information
                <span style={{ fontWeight: 400, fontSize: 12, color: '#666', marginLeft: 8 }}>edit anything wrong before matching</span>
              </h2>

              {extracted.extractionWarnings.length > 0 && (
                <div className="ws-notice">
                  {extracted.extractionWarnings.map((w) => (
                    <div key={w}>• {w}</div>
                  ))}
                </div>
              )}

              <label className="ws-field">
                <span className="ws-label">Title</span>
                <input value={extracted.title} onChange={(e) => setExtracted({ ...extracted, title: e.target.value })} required />
              </label>

              <label className="ws-field">
                <span className="ws-label">Abstract</span>
                <textarea rows={6} value={extracted.abstract} onChange={(e) => setExtracted({ ...extracted, abstract: e.target.value })} />
                <span className="ws-hint">{extracted.abstract.split(/\s+/).filter(Boolean).length} words extracted</span>
              </label>

              <label className="ws-field">
                <span className="ws-label">Keywords (comma-separated)</span>
                <input
                  value={extracted.keywords.join(', ')}
                  onChange={(e) =>
                    setExtracted({ ...extracted, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) })
                  }
                />
              </label>

              <div className="ws-grid-2">
                <label className="ws-field">
                  <span className="ws-label">Research field</span>
                  <input value={extracted.field} onChange={(e) => setExtracted({ ...extracted, field: e.target.value })} placeholder="e.g. Computer science" />
                </label>
                <label className="ws-field">
                  <span className="ws-label">Article type</span>
                  <input value={extracted.articleType} onChange={(e) => setExtracted({ ...extracted, articleType: e.target.value })} placeholder="e.g. Research article" />
                </label>
              </div>

              <div className="ws-grid-2">
                <label className="ws-field">
                  <span className="ws-label">Research objectives</span>
                  <textarea rows={3} value={extracted.objectives} onChange={(e) => setExtracted({ ...extracted, objectives: e.target.value })} />
                </label>
                <label className="ws-field">
                  <span className="ws-label">Methods</span>
                  <textarea rows={3} value={extracted.methods} onChange={(e) => setExtracted({ ...extracted, methods: e.target.value })} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setStep('upload')}>
                  ← Back to upload
                </button>
                <button type="submit" className="ws-btn ws-btn-primary">
                  Continue to constraints
                </button>
              </div>
            </div>
          )}

          {step === 'constraints' && prefs && (
            <div className="ws-card">
              <h2 className="ws-h2" style={{ marginTop: 0 }}>
                Research constraints <span style={{ fontWeight: 400, fontSize: 12, color: '#666' }}>optional — these are preferences, not verified facts</span>
              </h2>

              <div className="ws-grid-2">
                <label className="ws-field">
                  <span className="ws-label">Preferred subject area</span>
                  <input value={prefs.subjectArea} onChange={(e) => setPrefs({ ...prefs, subjectArea: e.target.value })} placeholder="e.g. Bioinformatics" />
                </label>
                <label className="ws-field">
                  <span className="ws-label">Preferred publisher</span>
                  <input value={prefs.preferredPublisher} onChange={(e) => setPrefs({ ...prefs, preferredPublisher: e.target.value })} placeholder="e.g. Elsevier, Springer Nature" />
                </label>
                <label className="ws-field">
                  <span className="ws-label">Maximum APC (US$)</span>
                  <input
                    type="number"
                    min={0}
                    value={prefs.apcMaxUsd ?? ''}
                    onChange={(e) => setPrefs({ ...prefs, apcMaxUsd: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="Leave empty for no cap"
                  />
                </label>
                <label className="ws-field">
                  <span className="ws-label">Article type</span>
                  <input value={prefs.articleType} onChange={(e) => setPrefs({ ...prefs, articleType: e.target.value })} placeholder="e.g. Original research" />
                </label>
              </div>

              <label className="ws-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={prefs.oaPreferred}
                  onChange={(e) => setPrefs({ ...prefs, oaPreferred: e.target.checked })}
                />
                <span className="ws-label" style={{ margin: 0 }}>Prefer open-access journals</span>
              </label>

              <label className="ws-field">
                <span className="ws-label">Indexing requirements (comma-separated)</span>
                <input
                  value={prefs.indexingRequired.join(', ')}
                  onChange={(e) => setPrefs({ ...prefs, indexingRequired: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="e.g. Scopus, MEDLINE"
                />
                <span className="ws-hint">
                  Stored as your requirement. Verification against indexing databases is not available from open
                  metadata — treat as a to-confirm list.
                </span>
              </label>

              <label className="ws-field">
                <span className="ws-label">Excluded journals (comma-separated titles)</span>
                <input
                  value={prefs.excludedJournals.join(', ')}
                  onChange={(e) => setPrefs({ ...prefs, excludedJournals: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="e.g. Journal of Negative Results"
                />
              </label>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="ws-btn ws-btn-ghost" onClick={() => setStep('review')}>
                  ← Back to review
                </button>
                <button type="submit" className="ws-btn ws-btn-primary">
                  Run analysis
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {step === 'analyze' && (
        <div className="ws-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h2 className="ws-h2" style={{ marginTop: 0 }}>Analyzing your manuscript</h2>
          <p style={{ fontSize: 13, color: '#666' }} role="status">
            {phaseNote || 'Working…'}
          </p>
          <div style={{ maxWidth: 420, margin: '1rem auto 0', height: 8, background: '#e6e6e6', borderRadius: 4, overflow: 'hidden' }}>
            <div className="ws-bar-anim" />
          </div>
        </div>
      )}
    </div>
  )
}
