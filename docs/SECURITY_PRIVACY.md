# PubRooter Security and Privacy Documentation

Comprehensive security controls, privacy protections, and data handling procedures for PubRooter.

## Overview

This document outlines PubRooter's security architecture, privacy controls, and data handling procedures to ensure the protection of sensitive research data while maintaining compliance with relevant regulations and best practices.

## Security Architecture

### Core Security Principles

1. **Data Protection by Design:** Security controls embedded throughout the system lifecycle
2. **Zero Trust Architecture:** Never trust, always verify – all access requires authentication and authorization
3. **Least Privilege:** Users and systems access only what they need to perform their functions
4. **Encryption in Transit:** All data encrypted when moving between systems
5. **Encryption at Rest:** All stored data encrypted with strong encryption standards
6. **Regular Security Testing:** Continuous vulnerability assessment and penetration testing

### Security Controls

#### Network Security
- **Firewalls:** Application-layer firewalls with stateful inspection
- **Intrusion Detection/Prevention:** Real-time monitoring and automated blocking
- **VPN Access:** Secure remote access for maintenance and support
- **DDoS Protection:** Multiple layers of protection against volumetric attacks
- **SSL/TLS:** Force HTTPS with latest cipher suites

#### Application Security
- **Input Validation:** All user inputs validated against strict schemas
- **Output Encoding:** All output properly encoded to prevent injection attacks
- **Session Management:** Secure session handling with timeout and regeneration
- **API Security:** Rate limiting, authentication, and authorization for all APIs
- **Dependency Security:** Regular vulnerability scanning and patching

#### Database Security
- **Access Control:** Role-based access control with principle of least privilege
- **Encryption:** Transparent data encryption (TDE) for data at rest
- **Backup Security:** Encrypted backups with restricted access
- **Audit Logging:** Comprehensive logging of all database access
- **Connection Security:** SSL/TLS encrypted connections

#### Host Security
- **Operating System:** Latest patches and security updates
- **User Management:** Strong password policies and multi-factor authentication
- **File System:** Proper permissions and access controls
- **Monitoring:** Host-based intrusion detection

#### Client Workspace Storage (implemented)
The authenticated research workspace is a client-side application with no backend database. The following controls are implemented in code today:

- **Encryption at rest:** The workspace blob (profile, manuscripts, analysis results, readiness audits, saved journals, activity log) is encrypted in the browser with AES-GCM-256. The key is derived from the user's passphrase via PBKDF2-SHA256 with 310,000 iterations; a random salt and IV are stored alongside the ciphertext. The passphrase never leaves the device and is never transmitted.
- **Passphrase verification:** A verifier record allows checking the passphrase without decrypting the full workspace. A wrong passphrase cannot decrypt data (decrypt fails closed).
- **Manuscript files:** PDFs are stored separately in IndexedDB as opaque binary blobs and are only readable with the unlocked session. Uploads are validated for size, extension, and the `%PDF-` magic header before parsing.
- **No manuscript text in logs:** Activity events store short structural metadata only (e.g., "Uploaded paper.pdf"), never extracted manuscript text.
- **No server transmission:** Manuscript content and workspace data are not sent to PubRooter servers (there are none); only public scholarly metadata queries (OpenAlex/Crossref) leave the browser.
- **Limitations (documented honestly):** there is no account recovery — losing the passphrase means losing the workspace; clearing site data (localStorage/IndexedDB) deletes it; there is no multi-device sync; "Wipe workspace" performs local deletion of both stores.

## Privacy Controls

### Data Classification

#### Confidential Data
- Manuscript content and abstracts
- User account information
- Project metadata and requirements
- Submission checklists

#### Sensitive Data
- Author information
- Institutional affiliations
- Journal submission requirements
- Research metadata

#### Public Data
- Journal metadata (where provided by sources)
- System usage analytics (anonymized)
- Performance metrics

### Privacy by Design

#### Data Minimization
- Collect only data necessary for core functionality
- Implement data retention policies
- Provide data deletion capabilities
- Minimize data sharing with third parties

#### Purpose Limitation
- Use data only for specified purposes
- Clear data usage policies
- User consent for secondary uses
- Regular privacy impact assessments

#### Storage Limitation
- Secure deletion of sensitive data
- Automated data purging based on retention policies
- Encrypted backups with secure deletion
- No data retention longer than necessary

### User Privacy Controls

#### Account Management
- **Registration:** Email-based registration with verification
- **Authentication:** Secure password handling with hashing
- **Multi-Factor Authentication:** Optional for sensitive operations
- **Session Management:** Secure session handling with timeout
- **Password Recovery:** Secure password reset with verification

#### Data Access Control
- **Project-Level Access:** Users can only access their own projects
- **Role-Based Access:** Different permissions for different user types
- **Audit Logging:** Comprehensive logging of all data access
- **Data Export:** Users can export their own data

#### Data Portability
- **Export Formats:** Users can export data in common formats
- **API Access:** Programmatic access to user data
- **Migration:** Ability to migrate data to other systems
- **Deletion:** Complete data deletion upon user request

## Data Handling Procedures

### Manuscript Data

#### Input Validation
- File type validation (PDF, DOCX, plain text)
- Size limits (10MB maximum)
- Content validation for required fields
- Malware scanning for uploaded files

#### Storage
- **Location:** Encrypted, access-controlled storage
- **Format:** Secure, validated format
- **Backup:** Encrypted, offline backups
- **Retention:** Configurable retention periods

#### Processing
- **Text Extraction:** Secure, validated text extraction
- **Analysis:** Only authorized analysis with user consent
- **Caching:** Temporary caching with secure deletion

### API Data

#### Source APIs
- **OpenAlex:** Free, open data
- **Crossref:** Free, CC-BY licensed
- **Europe PMC:** Free with usage limits
- **DOAJ:** Free, open access verification

#### Data Quality
- **Validation:** Schema validation for all API responses
- **Freshness:** Regular updates and freshness checks
- **Completeness:** Handling missing data gracefully
- **Conflict Resolution:** Standardized conflict resolution rules

#### Storage
- **Format:** Standardized, validated format
- **Metadata:** Complete source attribution and timestamps
- **Updates:** Scheduled updates with change tracking

### User Data

#### Collection
- **Account Information:** Email, name, optional preferences
- **Project Data:** Manuscript metadata, journal matches
- **Usage Data:** System interactions and preferences

#### Processing
- **Analysis:** Aggregated, anonymized analytics
- **Improvement:** Continuous improvement with anonymized data
- **Communication:** System notifications and updates

#### Storage
- **Encryption:** AES-256 encryption at rest
- **Access Control:** Role-based access control
- **Backup:** Encrypted, geographically distributed backups

## Security Compliance

### Regulatory Compliance

#### GDPR (General Data Protection Regulation)
- **Lawful Basis:** Legitimate interest for providing service
- **Data Subject Rights:** Access, correction, deletion, portability
- **Data Processing Agreements:** With all data processors
- **Data Breach Notification:** 72-hour notification requirement
- **Cookie Policy:** Transparent cookie usage

#### CCPA (California Consumer Privacy Act)
- **Rights:** Access, deletion, correction, portability
- **Non-Discrimination:** Fair treatment of privacy-conscious users
- **Data Minimization:** Collect only necessary data

#### HIPAA (Health Insurance Portability and Accountability Act)
- **Protected Health Information (PHI):** Not applicable to general research
- **Security Standards:** Administrative, technical, and physical safeguards
- **Business Associate Agreements:** With all data processors

### Industry Standards

#### OWASP Top 10
- **A01:2021 – Broken Access Control:** Comprehensive access controls
- **A02:2021 – Cryptographic Failures:** Strong encryption standards
- **A03:2021 – Injection:** Input validation and output encoding
- **A04:2021 – Insecure Design:** Secure development lifecycle
- **A05:2021 – Security Misconfiguration:** Hardening and monitoring
- **A06:2021 – Vulnerable and Outdated Components:** Regular patching
- **A07:2021 – Identification and Authentication Failures:** Strong authentication
- **A08:2021 – Software and Data Integrity Failures:** Integrity checks
- **A09:2021 – Security Logging and Monitoring Failures:** Comprehensive logging
- **A10:2021 – Server-Side Request Forgery:** Input validation

#### ISO 27001
- **Information Security Management:** Comprehensive ISMS
- **Risk Management:** Continuous risk assessment
- **Incident Management:** Defined incident response procedures
- **Continuous Improvement:** Regular security reviews

## Incident Management

### Incident Response Framework

#### Preparation
- **Policies:** Defined incident response policies
- **Roles:** Defined incident response team roles
- **Testing:** Regular incident response testing
- **Communication:** Clear communication procedures

#### Detection
- **Monitoring:** Comprehensive monitoring systems
- **Alerting:** Automated alerting for suspicious activities
- **Investigation:** Structured investigation procedures
- **Classification:** Incident severity classification

#### Response
- **Containment:** Immediate containment of security incidents
- **Eradication:** Complete removal of threats
- **Recovery:** System recovery and validation
- **Post-Incident:** Lessons learned and improvements

#### Post-Incident
- **Analysis:** Root cause analysis
- **Remediation:** Implementation of corrective actions
- **Documentation:** Complete incident documentation
- **Review:** Regular review and improvement

### Incident Categories

#### High Priority Incidents
- **Data Breaches:** Unauthorized access to sensitive data
- **System Compromise:** Complete system takeover
- **Ransomware Attacks:** Encryption of critical data
- **Critical Vulnerabilities:** Zero-day exploits

#### Medium Priority Incidents
- **Unauthorized Access:** Limited system access
- **Data Loss:** Loss of non-critical data
- **Service Disruption:** Partial service availability issues
- **Configuration Errors:** Security misconfiguration

#### Low Priority Incidents
- **Phishing Attempts:** User-targeted phishing
- **Policy Violations:** Policy compliance issues
- **Minor Vulnerabilities:** Low-severity security issues
- **False Positives:** False security alerts

## Privacy Controls

### User Privacy Rights

#### Access Rights
- **Right to Access:** Users can access their data
- **Right to Correction:** Users can correct inaccurate data
- **Right to Deletion:** Users can request data deletion
- **Right to Portability:** Users can export their data

#### Communication
- **Privacy Notices:** Clear privacy policies
- **Consent Management:** User consent management
- **Preferences:** User preference management
- **Opt-Out:** Options to opt-out of data collection

#### Data Protection
- **Encryption:** Strong encryption standards
- **Anonymization:** Anonymization of aggregated data
- **Pseudonymization:** Use of pseudonyms where appropriate
- **Deletion:** Secure data deletion

### Data Processing Agreements

#### Third-Party Processors
- **OpenAlex:** Data provider agreement
- **Crossref:** Metadata provider agreement
- **Europe PMC:** Literature database provider
- **DOAJ:** Open access registry provider

#### Data Transfer
- **International Transfers:** Compliant with international data transfer laws
- **Standard Contractual Clauses:** EU-US Privacy Shield alternatives
- **Adequacy Decisions:** Reliance on adequacy decisions
- **Binding Corporate Rules:** For global data transfers

## Security Monitoring

### Real-Time Monitoring
- **SIEM:** Security information and event management
- **Log Monitoring:** Comprehensive log monitoring
- **Network Monitoring:** Network traffic monitoring
- **Host Monitoring:** Host-based monitoring

### Threat Intelligence
- **Vulnerability Management:** Continuous vulnerability assessment
- **Threat Intelligence:** Integration with threat intelligence feeds
- **Malware Detection:** Anti-malware detection
- **Anomaly Detection:** Unusual activity detection

### Compliance Monitoring
- **Audit Logs:** Comprehensive audit logging
- **Compliance Scanning:** Automated compliance checking
- **Vulnerability Scanning:** Regular vulnerability assessment
- **Penetration Testing:** Regular penetration testing

## Security Training and Awareness

### User Training
- **Security Awareness:** Regular security awareness training
- **Phishing Training:** Phishing awareness and detection
- **Password Security:** Strong password practices
- **Data Handling:** Proper data handling procedures

### Developer Training
- **Secure Coding:** Secure coding practices
- **Security Testing:** Security testing techniques
- **Vulnerability Management:** Vulnerability management
- **Incident Response:** Incident response procedures

### Administration Training
- **Access Control:** Proper access control practices
- **Policy Enforcement:** Policy enforcement procedures
- **Compliance:** Compliance requirements
- **Incident Management:** Incident management procedures

## Continuous Improvement

### Security Reviews
- **Code Reviews:** Security-focused code reviews
- **Architecture Reviews:** Security architecture reviews
- **Design Reviews:** Security design reviews
- **Implementation Reviews:** Security implementation reviews

### Testing
- **Vulnerability Scanning:** Regular vulnerability scanning
- **Penetration Testing:** Regular penetration testing
- **Code Analysis:** Static and dynamic code analysis
- **User Acceptance Testing:** Security-focused user testing

### Monitoring
- **Security Dashboards:** Security monitoring dashboards
- **Alert Management:** Alert management procedures
- **Performance Monitoring:** Performance monitoring
- **Compliance Monitoring:** Compliance monitoring

This comprehensive security and privacy documentation outlines PubRooter's approach to protecting user data and maintaining security while providing a reliable research publication workflow platform.