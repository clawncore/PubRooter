# PubRooter

Research-publication workflow platform: from manuscript to evidence-backed journal submission. Journal discovery, readiness checks, submission package preparation, post-submission tracking, and one-click rerouting after a rejection.

- **This repository**: the frontend application (React + Vite + TypeScript) plus its Supabase schema.
- **Documentation repository**: [github.com/clawncore/PubRooter-docs](https://github.com/clawncore/PubRooter-docs)
- **Backend**: there is no custom backend service yet. Persistence is either Supabase (shared Colabwize project, optional) or local-only passphrase-encrypted browser storage. A dedicated backend will live in its own repository when server-side features are scheduled.

## Setup

### Prerequisites

- Node.js 18+
- (Optional) A Supabase project for cloud mode - without it PubRooter runs in local-only passphrase mode
- OpenAlex / Crossref public APIs (no keys required)
- No AI/LLM dependency: matching is a deterministic, versioned ranking engine (`pubrooter-rank-v3`) that cites its evidence

### Installation

```bash
git clone https://github.com/clawncore/PubRooter.git
cd PubRooter
npm install
cp .env.example .env   # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY for cloud mode
npm run dev            # http://localhost:3000
```

### Cloud mode (optional)

Apply `supabase/setup.sql` once in the Supabase SQL editor (or the numbered files in `supabase/migrations/`). This creates the `pubrooter_*` tables with row-level security. Until the schema is applied, the app still works and keeps data in browser storage.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server (port 3000) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite (100 tests) |
| `npm run test:watch` | Vitest watch mode |

## Application Features

1. **Journal Finder (public, `/find`)**
   - Manuscript title/abstract/keywords entry with validation
   - OpenAlex + Crossref candidate retrieval, explainable ranking with evidence and limitations
   - Deterministic results: identical queries produce identical rankings (total ordering + query-keyed cache)
   - Results page with filters, sort, save, and CSV export; scores labelled as relevance/fit, never acceptance probability

2. **Research Workspace (authenticated, `/tool`)**
   - Local mode: passphrase-protected workspace (PBKDF2-SHA256 + AES-GCM) stored in the browser; passphrase never leaves the device
   - Cloud mode: Supabase auth (shared with Colabwize) and synced `pubrooter_*` rows
   - PDF upload with magic-byte validation, extraction review, preferences, live analysis phases
   - Tiered journal recommendations (fit tiers only), journal drawer with evidence/limitations/provenance
   - Readiness checks with explicit `pass / attention / warning / unknown / not-checked` statuses and audit trail
   - Compare up to 3 journals, CSV exports, printable report, workspace JSON export

3. **Journal portal (per-journal preparation)**
   - Journal-specific requirements, document staging (upload or mark ready), real-bytes previews (PDF/DOCX/manuscript)
   - Package preparation with final document checks, readiness summary, ZIP export
   - **Mark as submitted**: user-confirmed recording that appends an event; PubRooter never auto-submits to any publisher

4. **Publications tracker + rerouting**
   - One row per submission attempt with status badge, stage, and next action
   - Expandable **Track** panel: full event history timeline + status recorder (strict state machine; terminal statuses close the attempt, history is never overwritten)
   - Summary strip: tracked / submitted / in review / decided / rerouted / acceptance rate / published
   - **Reroute to another journal** after a rejection or withdrawal: pick a ranked, not-yet-attempted journal; a new linked attempt is created with the reason in its history, a fresh readiness audit runs, and the portal opens for the new journal with documents carried over

5. **Public pages** - Home, Find journals, Sources, Workspace entry, Privacy, Terms

### Data honesty rules

- No fabricated impact factor, CiteScore, or decision times (missing values render as unknown)
- Indexing status is never inferred from metadata presence
- Unknown requirements remain Unknown; audits mark unverifiable journal-side items honestly
- "Submit" always routes out to the journal's own site - PubRooter never auto-submits
- Every ranking cites its sources; no LLM generates scores

## API Clients

- **OpenAlex** - scholarly works and journal metadata (candidate discovery, citedness proxies)
- **Crossref** - DOI and bibliographic metadata (homepage/publisher enrichment)
- **DOAJ / Europe PMC** - documented sources; adapters present, not required for core flow

## Testing

```bash
npm run typecheck   # strict TypeScript
npm test            # Vitest: ranking, tiers, readiness, submission state machine,
                    # reroute, match cache, crypto roundtrip, PDF, reports
npm run build       # typecheck + production build (gate before shipping)
```

## Project Structure

```
.
├── src/
│   ├── App.tsx               # routes + portal/compare views
│   ├── api/                  # OpenAlex / Crossref / sources clients
│   ├── components/           # shared UI (SiteChrome, JournalCover)
│   ├── lib/                  # auth, supabase client, matching engine, match cache, logging
│   ├── pages/                # Home, Finder, JournalPortal, ComparePortal, ...
│   │   └── workspace/        # WorkspaceApp, Overview, ManuscriptDetail,
│   │                         # PipelineView (Publications), ReadinessDetail,
│   │                         # ReroutePanel, Settings, ...
│   └── workspace/            # domain core: types, WorkspaceContext, cloud,
│                             # crypto, storage, submissions, reroute, readiness,
│                             # pipeline, package-checks, pdf, zip, reports, ...
├── public/                   # static assets + journal logos (public/journals/)
├── supabase/
│   ├── setup.sql             # idempotent full schema (apply in SQL editor)
│   └── migrations/           # 0001 workspace, 0002 attempts, 0003 reroute link
├── tests/                    # Vitest unit tests (100 tests)
├── index.html, vite.config.js, tsconfig.json, vitest.config.ts
└── .env.example              # environment template
```

## Architecture (summary)

Frontend-only modular app. The domain core (`src/workspace/`) is UI-free and unit-tested; pages render it through `WorkspaceContext`, which persists to Supabase (cloud) or encrypted browser storage (local). Matching, readiness, and the submission state machine are deterministic and versioned. Full details: [ARCHITECTURE.md](https://github.com/clawncore/PubRooter-docs/blob/main/ARCHITECTURE.md).

## Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | No | Supabase URL (empty = local-only mode) |
| `VITE_SUPABASE_ANON_KEY` | No | Supabase anon key |
| `VITE_COLABWIZE_URL` | No | Colabwize base URL for SSO handoff |
| `VITE_MAX_UPLOAD_MB` | No | PDF upload cap (default 25) |
| `OPENALEX_BASE_URL` | No | Defaults to `https://api.openalex.org` |
| `CROSSREF_USER_AGENT` | No | Politeness identifier for Crossref |

## Status

Implemented today: finder, workspace, readiness, journal portal, package preparation, submission recording, publications tracker, rerouting, cloud/local persistence, full test gates. Pending: apply Supabase schema for cross-session attempt persistence, decision-letter import, teams. See [STATUS.md](https://github.com/clawncore/PubRooter-docs/blob/main/STATUS.md).

## Documentation

All documentation lives in the companion repository:

- [Getting Started](https://github.com/clawncore/PubRooter-docs/blob/main/GETTING_STARTED.md)
- [Architecture](https://github.com/clawncore/PubRooter-docs/blob/main/ARCHITECTURE.md)
- [Features](https://github.com/clawncore/PubRooter-docs/blob/main/FEATURES.md)
- [Status](https://github.com/clawncore/PubRooter-docs/blob/main/STATUS.md)
- [Roadmap](https://github.com/clawncore/PubRooter-docs/blob/main/docs/ROADMAP.md)
- [Security & Privacy](https://github.com/clawncore/PubRooter-docs/blob/main/docs/SECURITY_PRIVACY.md)
- [Implementation Plan](https://github.com/clawncore/PubRooter-docs/blob/main/IMPLEMENTATION_PLAN.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Run `npm run typecheck && npm test && npm run build`
5. Submit a pull request

## License

This project is part of the Claude Code ecosystem.
