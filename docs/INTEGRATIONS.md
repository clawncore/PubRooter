# PubRooter Integrations

Documentation of external API integrations, data sources, and technical connections used by PubRooter.

## Overview

PubRooter integrates with multiple scholarly metadata APIs to provide comprehensive journal discovery and metadata services. All integrations follow the "trusted sources first" principle, prioritizing official publisher APIs and established academic databases while maintaining fallbacks for reliability.

## Current Integrations

### 1. OpenAlex
**Provider:** OpenAlex (https://openalex.org/)
**Type:** Primary scholarly metadata source
**Status:** ✅ Active
**Purpose:** Broad journal discovery and metadata retrieval

#### Capabilities:
- Journal metadata (name, publisher, ISSN, aims and scope)
- Work/journals relationships and citation data
- Subject classifications and topics
- Open access status
- Institutional affiliations

#### API Configuration:
```env
OPENALEX_BASE_URL=https://api.openalex.org
OPENALEX_MAX_REQUESTS=100
OPENALEX_TIME_WINDOW_MS=300000
```

#### Rate Limiting:
- Default: 100 requests per 5 minutes
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Exponential backoff on rate limit errors (HTTP 429)

#### Data Quality:
- Regular schema validation
- Fallback to Crossref when OpenAlex data incomplete
- Manual review queue for critical metadata gaps

#### Data Points Retrieved:
- Journal IDs, names, publishers
- Print/Electronic ISSNs
- Official URLs and submission URLs
- Subject areas and keywords
- Open access status
- Article type compatibility

### 2. Crossref
**Provider:** Crossref (https://www.crossref.org/)
**Type:** Secondary metadata source
**Status:** ✅ Active
**Purpose:** DOI resolution, bibliographic metadata, journal validation

#### Capabilities:
- DOI metadata retrieval
- Journal registration validation
- Publisher information
- Article type classification
- Citation linking

#### API Configuration:
```env
CROSSREF_USER_AGENT=PubRooter/1.0 (mailto:your-email@example.com)
CROSSREF_MAX_REQUESTS=50
CROSSREF_TIME_WINDOW_MS=300000
```

#### Rate Limiting:
- Default: 50 requests per 5 minutes
- Implement `Retry-After` header handling
- Queue retry for HTTP 503 errors

#### Integration Points:
- Journal name resolution (Crossref works with journal titles)
- Official publisher validation
- DOI-based metadata enrichment
- Cross-referencing between OpenAlex and Crossref data

### 3. Europe PMC
**Provider:** Europe PMC (https://www.europepmc.org/)
**Type:** Biomedical/lifesciences focused
**Status:** ✅ Active (with API key)
**Purpose:** Life sciences journal metadata and biomedical literature

#### Capabilities:
- Life sciences journal metadata
- Biomedical literature search
- PMC article access validation
- Citation tracking
- Author information

#### API Configuration:
```env
EUROPEPMC_API_KEY=your_europepmc_api_key
EUROPEPMC_MAX_REQUESTS=5
EUROPEPMC_TIME_WINDOW_MS=1000
```

#### Rate Limiting:
- Default: 5 requests per second
- API key required for >1 request/second
- Implement aggressive caching for repeated queries

#### Use Cases:
- Biomedical research domain journal discovery
- Life sciences subject area classification
- Citation analysis for science papers

### 4. Directory of Open Access Journals (DOAJ)
**Provider:** DOAJ (https://doaj.org/)
**Type:** Open access journal registry
**Status:** ✅ Active
**Purpose:** Open access journal verification and discovery

#### Capabilities:
- Open access journal verification
- Quality metrics and impact indicators
- Publisher information
- Subject classifications
- Review processes and standards

#### Integration Notes:
- Complement OpenAlex for open access discovery
- Serve as validation source for open access status
- Provide quality signals for journal ranking

## Integration Architecture

### API Client Layer
Each integration is implemented as a dedicated client with:

1. **Common Interface:** Standardized methods across all providers
2. **Error Handling:** Consistent error categorization and retry logic
3. **Rate Limiting:** Provider-specific rate limit management
4. **Caching:** Smart caching strategies per provider
5. **Validation:** Schema validation for all API responses
6. **Logging:** Comprehensive request/response logging

### Data Normalization Layer
- **Journal Normalization:** Deduplicate journals across providers using ISSN and stable identifiers
- **Metadata Standardization:** Map provider-specific fields to common schema
- **Quality Scoring:** Assign quality scores based on provider reputation and data completeness
- **Provenance Tracking:** Track original data source for each record

### Fallback Strategy

1. **Primary Provider:** OpenAlex (broad coverage)
2. **Secondary Provider:** Crossref (DOI validation, publisher info)
3. **Domain-Specific:** Europe PMC (life sciences)
4. **Quality Validation:** DOAJ (open access verification)

When a primary provider fails:
- Fail gracefully to next provider
- Use cached data from successful recent requests
- Display "Data partially available" message
- Queue retry with exponential backoff

## Integration Standards

### API Usage Guidelines

1. **User Agent Requirements:**
   - Include application name and contact information
   - Format: `ApplicationName/Version (mailto:contact@example.com)`
   - Follow each provider's specific requirements

2. **Request Headers:**
   ```http
   User-Agent: PubRooter/1.0 (mailto:your-email@example.com)
   Accept: application/json
   Content-Type: application/json
   ```

3. **Rate Limiting Compliance:**
   - Respect all provider rate limits
   - Implement exponential backoff for 429/503 responses
   - Use provider-specific headers for rate limit monitoring

4. **Data Handling:**
   - Store provider, source URL, and retrieval timestamp
   - Cache responses appropriately (respect provider terms)
   - Update data on controlled schedule, not on-demand

### Error Handling Standards

1. **API Errors:**
   - 4xx errors: Log and continue (user can retry)
   - 5xx errors: Queue retry with exponential backoff
   - Rate limits: Implement automatic retry after delay

2. **Data Validation Errors:**
   - Missing required fields: Flag as incomplete
   - Schema violations: Log and attempt repair
   - Cross-provider conflicts: Use OpenAlex as source of truth

3. **User Communication:**
   - Display clear error messages
   - Explain what data is available vs. missing
   - Provide retry options when appropriate

### Data Quality Controls

1. **Validation Rules:**
   - All journal records must have at least one identifier (ISSN or stable ID)
   - Publisher information verified against multiple sources when available
   - Open access status must be explicitly confirmed
   - Submission URLs must be valid and accessible

2. **Data Freshness:**
   - All data includes retrieval timestamp
   - Schedule automatic updates (daily/weekly based on provider)
   - Flag stale data (>30 days old) appropriately

3. **Manual Review Process:**
   - Flag suspicious or contradictory data
   - Implement editor review queue for critical entries
   - Maintain audit trail of all data changes

## Integration Monitoring

### Health Monitoring
- **API Availability:** Monitor each provider's API status
- **Response Times:** Track and alert on slow responses
- **Error Rates:** Monitor 4xx/5xx error patterns
- **Rate Limit Compliance:** Ensure we stay within limits

### Data Quality Monitoring
- **Completeness:** Track missing data fields per provider
- **Freshness:** Monitor data age and update schedules
- **Consistency:** Cross-validate data across providers
- **Accuracy:** Flag potential data quality issues

### Performance Monitoring
- **Cache Hit Rates:** Monitor effectiveness of caching strategies
- **Database Performance:** Track query performance and optimization opportunities
- **API Usage Patterns:** Analyze usage to optimize requests
- **User Experience:** Monitor completion rates and satisfaction

## Integration Development Process

### 1. Provider Evaluation
1. **Research:** Study provider API documentation and terms of use
2. **Assessment:** Evaluate coverage, quality, and reliability
3. **Approval:** Get approval from data governance team
4. **Implementation:** Develop client implementation

### 2. Implementation
1. **API Integration:** Connect to provider API
2. **Error Handling:** Implement comprehensive error handling
3. **Rate Limiting:** Add provider-specific rate limiting
4. **Testing:** Create unit and integration tests
5. **Validation:** Ensure data quality and completeness

### 3. Deployment
1. **Monitoring:** Set up monitoring and alerting
2. **Documentation:** Update integration documentation
3. **Training:** Train team on integration usage
4. **Support:** Prepare support materials and FAQs

### 4. Maintenance
1. **Updates:** Schedule regular data updates
2. **Monitoring:** Monitor performance and data quality
3. **Improvements:** Implement enhancements and fixes
4. **Deprecation:** Plan for gradual provider deprecation

## Integration Roadmap

### Current (Phase 1)
- OpenAlex integration
- Crossref integration
- Europe PMC integration
- DOAJ integration

### Next (Phase 2)
- Scopus integration (if licensed)
- Web of Science integration (if licensed)
- Publisher direct API integrations (Elsevier, Springer, Wiley)

### Future (Phase 3+)
- Automated provider switching based on performance
- Real-time provider monitoring

## Troubleshooting

### Common Issues and Solutions

#### "API Unavailable" Error
1. Check provider status page
2. Verify API keys are configured correctly
3. Check rate limit status
4. Review error logs for specific error messages

#### "Data Incomplete" Warning
1. Check if all providers were queried
2. Verify API key is set for Europe PMC
3. Check data validation rules
4. Consider manual data entry as fallback

#### "Slow Response" Issues
1. Check network connectivity
2. Verify provider rate limits
3. Review caching configuration
4. Consider provider fallback

### Support Resources
- Integration documentation in `docs/INTEGRATIONS.md`
- API client source code in `packages/api/`
- Monitoring dashboards and alerts
- Provider support contacts (see individual provider docs)

This document provides comprehensive guidance for all PubRooter integrations, ensuring reliable, high-quality data from multiple scholarly sources while maintaining flexibility for future expansions.