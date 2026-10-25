import { useState, useEffect } from 'react'
import { useWorkspace } from '../workspace/WorkspaceContext'
import type { ManuscriptProject, JournalCandidate } from '../types'
import type { JournalPortal as JournalPortalType, JournalSpecificRequirements } from '../workspace/journal-scraper'
import { journalScraper } from '../workspace/journal-scraper'
import { getJournalRequirements } from '../workspace/submissions'
import { runReadiness } from '../workspace/readiness'
import { createDraftAttempt } from '../workspace/submissions'

interface JournalPortalProps {
  project: ManuscriptProject
  selectedJournal: JournalCandidate
  onNavigate: (view: string, draft?: any) => void
}

export function JournalPortal({ project, selectedJournal, onNavigate }: JournalPortalProps) {
  const { update } = useWorkspace()
  const [portalData, setPortalData] = useState<JournalPortalType | null>(null)
  const [requirements, setRequirements] = useState<JournalSpecificRequirements | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('guidelines')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load portal data and requirements
  useEffect(() => {
    const loadPortalData = async () => {
      try {
        setIsLoading(true)
        // Scrape journal-specific requirements
        const portal = await journalScraper.scrapeJournalRequirements(selectedJournal)
        setPortalData(portal)

        // Get standard readiness requirements
        const stdReqs = getJournalRequirements(selectedJournal)
        setRequirements(portal.portalData.requirements)

      } catch (error) {
        console.error('Failed to load portal data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPortalData()
  }, [selectedJournal])

  // Prepare for submission
  const handlePrepareForSubmission = async () => {
    try {
      setIsSubmitting(true)

      if (!project.selectedJournalId) {
        throw new Error('No journal selected')
      }

      // Create submission attempt
      const attempt = createDraftAttempt(project, selectedJournal, project.submissions.length + 1)

      // Update project with new submission
      await update((ws) => {
        const updatedProject = { ...ws.projects.find(p => p.id === project.id) }
        if (updatedProject) {
          updatedProject.submissions = [...updatedProject.submissions, attempt]
          updatedProject.selectedJournalId = selectedJournal.id
          updatedProject.actionsCompleted = [...updatedProject.actionsCompleted, 'submission_prepared']
        }
        return {
          ...ws,
          projects: ws.projects.map(p => p.id === project.id ? updatedProject : p)
        }
      })

      // Navigate back to workspace
      onNavigate('tool')

    } catch (error) {
      console.error('Failed to prepare submission:', error)
    } finally {
      setIsSubmitting(false)
    }
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

    return docs
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

  const readyDocs = getReadyDocuments()
  const missingDocs = getReadyDocuments().missingDocs

  return (
    <div className="journal-portal">
      {/* Journal Header */}
      <div className="journal-header">
        <div className="journal-branding">
          <div className="journal-logo">
            <img
              src={portalData?.portalData.name ? `https://via.placeholder.com/150x50?text=${encodeURIComponent(portalData.portalData.name)}` : '/placeholder-journal.png'}
              alt={`${selectedJournal.title} logo`}
            />
          </div>
          <div className="journal-info">
            <h1>{selectedJournal.title}</h1>
            <p className="journal-publisher">{selectedJournal.publisher}</p>
            <p className="journal-description">{portalData?.portalData.description}</p>
            <div className="journal-meta">
              <span className="issn">{selectedJournal.issn || 'N/A'}</span>
              <span className="oa-badge">{
                selectedJournal.isOpenAccess ? 'Open Access' : 'Subscription'
              }</span>
              <span className="source-badge">{selectedJournal.source}</span>
            </div>
          </div>
        </div>
        <div className="portal-actions">
          <button
            onClick={() => window.open(selectedJournal.homepageUrl, '_blank')}
            className="btn-secondary"
          >
            Visit Journal Website
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="portal-tabs">
        <button
          className={`tab ${activeTab === 'guidelines' ? 'active' : ''}`}
          onClick={() => setActiveTab('guidelines')}
        >
          Submission Guidelines
        </button>
        <button
          className={`tab ${activeTab === 'requirements' ? 'active' : ''}`}
          onClick={() => setActiveTab('requirements')}
        >
          Requirements
        </button>
        <button
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline & Process
        </button>
        <button
          className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Required Documents ({missingDocs.length} missing)
        </button>
        <button
          className={`tab ${activeTab === 'faqs' ? 'active' : ''}`}
          onClick={() => setActiveTab('faqs')}
        >
          FAQs
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'guidelines' && (
          <div className="guidelines-section">
            <h3>Submission Guidelines</h3>
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
          </div>
        )}

        {activeTab === 'requirements' && requirements && (
          <div className="requirements-section">
            <h3>Journal-Specific Requirements</h3>

            <div className="requirement-category">
              <h4>📝 Manuscript Requirements</h4>
              <div className="requirement-grid">
                <div className="requirement-item">
                  <strong>Word Count:</strong> {requirements.manuscript.wordCount?.min || 'N/A'} - {requirements.manuscript.wordCount?.max || 'N/A'} words
                </div>
                <div className="requirement-item">
                  <strong>Pages:</strong> {requirements.manuscript.minPages || 'N/A'} - {requirements.manuscript.maxPages || 'N/A'} pages
                </div>
                <div className="requirement-item">
                  <strong>Sections Required:</strong> {requirements.manuscript.sections.filter(s => s.required).map(s => s.title).join(', ')}
                </div>
                <div className="requirement-item">
                  <strong>Abstract:</strong> {requirements.content.abstract.required ? 'Required' : 'Optional'}
                  {requirements.content.abstract.wordLimit && ` (${requirements.content.abstract.wordLimit} words max)`}
                </div>
              </div>
            </div>

            <div className="requirement-category">
              <h4>📋 Content Requirements</h4>
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
            </div>

            <div className="requirement-category">
              <h4>🎨 Formatting Requirements</h4>
              <div className="requirement-grid">
                <div className="requirement-item">
                  <strong>Citation Style:</strong> {requirements.formatting.citationStyle}
                </div>
                <div className="requirement-item">
                  <strong>Reference Format:</strong> {requirements.formatting.references.format}
                </div>
                <div className="requirement-item">
                  <strong>File Formats:</strong> {requirements.formatting.figures[0]?.formats.join(', ') || 'Verify on site'}
                </div>
                <div className="requirement-item">
                  <strong>Max File Size:</strong> {requirements.technical.fileSize?.maxSize}{requirements.technical.fileSize?.unit || ' MB'}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="timeline-section">
            <h3>Submission Timeline & Process</h3>
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
        )}

        {activeTab === 'documents' && (
          <div className="documents-section">
            <h3>Required Documents</h3>

            <div className="documents-summary">
              <div className="doc-stats">
                <span className="ready-count">{readyDocs.length} ready</span>
                <span className="missing-count">{missingDocs.length} missing</span>
                <span className="unknown-count">{missingDocs.filter(d => d.status === 'unknown').length} unknown</span>
              </div>
            </div>

            {readyDocs.length > 0 && (
              <div className="documents-group">
                <h4>✅ Ready Documents</h4>
                {readyDocs.map(doc => (
                  <div key={doc.id} className="document-item ready">
                    <div className="doc-status">
                      <span className="status-icon">✓</span>
                    </div>
                    <div className="doc-info">
                      <h5>{doc.label}</h5>
                      <p className="doc-note">{doc.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {missingDocs.length > 0 && (
              <div className="documents-group">
                <h4>⚠️ Missing/Unknown Documents</h4>
                {missingDocs.map(doc => (
                  <div key={doc.id} className="document-item">
                    <div className="doc-status">
                      <span className="status-icon">?</span>
                    </div>
                    <div className="doc-info">
                      <h5>{doc.label} {doc.required && <span className="required-badge">Required</span>}</h5>
                      <p className="doc-note">{doc.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="faqs-section">
            <h3>Frequently Asked Questions</h3>
            {portalData?.portalData.faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <h4>{faq.question}</h4>
                <p>{faq.answer}</p>
                {faq.category && (
                  <span className="faq-category">{faq.category}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portal Footer */}
      <div className="portal-footer">
        <div className="portal-info">
          <p>Last updated: {portalData?.portalData.lastUpdated}</p>
          <p>Source reliability: {portalData?.portalData.sourceReliability}</p>
          <p>Requirements source: {requirements?.source}</p>
        </div>
        <div className="portal-actions">
          <button
            onClick={() => onNavigate('tool')}
            className="btn-secondary"
          >
            Back to Workspace
          </button>
          <button
            onClick={handlePrepareForSubmission}
            className="btn-primary"
            disabled={isSubmitting || missingDocs.length > 0}
          >
            {isSubmitting ? 'Preparing...' : 'Prepare for Submission'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default JournalPortal