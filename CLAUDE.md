# PubRooter - Claude Code Configuration

This file contains the configuration for Claude Code to work with the PubRooter project. It includes project-specific instructions, settings, and guidelines for development.

## Project Overview

PubRooter is a research-publication workflow SaaS designed to help researchers move from manuscript to well-prepared, evidence-backed journal submission workflow. It focuses on reliable data and transparent evidence: analysis is deterministic and every score cites its sources rather than relying on model-generated claims.

## Configuration

### Project Structure

The project follows a modular monolith architecture with clear boundaries:

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
│   ├── api/           # API clients for external sources
│   ├── discovery/     # Journal discovery and matching algorithms
│   ├── journals/      # Journal data models and management
│   ├── projects/      # Project/project lifecycle management
│   ├── requirements/  # Journal requirements and validation
│   └── shared/        # Common types, schemas, and utilities
├── scripts/            # Build and deployment scripts
├── tests/             # Test files
├── .env.example       # Environment variables template
├── package.json       # Root package.json
├── tsconfig.json      # TypeScript configuration
└── vite.config.js     # Vite configuration
```

### Development Environment

#### Prerequisites
- PostgreSQL 12+ or SQLite (recommended)
- Node.js 18+
- OpenAlex API (optional)
- Crossref API (optional)
- Europe PMC API (optional)

#### Installation
```bash
# Clone this repository
cd /path/to/PubRooter

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Configure environment variables as needed
# Run database migrations (if applicable)
npm run db:migrate

# Build the application
npm run build

# Start the development server
npm run dev
```

#### Key Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests

### Project Dependencies

#### Core Dependencies
- **React 18.3.0** - Component library
- **Node.js 18+** - Runtime environment
- **PostgreSQL** - Database
- **Prisma** - ORM
- **Zod** - Schema validation

#### External API Integrations
- **OpenAlex** - Broad scholarly metadata
- **Crossref** - DOI and bibliographic metadata
- **Europe PMC** - Biomedical literature
- **DOAJ** - Open access journal metadata

### Project Configuration Files

#### .env.example
Template environment variables for development and production:
- `DATABASE_URL` - Database connection string
- `OPENALEX_BASE_URL` - OpenAlex API endpoint
- `CROSSREF_USER_AGENT` - Crossref API user agent
- `EUROPEPMC_API_KEY` - Europe PMC API key

#### package.json
Root package configuration with all scripts and dependencies.

#### tsconfig.json
TypeScript configuration for the entire project.

### Development Guidelines

#### Code Quality
- **Linting:** Use ESLint with React and TypeScript plugins
- **Formatting:** Use Prettier for consistent code formatting
- **Type Checking:** Use TypeScript with strict mode
- **Testing:** Use Jest with React Testing Library

#### Project Structure
- **Apps:** All applications go in the `apps/` directory
- **Packages:** Internal packages go in the `packages/` directory
- **Configuration:** Project configuration files at the root

#### Security and Privacy
- **Sensitive Data:** Never commit sensitive data to version control
- **Environment Variables:** Use `.env.example` as template
- **Data Protection:** Implement comprehensive security controls
- **Privacy:** Follow GDPR and other relevant privacy regulations

### Available Skills

PubRooter project includes the following skills:

#### Application Development Skills
- **app-development:** General application development skills
- **api-integration:** API integration and development

#### Security Skills
- **security-review:** Security review and vulnerability assessment
- **security-testing:** Security testing and penetration testing

#### Documentation Skills
- **documentation:** Technical documentation and guides
- **architecture-design:** Architecture design and documentation

#### Testing Skills
- **testing:** Comprehensive testing strategies
- **e2e-testing:** End-to-end testing

### Project Commands

#### Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build application
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code

#### Database Commands
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database
- `npm run db:studio` - Open database studio

#### Quality Assurance
- `npm run typecheck` - Type checking
- `npm run security:audit` - Security audit
- `npm run security:fix` - Security fixes

### Project-Specific Instructions

#### RTK Integration
The project uses RTK (Rust Token Killer) for optimized command execution:

```bash
# Show token savings analytics
rtk gain

# Show command usage history with savings
rtk gain --history

# Analyze Claude Code history for missed opportunities
rtk discover

# Execute raw command without filtering (for debugging)
rtk proxy <cmd>
```

#### Installation Verification
```bash
# Verify rtk installation
rtk --version

# Verify rtk gain functionality
rtk gain

# Verify correct binary location
which rtk
```

#### Hook-Based Usage
All other commands are automatically rewritten by the Claude Code hook:
- `git status` → `rtk git status`
- `npm install` → `rtk npm install`

#### Note on Name Collision
If `rtk gain` fails, you may have the `reachingforthejack/rtk` (Rust Type Kit) installed instead.

### Project Documentation

#### Documentation Files
- **README.md** - Main project documentation
- **IMPLEMENTATION_PLAN.md** - Detailed implementation plan
- **docs/ROADMAP.md** - Project roadmap
- **docs/INTEGRATIONS.md** - API integration documentation
- **docs/DATA_SOURCES.md** - Data sources documentation
- **docs/SECURITY_PRIVACY.md** - Security and privacy documentation

#### Key Documentation Sections
1. **Project Overview** - High-level project description
2. **Setup Instructions** - Development and deployment setup
3. **API Clients** - Integration with external APIs
4. **Testing** - Testing strategies and configurations
5. **Project Structure** - Detailed project organization
6. **Architecture** - Technical architecture overview

### Project-Specific Features

#### Research Publication Workflow
PubRooter provides:

1. **Manuscript Entry** - Title, abstract, and metadata input
2. **Journal Discovery** - Evidence-backed journal matching
3. **Requirements Checklist** - Journal-specific requirements
4. **Project Management** - Save and reopen projects
5. **Evidence-Backed Matching** - Transparent recommendation rationale

#### Key Differentiators
- **Publisher-Neutral:** No preference for any publisher
- **Explainable matching:** Transparent scoring with clear evidence
- **Data Quality:** Rigorous validation of all data sources
- **Privacy-First:** Secure handling of sensitive research data

### Development Best Practices

#### Code Quality
- Write clean, readable, and maintainable code
- Follow the project's coding standards
- Use TypeScript for type safety
- Write comprehensive tests

#### Project Management
- Follow the implementation plan
- Use the project roadmap for prioritization
- Document decisions and changes
- Maintain code quality throughout

#### Security
- Implement security controls throughout the development lifecycle
- Follow secure coding practices
- Regularly review and update security controls
- Maintain comprehensive audit trails

### Project Compliance

#### Legal and Regulatory
- **GDPR:** Compliant with General Data Protection Regulation
- **CCPA:** Compliant with California Consumer Privacy Act
- **Industry Standards:** Follow OWASP Top 10 and ISO 27001

#### Data Handling
- **Privacy:** Protect user privacy and data
- **Security:** Implement comprehensive security controls
- **Integrity:** Maintain data integrity and accuracy
- **Accessibility:** Ensure accessibility for all users

### Project Monitoring

#### Development Monitoring
- **Code Quality:** Monitor code quality metrics
- **Performance:** Monitor application performance
- **Security:** Monitor security incidents and vulnerabilities
- **Compliance:** Monitor regulatory compliance

#### User Experience
- **Accessibility:** Ensure accessibility compliance
- **Usability:** Design user-friendly interfaces
- **Performance:** Optimize for performance and scalability
- **Reliability:** Ensure high availability and reliability

### Project Success Criteria

#### Technical Requirements
1. Application launches locally using documented instructions
2. User can create a manuscript project with title and abstract
3. Journal candidates come from a configured real provider or clearly labeled demo data
4. Results explain matching and expose provenance/limitations
5. A readiness checklist can be created and saved with unknown requirements explicitly marked
6. Project can be reopened
7. Tests cover core ranking and validation
8. Documentation distinguishes implemented and planned capabilities

#### User Experience Requirements
1. Clear manuscript entry form with validation
2. Responsive design that works on mobile
3. Explainable journal matching (no black box)
4. Evidence-backed recommendations
5. Accessible UI with keyboard navigation
6. Clear loading and error states

### Next Steps

#### Immediate Actions
1. [x] Set up project structure and configuration
2. [x] Create implementation plan
3. [x] Set up development environment
4. [x] Create documentation
5. [x] Configure RTK integration

#### Short-term Goals
1. Complete Phase 1 implementation
2. Implement journal discovery and matching
3. Set up project persistence
4. Build testing framework
5. Create demo mode

#### Long-term Goals
1. Expand to additional research domains
2. Add publisher portal integrations
3. Implement enterprise features
4. Scale to broader research workflow
5. Establish research partnerships

### Project Resources

#### Documentation
- **Readme:** Complete project documentation
- **Implementation Plan:** Detailed implementation strategy
- **Roadmap:** Phased development roadmap
- **Integrations:** API integration documentation
- **Data Sources:** Data source documentation
- **Security/Privacy:** Security and privacy documentation

#### Development Tools
- **IDE Configuration:** Development environment setup
- **Testing Framework:** Comprehensive testing setup
- **Build Tools:** Build and deployment tools
- **Version Control:** Git and versioning strategies

#### Support
- **Documentation:** Comprehensive documentation
- **Issue Tracking:** GitHub issues and pull requests
- **Community:** Developer community and support
- **Training:** Training and onboarding materials

### Project Summary

PubRooter is a comprehensive research publication workflow platform that helps researchers move from manuscript to evidence-backed journal submission. It combines scholarly metadata APIs with explainable, evidence-cited matching to provide transparent journal recommendations while maintaining data quality and privacy.

The project follows a phased approach with clear requirements, comprehensive documentation, and robust security controls. It aims to become the standard tool for researchers in the publication workflow.

### Implementation Notes

#### Development Approach
- **Modular Monolith:** Maintain clear module boundaries
- **Evidence-First:** Prioritize data quality and transparency
- **Privacy-First:** Protect user data throughout the lifecycle
- **Testing-First:** Comprehensive testing for quality assurance

#### Quality Assurance
- **Code Reviews:** Regular code reviews and quality checks
- **Testing:** Comprehensive unit, integration, and end-to-end testing
- **Security:** Regular security assessments and penetration testing
- **Performance:** Performance monitoring and optimization

#### Continuous Improvement
- **Feedback Loop:** Continuous improvement based on user feedback
- **Monitoring:** Comprehensive monitoring and analytics
- **Documentation:** Up-to-date documentation
- **Support:** Responsive support and community

This configuration provides a comprehensive framework for developing PubRooter while maintaining high standards for quality, security, and user experience.