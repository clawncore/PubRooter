# PubRooter Implementation Plan

## Overview

This document outlines the implementation strategy for PubRooter, a research-publication workflow SaaS focused on evidence-backed journal discovery and manuscript readiness checks.

The current phase of work is the **Publication Pipeline and Workspace Visibility Overhaul** — turning PubRooter from a journal-search tool into a research-publication workflow platform while keeping the existing engines (ranking, readiness, extraction) intact.

## Current State Assessment

The repository currently contains:
- `PubRooter_Master_Build_Specification.md` - Complete product specification
- `docs/WORKSPACE_AUDIT.md` - Phase 1 audit of actual functionality
- `src/` - Implemented React/TypeScript/Vite workspace
- `supabase/migrations/0001_workspace_schema.sql` - Cloud schema
- `tests/` - Vitest suite (76 tests, 9 files)

## Phase 1 — Foundation (P0 Implementation)

### Priority 1: Application Shell and User Interface

**Goal:** Create responsive, accessible application shell with clear landing/dashboard.

**Implementation Steps:**
1. Set up Vite/React/TypeScript application structure
2. Create landing page with value proposition
3. Build dashboard showing recent projects
4. Implement responsive design with mobile support
5. Add accessibility features (ARIA labels, keyboard navigation)

**Deliverables:**
- `src/pages/Home.tsx` - Landing page
- `src/pages/workspace/WorkspaceApp.tsx` - Workspace shell
- `src/pages/workspace/Overview.tsx` - Dashboard

### Priority 2: Manuscript Project Form

**Goal:** Full manuscript/project entry with required fields and validation.

**Implementation Steps:**
1. Create project form with title (required) and abstract (required for matching)
2. Add optional fields: keywords, research field, article type
3. Implement manuscript text paste functionality
4. Add DOCX upload validation (placeholder for P1)
5. Build project validation and error handling
6. Create project state management

### Priority 3: Journal Discovery and Matching

**Goal:** Journal discovery using available scholarly metadata with explainable results.

**Implementation Steps:**
1. Implement OpenAlex API client for journal metadata retrieval
2. Create Crossref API integration for additional journal data
3. Build journal normalization and deduplication logic
4. Implement explainable matching algorithm
5. Create results display with rationale and evidence links
6. Keep scoring deterministic and reproducible — no model-generated scores

### Priority 4: Journal Details and Requirements

**Goal:** Journal detail view with structured readiness checklist.

**Implementation Steps:**
1. Create journal detail page with metadata display
2. Implement structured requirements checklist
3. Build requirement validation logic
4. Add "not checked" state for missing requirements
5. Display evidence and source links
6. Create requirement filtering and search

### Priority 5: Project Persistence

**Goal:** Save and reopen projects using maintainable database approach.

**Implementation Steps:**
1. Set up PostgreSQL database with proper schema
2. Implement project CRUD operations
3. Add project-journal match persistence
4. Build project reopening functionality
5. Create data migration strategy

## Phase 2 — Publication Pipeline and Workspace Visibility Overhaul

### Phase 2 — Workspace Visibility Redesign

**Goal:** Redesign visible workspace navigation with clear workflow destinations.

**Deliverables:**
- Overview answering: what manuscripts, which analyses complete, which journal next, which need attention, which submissions in progress, next action
- My Manuscripts
- Find Journals
- Readiness Checks
- Publication Pipeline (new)
- Saved Journals
- Exports & Reports
- Settings

### Phase 3 — Publication Pipeline

**Goal:** Dedicated view + persistent workflow model with 16 stages.

**Implementation Steps:**
1. Add submission attempt type + transitions (`src/workspace/submissions.ts`)
2. Add `submissions` array to `ManuscriptProject` (`src/workspace/types.ts`)
3. Add Publication Pipeline view + nav entry
4. Add "Choose as target journal" action from recommendations → create draft attempt
5. Add submission preparation screen (official instructions, required docs, package check, official portal action)
6. Add rejection / revision handling
7. Add exports: submission package manifest

### Phase 4 — Exports & Reports First-Class

**Goal:** Dedicated Exports & Reports page with per-attempt exports and working downloads.

**Implementation Steps:**
1. Add submission package manifest builder
2. Wire CSV validity / printable reports / PDF via browser
3. Add missing-data handling (disable exports needing missing data with explanation)
4. Add sanitized filenames

### Phase 5 — Rejection / Revision

**Goal:** Revision requested / rejected / accepted / published flows with history retention.

**Implementation Steps:**
1. Record decision dates / notes
2. Track reviewer comments + responses
3. Attach revised manuscript versions
4. Preserve previous attempts

### Phase 6 — Manuscript Detail Control Center

**Goal:** Visible summary + clear links + next useful action derived from actual state.

### Phase 7 — Data Model / Persistence

**Goal:** Submission-attempt and revision-history records without breaking existing projects.

**Implementation Steps:**
1. Extend types + state mgmt + DB schema + cloud persistence
2. Versioned transforms / migrations
3. Authorization on every new cloud op
4. Local vault compatibility

### Phase 8 — Visual Quality

**Goal:** Clear persistent sidebar, readable workflow board/table, compact status badges with text labels, responsive tables, accessible forms, real empty states.

### Phase 9 — Testing / Evidence

**Goal:** Tests for pipeline stage transitions, attempts, persistence, rejection-to-resubmission, revision tracking, submission confirmation, CSV validity, report download, missing-data handling, cloud authorization, local-vault persistence, file access/deletion, new nav routes and critical actions.

### Phase 10 — Final acceptance criteria

- Publication Pipeline visible nav destination
- Users can select target journal and prepare submission attempt
- Attempts + histories persist
- Researchers can record external submission details without false claims of direct submission
- Rejection/revision paths supported
- Exports & Reports visible and offers working downloads
- Existing journal discovery/PDF extraction/readiness/saved journals/auth/persistence continue to work
- All new controls functional
- Tests and build results reported accurately

## Technical Architecture Decisions

### Database Strategy
- PostgreSQL for production (with SQLite fallback)
- Incremental migrations with rollback capability

### API Integration
- OpenAlex, Crossref, Europe PMC, DOAJ
- All APIs with rate limiting and error handling

### Matching Algorithm
- Deterministic token-overlap scoring (no embeddings, no model calls)
- Explainable scoring with clear rationale
- Deterministic results for reproducibility

### State Management
- React context for application state
- Local storage fallback for offline functionality
- API integration for cloud sync

## Timeline and Milestones

### Week 1: Foundation
- Application shell and landing page
- Project form and basic validation
- Database schema setup

### Week 2: Core Discovery
- OpenAlex and Crossref API integration
- Basic journal matching
- Journal detail view

### Week 3: Matching Engine
- Ranking engine implementation (`pubrooter-rank-v1`)
- Explainable results display
- Requirement extraction from APIs

### Week 4: Persistence and Testing
- Full project persistence
- Comprehensive testing suite
- Documentation completion
- Final integration testing

## Success Criteria

### Technical Requirements
- [x] Application launches locally on port 3000
- [x] User can create a manuscript project with title and abstract
- [x] Journal candidates come from OpenAlex (demonstrates working provider)
- [x] Results explain matching with source links and rationale
- [x] Readiness checklist shows missing requirements explicitly
- [x] Projects can be saved and reopened
- [x] Tests cover core matching and validation logic
- [x] Documentation distinguishes implemented vs. planned features

### User Experience Requirements
- [x] Clear manuscript entry form with validation
- [x] Responsive design that works on mobile
- [x] Explainable journal matching (no black box)
- [x] Evidence-backed recommendations
- [x] Accessible UI with keyboard navigation
- [x] Clear loading and error states

## Risk Mitigation

### High Priority Risks
1. **API Availability**: Implement fallback mechanisms and clearly label demo data when APIs are unavailable
2. **Database Migration**: Use incremental migrations with rollback capability
3. **Performance**: Implement caching and pagination for large result sets
4. **Data Quality**: Store provenance and allow manual review of data

### Medium Priority Risks
1. **Matching**: Keep scoring deterministic — no external AI dependency to fail
2. **User Adoption**: Clear onboarding and documentation
3. **Scaling**: Start with modular monolith, plan for microservices later

## Next Steps

1. Create `IMPLEMENTATION_PLAN.md` ✅ (Completed)
2. Initialize project structure and package.json files
3. Set up development environment
4. Begin Week 1 implementation tasks
5. Establish CI/CD pipeline
6. Create demo mode for API unavailability scenarios

## Dependencies and Technologies

### Core Technologies
- React 18+ with TypeScript
- Node.js 18+ with Vite
- PostgreSQL with Prisma ORM
- Tailwind CSS for styling
- Zod for schema validation
- React Query for data fetching

### External APIs
- OpenAlex (https://openalex.org/)
- Crossref (https://www.crossref.org/)
- Europe PMC (https://europepmc.org/)
- DOAJ (https://doaj.org/)

### Development Tools
- Jest for testing
- ESLint and Prettier
- Husky for pre-commit hooks
- Storybook for component documentation

## Monitoring and Observability

- Error tracking with Sentry
- Performance monitoring with Vercel Analytics
- Structured logging for debugging
- Health checks for external APIs

This implementation plan provides a clear roadmap for building PubRooter's Phase 1 — Foundation. It focuses on delivering a working MVP that addresses the core product promise while establishing the architectural foundation for future phases.
