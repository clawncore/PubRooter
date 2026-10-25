# PubRooter Roadmap

Research-publication workflow roadmap with prioritized features and implementation timeline.

## Overview

This roadmap outlines PubRooter's phased development approach, starting with Phase 1 — Foundation (current focus) and extending through Phase 5 — Broader Research Workflow. Each phase builds upon the previous one, creating a cohesive platform for researchers.

## Current Status

**Phase 1 — Foundation (In Progress)**
- Core application shell and user interface
- Manuscript/project intake and lifecycle management
- Journal metadata ingestion from scholarly sources
- Explainable journal matching with evidence-backed recommendations
- Structured readiness checklist for journal requirements
- Saved projects and project reopening functionality
- Security baseline and privacy controls

**Complete:** P0 requirements (all 11 required items implemented)

## Phase 1 — Foundation (Complete)

### 1.1 Application Shell and User Interface
**Status:** ✅ Complete

**Implemented:**
- Responsive, accessible application shell
- Landing page with product introduction
- Dashboard with project overview
- Navigation and user interface
- Mobile-responsive design
- Keyboard accessibility
- Clear visual hierarchy and information architecture

### 1.2 Manuscript/Project Form
**Status:** ✅ Complete

**Implemented:**
- Required fields: title, abstract
- Optional fields: keywords, research field, article type
- Manuscript text paste functionality
- DOCX upload validation (placeholder for P1)
- Form validation and error handling
- Project state management
- Save/cancel workflow

### 1.3 Journal Discovery
**Status:** ✅ Complete

**Implemented:**
- OpenAlex API client integration
- Crossref API integration for enhanced metadata
- Journal normalization and deduplication
- Explainable matching algorithm (deterministic token overlap, `pubrooter-rank-v1`)
- Results display with matching rationale
- Evidence-backed recommendations
- Source links and provenance tracking

### 1.4 Journal Details and Requirements
**Status:** ✅ Complete

**Implemented:**
- Journal detail view with comprehensive metadata
- Structured readiness checklist
- Requirement validation engine
- Missing requirements explicitly marked
- Evidence and source link display
- Requirement filtering and search
- Check status: pass/fail/warning/not_checked/unknown

### 1.5 Project Persistence
**Status:** ✅ Complete

**Implemented:**
- PostgreSQL database with complete schema
- Project CRUD operations
- Project-journal match persistence
- Project reopening and update functionality
- Data migration strategy
- Connection pooling and performance optimization

### 1.6 Testing Framework
**Status:** ✅ Complete

**Implemented:**
- Jest testing infrastructure
- React Testing Library for component testing
- Unit tests for core business logic
- Integration tests for API clients
- End-to-end tests for user workflows
- Test database setup
- Comprehensive test coverage

### 1.7 Documentation and Configuration
**Status:** ✅ Complete

**Implemented:**
- `.env.example` with all configuration variables
- Comprehensive README with setup instructions
- `docs/ROADMAP.md` (this document)
- `docs/INTEGRATIONS.md` with external API details
- `docs/DATA_SOURCES.md` with data strategy
- `docs/SECURITY_PRIVACY.md` with security controls
- `IMPLEMENTATION_PLAN.md` with detailed implementation plan

## Phase 2 — Submission Preparation (Planning)

### 2.1 Enhanced Manuscript Processing
- DOCX parsing and formatting validation
- Multiple file format support (PDF, DOCX, plain text)
- Manuscript content analysis for requirements
- Plagiarism checking integration (where legally permitted)

### 2.2 Journal-Specific Package Generation
- Automated cover letter generation
- Submission checklist compilation
- File format validation for each journal
- Metadata extraction for submission portals

### 2.3 Review and Curation
- Internal journal requirements review screen
- Manual journal record import with validation
- Evidence verification workflow
- Editorial board collaboration features

### 2.4 Enhanced Project Features
- Project activity history and timeline
- Co-author collaboration features
- Version control and change tracking
- Comment and annotation system

## Phase 3 — Rejection and Resubmission (Planning)

### 3.1 Decision Processing
- Editorial decision import from various formats
- Reviewer comment categorization and analysis
- Revision plan generation based on feedback
- Response-to-reviewers drafting assistance

### 3.2 Alternative Journal Matching
- Post-rejection journal suggestions
- Change history tracking
- Alternative submission path planning
- Impact assessment of journal changes

### 3.3 Workflow Management
- Rejection processing pipeline
- Revision workflow automation
- Resubmission tracking
- Decision history preservation

## Phase 4 — Integrations and Teams (Planning)

### 4.1 External Integrations
- Direct publisher portal integration (where authorized)
- ORCID integration for author identification
- Reference manager interoperability (Zotero, EndNote)
- Institutional repository integration

### 4.2 Team Features
- Team workspaces and permissions
- Project collaboration tools
- Role-based access control
- Usage analytics and reporting

### 4.3 Enterprise Features
- Institutional administration
- Billing and subscription management
- Advanced analytics and reporting
- Custom workflows for institutions

## Phase 5 — Broader Research Workflow (Planning)

### 5.1 Expanded Research Coverage
- Additional disciplines beyond biomedical sciences
- Integration with more scholarly databases
- Alternative citation metrics and impact indicators
- Research impact assessment tools

### 5.2 Advanced Features
- Automated literature review integration
- Research trend analysis and visualization
- Grant proposal integration

### 5.3 Platform Expansion
- Mobile application
- Desktop application
- API for external integrations
- Plugin architecture for extensions

## Technical Roadmap

### Current Architecture (Phase 1)
- **Frontend:** React 18 with TypeScript, Vite bundling
- **Backend:** Node.js with Express
- **Database:** PostgreSQL with Prisma ORM
- **API Clients:** OpenAlex, Crossref, Europe PMC, DOAJ
- **Matching Algorithm:** Deterministic token-overlap scoring with weighted, cited evidence (`pubrooter-rank-v1`)
- **State Management:** React Context API
- **Styling:** Tailwind CSS with component libraries
- **Testing:** Jest, React Testing Library, Cypress

### Future Architecture Enhancements
- **Microservices:** Service-oriented architecture for scalability
- **Caching:** Redis for performance optimization
- **Real-time Updates:** WebSockets for live collaboration
- **CI/CD:** Automated testing and deployment pipelines
- **Monitoring:** Analytics and error tracking

## Development Timeline

### Short-term (0-6 months)
- Complete Phase 1 implementation
- Gather user feedback and iterate
- Launch beta with basic features
- Establish user onboarding process

### Medium-term (6-18 months)
- Complete Phase 2 implementation
- Begin Phase 3 features
- Add mobile and desktop clients
- Expand team collaboration features

### Long-term (18-36 months)
- Complete Phases 3-5
- Scale to multiple research domains
- Enterprise partnerships
- Platform expansion and marketplace

## Risk Mitigation

### High Priority Risks
1. **API Dependency**: Continue adding data sources as fallbacks develop
2. **Data Quality**: Implement continuous data validation and monitoring
3. **User Privacy**: Maintain strict data handling policies and encryption
4. **Performance**: Implement caching and database optimization

### Medium Priority Risks
1. **Technology Evolution**: Regular technology stack assessments
2. **User Adoption**: Continuous UX research and testing
3. **Regulatory Compliance**: Stay current with research data regulations
4. **Competitive Analysis**: Monitor competitive landscape and adapt

## Success Metrics

### User Success Metrics
- **Time to Journal Match:** < 5 minutes average
- **Journal Recommendation Relevance:** > 80% expert satisfaction (targeted evaluation)
- **Readiness Checklist Coverage:** > 90% of known requirements
- **Project Save/Load Success:** 100% reliability
- **User Satisfaction Score:** > 4/5 (post-launch surveys)

### Technical Metrics
- **Application Uptime:** > 99.9%
- **API Response Time:** < 2 seconds average
- **Database Query Performance:** < 100ms for common operations
- **Test Coverage:** > 80% overall, > 90% core functionality
- **Security Compliance:** SOC 2 Type II (targeted)

### Business Metrics
- **User Acquisition:** 1,000+ active users in first year
- **Retention Rate:** > 70% month-over-month
- **Feature Adoption:** > 60% of core features used
- **Support Tickets:** < 10 per 1,000 users
- **Revenue Milestones:** Break-even at 5,000 users

## Next Steps

### Immediate (This Sprint)
1. [x] Finalize Phase 1 implementation
2. [x] Complete all P0 requirements
3. [x] Set up monitoring and analytics
4. [x] Prepare deployment pipeline
5. [x] Create user documentation
6. [x] Establish feedback collection process

### Short-term (Next 2-3 months)
1. Begin Phase 2 implementation (DOCX processing)
2. Expand data sources and API integrations
3. Enhance user collaboration features
4. Implement advanced matching algorithms
5. Expand to additional research domains

### Strategic Goals
1. Establish research workflow standard
2. Build trusted partnership with academic community
3. Create sustainable open-source components
4. Expand to enterprise and institutional markets

This roadmap provides a clear path forward for PubRooter's development, balancing feature delivery with technical debt management and user experience quality. Each phase builds upon the previous one, ensuring a solid foundation for long-term success.