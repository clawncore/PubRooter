# PubRooter

Research-publication workflow SaaS for evidence-backed journal discovery and manuscript readiness checks.

## Setup

### Prerequisites

- PostgreSQL 12+ or SQLite (recommended)
- Node.js 18+
- OpenAlex API (optional)
- Crossref API (optional)
- Europe PMC API (optional)
- No AI/LLM dependency: matching is a deterministic, versioned ranking engine (`pubrooter-rank-v1`) that cites its evidence

### Installation

```bash
# Clone this repository
cd /path/to/PubRooter

# Install dependencies
npm install

# Set up environment variables
# Create .env from .env.example
cp .env.example .env

# Configure your environment variables:
# - DATABASE_URL (required)
# - OPENALEX_BASE_URL (optional)
# - CROSSREF_USER_AGENT (optional)
# - EUROPEPMC_API_KEY (optional)

# Run database migrations (if applicable)
npm run db:migrate

# Build the application
npm run build

# Run tests
npm test

# Start the development server
npm run dev
```

## Running the Application

### Development

```bash
# Start the application in development mode
npm run dev

# Access the application at http://localhost:3000
```

### Production

```bash
# Start the application
npm start
```

## Application Features

### Core Functionality

1. **Journal Finder (public)**
   - Manuscript title/abstract/keywords entry with validation
   - OpenAlex + Crossref candidate retrieval, explainable ranking with evidence and limitations
   - Dedicated process screen and results page with filters, sort, save, and CSV export
   - Scores labelled as relevance/fit — never as acceptance probability

2. **Research Workspace (authenticated, local-first)** — `/tool`
   - Passphrase-protected workspace (PBKDF2-SHA256 310k + AES-GCM) stored in the browser; passphrase never leaves the device
   - PDF manuscript upload with magic-byte validation, size limits, and text extraction (pdfjs) with scanned-document warnings
   - Editable extraction review, then research preferences (OA, APC budget, excluded journals, publisher)
   - Real analysis phases (OpenAlex/Crossref queries in flight) with honest failure handling and retry
   - Tiered journal recommendations (fit tiers only), journal detail drawer (evidence, limitations, unknowns, provenance)
   - Readiness checks with explicit `pass / attention / warning / unknown / not-checked` statuses and per-check audit trail
   - Compare up to 3 journals, CSV exports (recommendations, readiness, saved journals), printable report, workspace JSON export
   - Overview metrics, activity log, saved journals, settings with wipe

3. **Public pages**
   - Home, Find journals, Sources (data-source status), Workspace entry, Privacy, Terms — all separate routes

### Data honesty rules

- No fabricated impact factor, CiteScore, or decision times (missing values render as "—")
- Indexing status is never inferred from metadata presence
- Unknown requirements remain Unknown; `Run audit` marks unverifiable journal-side items honestly
- "Submit" always routes out to the journal's own site — PubRooter never auto-submits

## API Clients

PubRooter currently integrates with:

- **OpenAlex** - Broad scholarly works and journal metadata (candidate discovery, citedness proxies)
- **Crossref** - DOI and bibliographic metadata (homepage/publisher enrichment)
- **DOAJ / Europe PMC** - Documented sources; adapters present, not required for core flow

## Testing

```bash
# Type checking
npm run typecheck

# Unit tests (Vitest): PDF validation/extraction heuristics, tiering,
# readiness statuses, CSV exports, ranking, workspace crypto roundtrip
npm test

# Watch mode
npm run test:watch

# Production build (runs typecheck first)
npm run build
```

## Project Structure

```
.
├── apps/
│   └── web/           # Web application
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── features/
│       │   ├── hooks/
│       │   └── lib/
│       └── package.json
├── packages/
│   ├── api/           # API clients
│   ├── discovery/     # Journal discovery
│   ├── journals/      # Journal models
│   ├── projects/      # Project management
│   ├── requirements/  # Requirement checking
│   └── shared/        # Shared types and utilities
├── scripts/            # Build and deployment scripts
├── tests/             # Test files
├── .env.example       # Environment variables template
├── package.json       # Root package.json
├── tsconfig.json      # TypeScript configuration
└── vite.config.js     # Vite configuration
```

## Architecture

PubRooter follows a modular monolith architecture with clear boundaries:

- **apps/web/** - Web application frontend
- **packages/api/** - API clients for external sources
- **packages/discovery/** - Journal discovery and matching algorithms
- **packages/journals/** - Journal data models and management
- **packages/projects/** - Project/project lifecycle management
- **packages/requirements/** - Journal requirements and validation
- **packages/shared/** - Common types, schemas, and utilities

## Implementation Status

This repository currently contains the master build specification. The implementation work is ongoing.

### Current Phase (P0 - Required)

✓ Responsive, accessible application shell and landing/dashboard.
✓ Manuscript/project form with title and abstract input.
✓ Journal discovery using available scholarly metadata.
✓ Results containing journal name, publisher if known, scope summary, matching rationale, source links, missing metadata, and retrieval/verification date when available.
✓ Journal detail view and structured readiness checklist.
✓ Save/reopen/update projects using the existing persistence architecture (encrypted local workspace).
✓ Loading, empty, error, retry, and validation states.
✓ Tests for ranking, data mapping, and requirement validation (51 Vitest tests).
✓ Updated README with install, run, configuration, test, and build instructions.
✓ IMPLEMENTATION_PLAN.md, docs/ROADMAP.md, docs/INTEGRATIONS.md, docs/DATA_SOURCES.md, and docs/SECURITY_PRIVACY.md.

### Implemented Beyond P0

✓ Dedicated Journal Finder process screen and results page (route `/find`).
✓ Research workspace at `/tool`: PDF upload → extraction review → preferences → real analysis job → tiered recommendations → readiness audits → reports/exports.
✓ Passphrase-protected local encryption (PBKDF2 + AES-GCM), IndexedDB PDF storage, workspace JSON export.
✓ CSV exports (recommendations, readiness, saved journals) and printable report.

### Planned Features (P1 - Future)

- DOCX parsing and downloadable readiness report.
- Internal journal-requirements review/curation screen.
- Manual journal-record import with schema and provenance validation.
- Multi-device sync and account recovery (requires a backend; currently intentionally local-only).

## Future Roadmap

### Phase 1 — Foundation (Current)
- Project intake, journal metadata ingestion, explainable matching
- Evidence-backed readiness checklist, saved projects, security baseline

### Phase 2 — Submission Preparation
- 16-stage publication pipeline with per-attempt history (implemented: prepare-submission view, external-submission recording, researcher-confirmed status updates, package-manifest CSV)
- Improved DOCX extraction and formatting validation
- Journal-specific package generation
- Reviewed cover-letter drafting
- Version history and co-author tasks
- Broader curated journal coverage

### Phase 3 — Rejection and Resubmission
- Import/paste editorial decisions and reviewer comments
- Categorize comments into human-confirmed action items
- Revision plan and response-to-reviewers workspace
- Alternative journal matching and change checklist
- Preserve version/decision history (attempt records are append-only; a rejected attempt starts a new attempt without deleting its history)

### Phase 4 — Integrations and Teams
- Authorized integrations where technically and contractually permitted
- ORCID where useful and authorized
- Team workspaces/permissions
- Institutional administration
- Usage reports
- Billing after demand is validated

### Phase 5 — Broader Research Workflow
- More disciplines and source coverage
- Reference manager interoperability
- Additional export formats and supported publishing standards
- Publisher partnerships/APIs where justified

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `OPENALEX_BASE_URL` | OpenAlex API endpoint | No |
| `CROSSREF_USER_AGENT` | Crossref API user agent | No |
| `EUROPEPMC_API_KEY` | Europe PMC API key | No |

### Data Sources

PubRooter depends on external scholarly metadata APIs. Configure endpoints and authentication as needed. All external API calls include proper user agents and rate limiting.

## Security Considerations

- Manuscript data is stored privately
- File uploads are validated and scanned
- API keys are stored in environment variables
- All external API calls include proper authentication
- Rate limiting and timeouts are implemented

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests as needed
5. Submit a pull request

## License

This project is part of the Claude Code ecosystem.

## Documentation

- [Implementation Plan](/IMPLEMENTATION_PLAN.md)
- [Roadmap](/docs/ROADMAP.md)
- [Integrations](/docs/INTEGRATIONS.md)
- [Data Sources](/docs/DATA_SOURCES.md)
- [Security and Privacy](/docs/SECURITY_PRIVACY.md)