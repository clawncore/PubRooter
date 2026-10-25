# PubRooter — Master Build Specification for Claude Code

> **Purpose:** Build the first working PubRooter infrastructure in the existing repository. Implement a complete, demonstrable MVP slice now, while documenting and architecting future stages. Do not claim integrations exist unless they work.
>
> **Name:** PubRooter (never “PubRouter”).
>
> **Product:** Research-publication workflow SaaS. Initial focus: evidence-backed journal discovery and manuscript-readiness checks, with a path to submission-package preparation and rejection/resubmission workflows.
>
> **Core principle:** Reliable data and transparent evidence first; AI is an assistive layer, not a source of truth.

## 0. Instructions to Claude Code

Act as a senior product engineer and pragmatic technical lead. Work directly in the repository and implement the product, not just describe it.

1. Inspect the repository, README, package files, runtime, lockfile, environment examples, tests, and deployment configuration before editing. Preserve useful existing work.
2. Write `IMPLEMENTATION_PLAN.md`, then execute the plan in small verifiable stages. Do not stop after planning unless blocked by a truly essential missing decision or credential.
3. Do not delete or overwrite user work without a clear reason. Explain significant migrations/refactors in the plan.
4. Do not fabricate functionality, API results, journal facts, test success, or integrations. A visible button alone is not a working feature.
5. Use stable dependencies compatible with the current runtime and project. Avoid unnecessary dependencies and premature microservices; prefer a modular monolith.
6. Keep secrets out of source control, client bundles, logs, screenshots, fixtures, and documentation. Use environment variables and safe examples only.
7. External services must fail gracefully. If API keys are missing, provide a clearly labeled demo mode or deterministic fallback. Never present demo data as verified live data.
8. Prefer documented APIs and official journal/publisher sources. Respect API terms, licensing, attribution, rate limits, robots rules, and privacy. Do not scrape sites in ways that violate terms.
9. Do not promise acceptance, predict acceptance probabilities without validated evidence, invent impact factors/APCs/indexing status, or claim direct portal integrations without authorization and working implementation.
10. Clearly separate implemented, partial, mocked, and planned features. Create `docs/ROADMAP.md`, `docs/INTEGRATIONS.md`, `docs/DATA_SOURCES.md`, and `docs/SECURITY_PRIVACY.md`.
11. Run available lint, typecheck, tests, and production build. Fix failures caused by your changes. Report any checks that cannot run and why.
12. At completion report files changed, working end-to-end flows, commands and results, required environment variables, local run instructions, mocked/incomplete items, security considerations, and the three highest-priority next steps.
13. Implement an original product. Competitors are references for public capabilities, not sources of code, proprietary data, UI, or wording.

## 1. Product definition

### Mission
Help researchers move from a manuscript to a well-prepared, evidence-backed journal submission workflow with less uncertainty and repetitive manual work.

### Initial users
- Postgraduate students and early-career researchers.
- Initial pilot niche: biomedical science, bioinformatics, and adjacent life sciences.
- Later: laboratories, supervisors, university research offices, and publishers.

### Initial product promise
A researcher can:
1. Enter or upload a manuscript title and abstract.
2. Find plausible journal candidates from available scholarly metadata.
3. Inspect why each candidate was recommended and the evidence behind it.
4. Open a journal-specific readiness checklist.
5. See missing, stale, or unknown requirements clearly.
6. Save a project and prepare a submission checklist for later work.

Do not claim the system predicts acceptance or guarantees compliance.

### Differentiation to pursue
- Publisher-neutral workflow.
- Explainable journal matching.
- Source URL, source type, retrieval/verification date, and data-quality state.
- Structured, versioned journal requirements instead of hard-coded prompt text.
- A reusable project that can later support submission, rejection, revisions, and resubmission.
- Honest uncertainty and no invented metrics.

### Competitor-inspired capability areas
Study public descriptions/workflows from Elsevier JournalFinder, Springer Nature Journal Suggester, Wiley Journal Finder, JANE, Paperpal, Editorial Manager, ScholarOne, Overleaf, and reference managers. Exact proprietary algorithms and internal datasets are unknown unless explicitly documented. Do not assert unsupported details about competitors.

## 2. Scope: implement now

### P0 — Required
1. Responsive, accessible application shell and clear landing/dashboard.
2. New manuscript/project form: title (required), abstract (required for matching), optional keywords, research field, article type, and only those additional constraints that available data can support.
3. Manuscript entry by pasted text; DOCX upload if feasible with the current stack. Be explicit about what is and is not parsed.
4. Journal discovery/ranking using a real configured provider or clearly labeled demo dataset.
5. Results containing journal name, publisher if known, scope summary, matching rationale, source links, missing metadata, and retrieval/verification date when available.
6. Journal detail view and structured readiness checklist.
7. Save/reopen/update projects using the existing persistence architecture. If no backend exists, choose a maintainable database-backed approach compatible with the repo, or document temporary local-only behavior honestly.
8. Loading, empty, error, retry, and validation states.
9. Tests for ranking, data mapping, and requirement validation.
10. Updated README with install, run, configuration, test, and build instructions.
11. `IMPLEMENTATION_PLAN.md`, `docs/ROADMAP.md`, `docs/INTEGRATIONS.md`, `docs/DATA_SOURCES.md`, and `docs/SECURITY_PRIVACY.md`.

### P1 — Only if P0 remains solid
- DOCX parsing and downloadable readiness report.
- Basic project activity history.
- Internal journal-requirements review/curation screen.
- Manual journal-record import with schema and provenance validation.

### Explicitly out of scope for this build
- Automated submission to Editorial Manager, ScholarOne, or publisher portals.
- Claims of official integrations without authorization.
- Unauthorized live scraping.
- Acceptance probability predictions.
- Plagiarism-detection claims without a properly licensed service.
- Full manuscript rewriting or unverified scientific criticism.
- Institutional SSO, billing, enterprise administration, social network/messaging, large-scale analytics.
- Training a custom foundation model.
- Copying competitor UI/code/proprietary data/text.

## 3. Architecture and modules

Inspect and adapt to the repository instead of blindly replacing its stack. Prefer a modular monolith with clear boundaries:
- `projects`: manuscript/project intake and lifecycle.
- `journals`: journal identities, identifiers, metadata, sources.
- `discovery`: retrieval, ranking, explanations.
- `requirements`: structured journal requirements and versioning.
- `readiness`: evaluate a project against requirements.
- `sources`: API clients, normalization, provenance, synchronization.
- `exports`: checklists and report/package generation.
- `auth`: only if needed by the current app.
- `admin`: data review/curation if practical.
- `shared`: schemas, errors, configuration, logging.

Use the current database if suitable; otherwise PostgreSQL is a sensible relational default. Do not add infrastructure merely for fashion. Use migrations and typed validation schemas.

### Minimum data model

**Journal**
- `id`, `name`, nullable `publisher`
- nullable `issn_print`, `issn_electronic`
- nullable `official_url`, `submission_url`, `aims_scope`
- `subject_areas`, nullable `accepted_article_types`
- nullable `open_access_status`
- nullable `apc_amount`, `apc_currency`, `apc_source_url`, `apc_verified_at`
- structured, source-specific, date-stamped `indexing_statuses`
- `source_provider`, `source_record_id`, `source_url`, `source_license_or_terms`
- `retrieved_at`, `last_verified_at`, `data_quality_status`, `created_at`, `updated_at`

**JournalSourceRecord**
- `id`, `journal_id`, `provider`, `external_id`, `source_url`
- `raw_payload` only if permitted and appropriate; `retrieved_at`, `license_or_terms`, optional `content_hash`

**JournalRequirement**
- `id`, `journal_id`, `requirement_type`, `value_json`
- `severity` (`blocking`, `warning`, `informational`)
- `source_url`, short evidence snippet only when permitted
- `verified_at`, nullable `valid_from`, `valid_until`
- `status` (`verified`, `needs_review`, `stale`, `unknown`), `version`

**Project**
- `id`, `owner_id` if authentication exists, `title`, `abstract`, `keywords`, `research_field`, `article_type`, `constraints_json`, timestamps

**ProjectJournalMatch**
- `id`, `project_id`, `journal_id`, `rank`, `score_components_json`, `explanation`, `evidence_refs_json`, `created_at`, `algorithm_version`

**ReadinessAudit**
- `id`, `project_id`, `journal_id`, `results_json`, `created_at`, `requirements_version_snapshot`

Optional P1 `ActivityEvent`: `id`, `project_id`, `event_type`, `payload_json`, `created_at`.

Do not collapse MEDLINE, PubMed, PMC, Scopus, and Web of Science into one generic “indexed” boolean. Unknown data must remain unknown, not be inferred as positive. Avoid giant untyped JSON blobs where normalized fields are needed for querying.

## 4. Data strategy and integrations

Prefer documented APIs, subject to current terms and rate limits:
- **OpenAlex:** broad scholarly works, sources/journals, authors, institutions, concepts/topics.
- **Crossref REST API:** DOI and deposited bibliographic metadata.
- **DOAJ:** open-access journal metadata.
- **PubMed / NCBI E-utilities and Europe PMC:** biomedical/life-sciences literature.
- **Official journal/publisher pages:** authoritative aims/scope, author guidelines, fees, article types, submission links.
- **Scopus / Web of Science:** later, after licensing/access and demand are understood.

Important data rules:
- OpenAlex and Crossref do not provide every current journal submission requirement.
- Use official journal/publisher pages for authoritative current requirements.
- University access to licensed content does not automatically grant commercial redistribution rights.
- Do not make Scopus or Web of Science a dependency for the MVP.
- Validate API payloads and tolerate missing fields.
- Store provider, source URL, retrieval timestamp, terms/licensing notes, and verification status.
- Use timeouts, caching, conservative rate limits, retries with backoff, and an appropriate user agent/contact where required.
- Do not fetch/store article full text unless access and reuse are permitted.
- Never present seed/sample records as verified live data.
- Without API credentials, use documented demo mode and clearly labeled demo data.

### Data ingestion pipeline
1. Fetch through documented API clients.
2. Validate and normalize.
3. Deduplicate primarily with ISSN/stable source IDs; do not merge on ambiguous name alone.
4. Store provenance and retrieval time.
5. Log provider errors safely and continue when one source fails.
6. Refresh on a controlled schedule or manually, not on every user request.
7. Expose freshness/coverage information.
8. Support manual review for official requirements.

Do not build a data lake, distributed crawler, or event-stream platform for the MVP.

## 5. Journal matching engine

Use a transparent hybrid approach, not “LLM decides everything.”

### Retrieval
- Retrieve candidate journals and representative works from available scholarly metadata.
- Use semantic embeddings if a suitable provider is already available or can be configured safely.
- Provide a deterministic keyword/TF-IDF fallback when no embedding key is configured.
- Make external AI calls server-side only; never expose API keys to the browser.

### Initial explainable scoring (a hypothesis to evaluate, not scientific truth)
- 45% semantic/text relevance to aims/scope and representative works.
- 20% topic/keyword overlap.
- 15% article-type compatibility, only if verified.
- 10% researcher constraints supported by data.
- 10% data completeness/source quality.

Handle unknown components explicitly; do not silently score unknowns as positive. Re-normalize available components or mark results incomplete. A relevance score is not an acceptance probability.

Every result must show why it matched, the data used, source links, missing information, uncertainty, timestamps where available, and a disclaimer that recommendations are not guarantees.

Create a small test set of research abstracts and relevant/non-relevant journal profiles. Test ranking stability and edge cases. Do not claim validated accuracy until researchers/subject experts have evaluated results. Add future evaluation for expert-rated precision@k/recall@k.

## 6. Readiness checker

Requirements must be structured, versioned, and tied to evidence. Do not rely on free-form model output as the sole validator.

Initial checks can include:
- title and abstract presence;
- abstract word count if the selected journal’s verified limit is known;
- article-type compatibility if verified;
- mandatory sections/declarations if manuscript text is actually available;
- checklist for required figures, tables, supplementary files, and statements;
- reference-style reminder only if supported by a source;
- author-confirmation tasks for things software cannot determine.

Every check returns one of: `pass`, `fail`, `warning`, `not_checked`, `unknown`. Include reason and source evidence. Never treat not-checked as pass. Do not claim readiness confirms scientific validity, ethical approval, plagiarism status, or acceptance.

## 7. UI/UX

Required screens:
1. Landing/product introduction.
2. Dashboard and saved projects.
3. Project intake.
4. Journal matching results.
5. Journal detail/evidence view.
6. Journal-specific readiness checklist.
7. Project overview/activity state.
8. Empty/loading/error states.

Use a polished, professional, accessible research-focused design. Follow existing project design patterns; if starting fresh, use a restrained visual system rather than copying competitors. Use clear language. Separate verified facts, inferred matches, and missing data. Show source/freshness. Avoid unsupported confidence percentages, fake metrics, testimonials, logos, or journal records. Clearly label demo data. Ensure responsive layouts, keyboard access, form labels, sufficient contrast, and focus states.

## 8. Security, privacy, and research integrity

Unpublished manuscripts may be confidential and sensitive. Implement or document:
- server-side secrets via environment variables;
- strict input validation and safe file handling;
- upload size/type limits and safe filenames/storage keys;
- private file storage by default;
- project access controls;
- no manuscript text in ordinary logs or analytics;
- redaction of sensitive data from errors;
- appropriate API rate limiting, timeouts, and payload limits;
- deletion/retention policy;
- disclosure of AI-provider processing/retention where applicable;
- secure headers/dependency checks when appropriate;
- no model training on user manuscripts unless explicitly authorized and disclosed;
- tests that users cannot access other users’ projects if auth exists.

Do not invent compliance claims. Document implemented controls and future work.

## 9. Environment/configuration

Create/update `.env.example` with placeholders only, as applicable:
- database URL;
- OpenAlex configuration if required;
- Crossref contact/user-agent configuration if required;
- optional NCBI API key;
- Europe PMC configuration if needed;
- optional AI provider key;
- storage settings;
- app base URL and server port.

Never place real secrets in `.env.example`. Ignore `.env*` except explicitly safe examples. External providers must be optional. Matching must have a deterministic fallback if no AI key is configured.

## 10. Tests and quality gates

Test at minimum:
- project validation;
- API normalization and missing fields;
- journal deduplication;
- ranking with known examples;
- requirement checks for known and unknown limits;
- source/provenance display;
- provider timeout/invalid response handling;
- save/reopen project workflow;
- authorization boundaries where applicable;
- key responsive/accessibility flows if browser tests exist.

Run available dependency checks, lint, typecheck, unit/integration tests, and production build. Report exact commands/results. Do not conceal failures.

## 11. Deliverables

Adapt to repository conventions, but include:
- working application changes;
- database schema/migrations if applicable;
- API clients and matching logic;
- tests;
- `.env.example`;
- updated `README.md`;
- `IMPLEMENTATION_PLAN.md`;
- `docs/ROADMAP.md`;
- `docs/INTEGRATIONS.md`;
- `docs/DATA_SOURCES.md`;
- `docs/SECURITY_PRIVACY.md`;
- optionally `docs/ARCHITECTURE.md` and `docs/COMPETITIVE_NOTES.md`.

README must document prerequisites, install, environment, migrations, run, tests/lint/typecheck/build, demo mode, enabling providers/AI, and known limitations.

### Completion criteria
The task is complete only when:
1. App launches locally using documented instructions.
2. User can create a manuscript project.
3. Journal candidates come from a configured real provider or clearly labeled demo data.
4. Results explain matching and expose provenance/limitations.
5. A readiness checklist can be created and saved with unknown requirements explicitly marked.
6. Project can be reopened.
7. Tests cover core ranking and validation.
8. Docs distinguish implemented and planned capabilities.
9. Lint/typecheck/tests/build have been run where supported and results reported.

## 12. Roadmap after the first working slice

### Phase 1 — Foundation (current)
- Project intake, journal metadata ingestion, explainable matching, evidence-backed readiness checklist, saved projects, security baseline, docs.

### Phase 2 — Submission preparation
- Improved DOCX extraction and formatting validation; journal-specific package generation; reviewed cover-letter drafting; version history and co-author tasks; broader curated journal coverage.

### Phase 3 — Rejection and resubmission
- Import/paste editorial decisions and reviewer comments; categorize comments into human-confirmed action items; revision plan and response-to-reviewers workspace; alternative journal matching and change checklist; preserve version/decision history.

### Phase 4 — Integrations and teams
- Authorized integrations where technically and contractually permitted; ORCID where useful and authorized; team workspaces/permissions; institutional administration; usage reports; billing after demand is validated.

### Phase 5 — Broader research workflow
- More disciplines and source coverage; reference-manager interoperability; additional export formats and supported publishing standards; publisher partnerships/APIs where justified.

## 13. Product/business guardrails

- PubRooter is a working product name; domain, trademark, and company-name availability are not verified.
- Do not claim PubRooter is the first, only, or uniquely comprehensive platform without evidence.
- Do not copy competitors’ protected UI, text, code, or proprietary data.
- Do not infer journal quality from one metric.
- Never equate indexing in one database with indexing in another.
- Do not present fees, review times, or indexing status as current unless sourced and dated.
- Never promise publication, acceptance, or rejection prevention.
- Direct publisher-portal submission is a future integration requiring authorization and technical feasibility.
- MVP is a decision-support/workflow tool, not a publisher, peer-review service, or scientific validator.

## 14. Final execution instruction

Start by inspecting the repository and writing `IMPLEMENTATION_PLAN.md`. Then implement P0 in the existing architecture. Make sensible decisions without asking about minor details. Do not fabricate API results or claim unimplemented integrations. Keep the MVP small enough to finish while establishing module boundaries and data models that support the roadmap.

At the end, provide a concise report with:
1. Files/modules changed.
2. Features working end to end.
3. Commands run and results.
4. Required environment variables.
5. Setup/run instructions.
6. Mocked/incomplete items.
7. Security/privacy considerations.
8. Three highest-priority next steps.
