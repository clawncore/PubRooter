# PubRooter Data Sources

Comprehensive documentation of all scholarly metadata sources used by PubRooter, including their capabilities, coverage, limitations, and data quality considerations.

## Overview

PubRooter relies on a curated selection of scholarly metadata APIs and data sources to provide evidence-backed journal recommendations. This document details each source, its data quality, limitations, and integration strategy to ensure transparent and reliable journal discovery.

## Data Source Strategy

### Core Philosophy

1. **Evidence-First Approach:** All journal recommendations must be backed by verifiable data from documented sources
2. **Publisher-Neutral:** No preferential treatment of any publisher or journal
3. **Transparent Provenance:** Every journal recommendation includes source attribution and retrieval dates
4. **Quality Over Quantity:** Prioritize data quality and completeness over exhaustive coverage
5. **Fallback-Resilient:** Multiple sources provide redundancy when primary sources fail

### Integration Architecture

- **Multi-Source Matching:** Combine data from multiple sources for comprehensive journal profiles
- **Conflict Resolution:** Standardized rules for resolving conflicting information across sources
- **Quality Scoring:** Systematic evaluation of data quality across sources
- **Cache Management:** Intelligent caching to balance freshness and performance

## Current Data Sources

### 1. OpenAlex (Primary Source)
**URL:** https://openalex.org/
**Type:** Open scholarly metadata API
**Status:** ✅ Active - Primary source for broad journal discovery
**Access:** Free, no API key required

#### Coverage:
- **Journals:** ~18,000+ journals indexed
- **Works:** 60M+ research works with journal relationships
- **Publishers:** 3,000+ publishers
- **Institutions:** 20,000+ academic institutions
- **Subjects:** Comprehensive classification system

#### Data Schema:
OpenAlex uses a unified schema with the following key fields:
- **Journal:** ID, display_name, publisher, issn, eissn, urls, works_count
- **Work:** ID, title, abstract, journal_id, publication_date, citation_count
- **Author:** ID, display_name, orcid, works_count
- **Institution:** ID, display_name, country, works_count

#### Data Quality:
- **Completeness:** High for basic metadata (90%+ coverage)
- **Freshness:** Daily updates for new works
- **Authority:** Official academic data source
- **Licensing:** Open data under CC0

#### Strengths:
- Broad coverage across all disciplines
- Free and open access
- Regular updates
- No authentication required
- Rich relationship data

#### Limitations:
- May not include all recent journals (indexing lag)
- Some publisher-specific data may be missing
- Submission requirements not included
- Peer review status not available

#### Usage in PubRooter:
- Primary journal discovery source
- Semantic similarity matching with manuscript abstracts
- Publisher and ISSN validation
- Subject area classification

### 2. Crossref (Secondary Source)
**URL:** https://www.crossref.org/
**Type:** DOI registration and metadata service
**Status:** ✅ Active - Secondary validation source
**Access:** Free, no API key required

#### Coverage:
- **DOIs:** 100M+ registered works
- **Journals:** All registered journals (Publisher"s Association)
- **Publishers:** All DOI-registered publishers
- **Languages:** International coverage

#### Data Schema:
Crossref provides:
- **Journal:** Journal title, publisher, issn, eissn, url
- **Work:** Title, author, abstract, DOI, publication date, journal_issn
- **Publisher:** Publisher name, website, contact information

#### Data Quality:
- **Completeness:** Excellent for DOI-registered works (95%+ coverage)
- **Freshness:** Near real-time updates
- **Authority:** Official DOI registration authority
- **Licensing:** Data available under CC-BY license

#### Strengths:
- Gold standard for DOI validation
- Comprehensive publisher coverage
- Reliable ISSN validation
- International reach
- Stable identifiers

#### Limitations:
- Requires DOI registration (some journals not registered)
- Submission requirements not available
- Peer review status not included
- Journal ranking or metrics not provided

#### Usage in PubRooter:
- ISSN validation and standardization
- Publisher verification
- DOI-based metadata enrichment
- Cross-source conflict resolution

### 3. Europe PMC (Life Sciences Focused)
**URL:** https://www.europepmc.org/
**Type:** Biomedical literature database
**Status:** ✅ Active - Life sciences domain
**Access:** Free with optional API key

#### Coverage:
- **Articles:** 40M+ full-text and abstract articles
- **Journals:** 5,000+ journals
- **Publishers:** Specialized biomedical publishers
- **Subjects:** Life sciences, medicine, biomedical research

#### Data Schema:
Europe PMC provides:
- **Journal:** Journal title, publisher, issn, eissn, pmc_journey_id
- **Article:** Title, abstract, author, journal_id, publication_date, pmc_id
- **Author:** Author name, affiliation, orcid
- **Publisher:** Publisher information, journal type

#### Data Quality:
- **Completeness:** High for biomedical literature (85%+ coverage)
- **Freshness:** Weekly updates
- **Authority:** National Center for Biotechnology Information (NCBI)
- **Licensing:** Public domain and licensed content

#### Strengths:
- Excellent for biomedical/life sciences
- Full-text access where available
- Author affiliation data
- Patent data integration
- Citation analysis tools

#### Limitations:
- Limited coverage outside biomedical sciences
- Requires API key for high usage
- Some content behind paywalls
- Submission requirements not included

#### Usage in PubRooter:
- Life sciences journal discovery
- Author and institution validation
- Citation impact indicators (where available)
- Subject area specialization validation

### 4. Directory of Open Access Journals (DOAJ)
**URL:** https://doaj.org/
**Type:** Open access journal registry
**Status:** ✅ Active - Open access validation
**Access:** Free, no API key required

#### Coverage:
- **Journals:** 13,000+ active open access journals
- **Publishers:** Open access publishers only
- **Quality:** Peer-reviewed journal selection process
- **Subjects:** All academic disciplines

#### Data Schema:
DOAJ provides:
- **Journal:** Journal title, publisher, issn, eissn, website, language
- **Publisher:** Publisher name, contact, reputation score
- **Quality:** Inclusion/exclusion criteria, review process
- **Metrics:** Impact factor, article processing charges where available

#### Data Quality:
- **Completeness:** High for open access journals (90%+)
- **Freshness:** Monthly updates
- **Authority:** Peer review and quality assurance
- **Licensing:** Open access compliance verification

#### Strengths:
- Quality assurance through peer review
- Open access validation
- Publisher reputation indicators
- Submission guidelines (for many journals)
- APC information where available

#### Limitations:
- Only open access journals
- Smaller journal coverage overall
- May not include hybrid journals
- Limited to journals meeting DOAJ standards

#### Usage in PubRooter:
- Open access status verification
- Journal quality assessment
- Quality scoring for journal ranking
- Submission requirement extraction

## Data Source Integration Strategy

### Primary Source Selection

**OpenAlex** serves as the primary source because:
- Broadest disciplinary coverage
- No authentication required
- Rich relationship data
- Open data license
- Regular updates

**Crossref** serves as the secondary source because:
- Gold standard for DOI validation
- Comprehensive publisher coverage
- ISSN validation and standardization
- International reach

### Data Quality Framework

#### Quality Dimensions:
1. **Completeness:** Percentage of expected fields present
2. **Authority:** Provider reputation and official status
3. **Freshness:** Data update frequency and recency
4. **Consistency:** Adherence to standards and schemas
5. **Reliability:** System uptime and error rates

#### Quality Scoring:
Each journal record receives a quality score based on:
- Number of data sources providing the information
- Authority of the data source
- Freshness of the data
- Completeness of the record
- Verification status against other sources

### Conflict Resolution

#### Data Conflicts:
When information conflicts across sources:
1. **OpenAlex vs. Crossref:** Prefer Crossref for ISSN/publisher validation
2. **OpenAlex vs. Europe PMC:** Prefer OpenAlex for broad compatibility
3. **Crossref vs. DOAJ:** Prefer DOAJ for open access verification
4. **Multiple Discrepancies:** Flag for manual review

#### Resolution Rules:
1. **Stable Identifiers:** Use ISSNs, DOIs as primary identifiers
2. **Publisher Validation:** Crossref as authoritative source
3. **Subject Classification:** Use OpenAlex as primary
4. **Open Access Status:** Use DOAJ as verification source

### Fallback Strategy

#### Primary Failure:
If OpenAlex is unavailable:
1. Switch to Crossref for basic metadata
2. Use cached OpenAlex data (if recent)
3. Flag as partial availability
4. Retry OpenAlex with exponential backoff

#### Secondary Failure:
If Crossref is unavailable:
1. Use OpenAlex with limited validation
2. Flag as reduced data quality
3. Implement manual verification steps
4. Update when Crossref becomes available

#### Tertiary Failure:
If all API sources are unavailable:
1. Display "Data partially available" message
2. Provide limited matching capabilities
3. Enable manual journal entry
4. Schedule automatic retry

## Data Source Monitoring

### Health Metrics:
1. **API Response Time:** Track response times for each source
2. **Error Rate:** Monitor HTTP error patterns
3. **Rate Limit Compliance:** Ensure we stay within limits
4. **Data Freshness:** Monitor data age and update frequency

### Data Quality Metrics:
1. **Completeness Score:** Percentage of expected fields present
2. **Accuracy Score:** Validation against known references
3. **Consistency Score:** Cross-source agreement
4. **Timeliness Score:** Recency of data updates

### Alerting:
- **Critical Alerts:** API downtime, data quality degradation
- **Warning Alerts:** Performance degradation, rate limit approaching
- **Informational Alerts:** Scheduled updates, planned maintenance

## Data Source Roadmap

### Current (Phase 1)
- OpenAlex: Fully implemented
- Crossref: Fully implemented
- Europe PMC: Implemented (with API key)
- DOAJ: Implemented (basic validation)

### Next (Phase 2)
- **Scopus:** Pending licensing discussion
- **Web of Science:** Pending licensing discussion
- **Publisher APIs:** Elsevier, Springer, Wiley direct integration
- **Alternative Sources:** arXiv, bioRxiv, SSRN

### Future (Phase 3+)
- **Citation Metrics:** Integration with citation analysis tools
- **Submission Portal APIs:** Direct integration with editorial systems

## Data Source Legal and Compliance

### Licensing Requirements:
1. **OpenAlex:** CC0, attribution requested but not required
2. **Crossref:** CC-BY, must provide attribution
3. **Europe PMC:** Varies by content, NCBI requirements apply
4. **DOAJ:** Open access compliance, attribution required

### Attribution Requirements:
- Include source name in all journal listings
- Provide source URLs where available
- Include retrieval dates in documentation
- Link to original sources when possible

### Data Usage Restrictions:
- No resale of API data
- No unauthorized redistribution
- Must comply with provider terms of service
- User data remains private and secure

## Testing Data Sources

### Unit Testing:
- API client connectivity tests
- Response schema validation
- Error handling tests
- Rate limit testing

### Integration Testing:
- End-to-end data flow testing
- Cross-source data consistency testing
- Fallback scenario testing
- Performance testing

### Load Testing:
- Concurrent request testing
- Rate limit stress testing
- API failure recovery testing
- Cache performance testing

This comprehensive data sources documentation provides full transparency into PubRooter's information ecosystem, ensuring users understand the quality, reliability, and limitations of the journal discovery process.