-- ============================================================================
-- Migration: 011_regulatory_intelligence.sql
-- Description: Step 13 Regulatory Intelligence Domain Foundation
-- Safe, Idempotent, Production-Grade, Tenant-Isolated Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Regulatory Authorities Master (Global & Organization Scoped)
CREATE TABLE IF NOT EXISTS public.regulatory_authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL means global standard authority
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    country_iso2 VARCHAR(2), -- ISO-3166
    country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
    authority_type VARCHAR(100) DEFAULT 'NATIONAL_COMPETENT_AUTHORITY',
    website_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_authorities_org ON public.regulatory_authorities(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_authorities_code ON public.regulatory_authorities(code);
CREATE INDEX IF NOT EXISTS idx_reg_authorities_country ON public.regulatory_authorities(country_iso2);

-- 2. Regulatory Jurisdictions (Country, Regional Union e.g. EEA, Territory)
CREATE TABLE IF NOT EXISTS public.regulatory_jurisdictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    jurisdiction_type VARCHAR(50) DEFAULT 'COUNTRY' CHECK (jurisdiction_type IN ('COUNTRY', 'REGIONAL_UNION', 'TERRITORY', 'SPECIAL_ZONE', 'MULTI_NATIONAL')),
    primary_authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE SET NULL,
    country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
    country_iso2 VARCHAR(2),
    region VARCHAR(100),
    member_countries JSONB, -- Array of ISO2 codes for regional unions (e.g. ['DE', 'FR', 'IT'])
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_code ON public.regulatory_jurisdictions(code);
CREATE INDEX IF NOT EXISTS idx_reg_jurisdictions_country ON public.regulatory_jurisdictions(country_id);

-- 3. Regulatory Sources
CREATE TABLE IF NOT EXISTS public.regulatory_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_code VARCHAR(100) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    provider VARCHAR(255) NOT NULL,
    authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE SET NULL,
    source_type VARCHAR(100) NOT NULL CHECK (source_type IN (
        'OFFICIAL_REGULATORY_DATABASE',
        'AUTHORIZED_FILE',
        'LICENSED_DATA_PROVIDER',
        'API',
        'INTERNAL_DATA',
        'USER_ENTERED',
        'OTHER_APPROVED_SOURCE'
    )),
    jurisdiction_code VARCHAR(50),
    description TEXT,
    access_type VARCHAR(100) DEFAULT 'AUTHORIZED_FEED',
    license_status VARCHAR(100) DEFAULT 'ACTIVE',
    data_license_notes TEXT,
    source_url TEXT,
    refresh_frequency VARCHAR(50) DEFAULT 'MONTHLY',
    reliability_tier VARCHAR(50) DEFAULT 'TIER_1_OFFICIAL',
    last_verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (organization_id, source_code)
);

CREATE INDEX IF NOT EXISTS idx_reg_sources_org ON public.regulatory_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_sources_type ON public.regulatory_sources(source_type);

-- 4. Regulatory Datasets & Versions (Immutable Versioning & Provenance)
CREATE TABLE IF NOT EXISTS public.regulatory_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.regulatory_sources(id) ON DELETE CASCADE,
    dataset_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    jurisdiction_id UUID REFERENCES public.regulatory_jurisdictions(id) ON DELETE SET NULL,
    data_type VARCHAR(100) DEFAULT 'MARKETING_AUTHORIZATIONS',
    coverage_description TEXT,
    reporting_period VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (organization_id, dataset_code)
);

CREATE TABLE IF NOT EXISTS public.regulatory_dataset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES public.regulatory_datasets(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    version_label VARCHAR(100),
    source_file_name VARCHAR(500),
    file_reference VARCHAR(500),
    file_hash VARCHAR(255),
    record_count INT DEFAULT 0,
    valid_record_count INT DEFAULT 0,
    invalid_record_count INT DEFAULT 0,
    matched_product_count INT DEFAULT 0,
    data_quality_score NUMERIC(5, 2) DEFAULT 100.00,
    is_immutable BOOLEAN DEFAULT TRUE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (dataset_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_reg_dataset_ver_org ON public.regulatory_dataset_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_dataset_ver_dataset ON public.regulatory_dataset_versions(dataset_id);

-- 5. Regulatory Records (Source-Supplied or Authorized Regulatory Facts)
CREATE TABLE IF NOT EXISTS public.regulatory_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dataset_version_id UUID REFERENCES public.regulatory_dataset_versions(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.regulatory_sources(id) ON DELETE SET NULL,
    authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE SET NULL,
    jurisdiction_code VARCHAR(50) NOT NULL, -- e.g. 'US', 'EMA', 'JP', 'UK'
    
    -- Canonical Match Linkage
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    molecule_id UUID REFERENCES public.molecules(id) ON DELETE SET NULL,
    
    -- Raw Source Values (Preserved exactly as provided)
    source_record_identifier VARCHAR(255),
    raw_product_name VARCHAR(500) NOT NULL,
    raw_molecule_name VARCHAR(500),
    raw_company_name VARCHAR(500),
    raw_dosage_form VARCHAR(255),
    raw_strength VARCHAR(255),
    raw_route VARCHAR(255),
    raw_presentation TEXT,
    
    -- Regulatory Identifiers
    application_number VARCHAR(255), -- e.g. ANDA 204912, NDA 021487
    application_type VARCHAR(100),   -- ANDA, NDA, BLA, MAA, NDS, DMF
    marketing_authorization_number VARCHAR(255), -- EU/1/96/007/001
    
    -- Status Fields
    raw_status VARCHAR(100) NOT NULL,
    normalized_status VARCHAR(100) NOT NULL CHECK (normalized_status IN (
        'APPROVED',
        'AUTHORIZED',
        'MARKETED',
        'PENDING',
        'UNDER_REVIEW',
        'SUBMITTED',
        'REFUSED',
        'REJECTED',
        'WITHDRAWN',
        'SUSPENDED',
        'EXPIRED',
        'REVOKED',
        'DISCONTINUED',
        'NOT_APPROVED',
        'NOT_FOUND',
        'UNKNOWN'
    )),
    
    -- Critical Dates
    submission_date DATE,
    approval_date DATE,
    effective_date DATE,
    expiry_date DATE,
    renewal_date DATE,
    withdrawal_date DATE,
    source_last_updated_date DATE,
    
    -- Commercial & Technical Metadata
    regulatory_pathway VARCHAR(100),
    marketing_authorization_holder VARCHAR(500),
    applicant_name VARCHAR(500),
    manufacturer_name VARCHAR(500),
    reference_listed_drug VARCHAR(500),
    therapeutic_class VARCHAR(255),
    
    -- Ingestion Quality & Provenance
    source_reference_url TEXT,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    match_status VARCHAR(50) DEFAULT 'UNMATCHED' CHECK (match_status IN (
        'AUTO_MATCHED_HIGH_CONFIDENCE',
        'MATCHED_BY_USER',
        'CANDIDATE_REVIEW',
        'UNMATCHED',
        'REJECTED_MATCH',
        'CONFLICT'
    )),
    match_confidence INT DEFAULT 0 CHECK (match_confidence >= 0 AND match_confidence <= 100),
    data_quality_status VARCHAR(50) DEFAULT 'PASSED' CHECK (data_quality_status IN ('PASSED', 'WARNING', 'FAILED', 'NEEDS_REVIEW')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_records_org ON public.regulatory_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_records_product ON public.regulatory_records(product_id);
CREATE INDEX IF NOT EXISTS idx_reg_records_jurisdiction ON public.regulatory_records(jurisdiction_code);
CREATE INDEX IF NOT EXISTS idx_reg_records_auth ON public.regulatory_records(marketing_authorization_number);
CREATE INDEX IF NOT EXISTS idx_reg_records_app ON public.regulatory_records(application_number);
CREATE INDEX IF NOT EXISTS idx_reg_records_status ON public.regulatory_records(normalized_status);

-- 6. Regulatory Product Matches (Entity Resolution Queue & Audit)
CREATE TABLE IF NOT EXISTS public.regulatory_product_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    regulatory_record_id UUID NOT NULL REFERENCES public.regulatory_records(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    molecule_id UUID REFERENCES public.molecules(id) ON DELETE SET NULL,
    match_type VARCHAR(50) NOT NULL CHECK (match_type IN (
        'EXACT_NAME_STRENGTH',
        'MOLECULE_FORM_MATCH',
        'ALIAS_MATCH',
        'FUZZY_CANDIDATE',
        'MANUAL_USER_CONFIRMATION',
        'REJECTED'
    )),
    confidence_score INT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    matching_rule_version VARCHAR(50) DEFAULT 'v1.0.0',
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_matches_record ON public.regulatory_product_matches(regulatory_record_id);
CREATE INDEX IF NOT EXISTS idx_reg_matches_product ON public.regulatory_product_matches(product_id);

-- 7. Immutable Regulatory Status History
CREATE TABLE IF NOT EXISTS public.regulatory_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    regulatory_record_id UUID NOT NULL REFERENCES public.regulatory_records(id) ON DELETE CASCADE,
    previous_status VARCHAR(100),
    new_status VARCHAR(100) NOT NULL,
    effective_date DATE,
    reason TEXT,
    source_id UUID REFERENCES public.regulatory_sources(id) ON DELETE SET NULL,
    dataset_version_id UUID REFERENCES public.regulatory_dataset_versions(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_status_hist_record ON public.regulatory_status_history(regulatory_record_id);

-- 8. Regulatory Events (Timeline: Submissions, Approvals, Variations, Renewals)
CREATE TABLE IF NOT EXISTS public.regulatory_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    regulatory_record_id UUID REFERENCES public.regulatory_records(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    authority_id UUID REFERENCES public.regulatory_authorities(id) ON DELETE SET NULL,
    jurisdiction_code VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
        'SUBMISSION',
        'VALIDATION_COMPLETED',
        'CHMP_OPINION',
        'APPROVAL',
        'VARIATION_SUBMITTED',
        'VARIATION_APPROVED',
        'RENEWAL',
        'SUSPENSION',
        'WITHDRAWAL',
        'REVOCATION',
        'EXPIRY',
        'SAFETY_ACTION',
        'OTHER'
    )),
    event_date DATE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_reference VARCHAR(255),
    source_id UUID REFERENCES public.regulatory_sources(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_events_product ON public.regulatory_events(product_id);
CREATE INDEX IF NOT EXISTS idx_reg_events_jurisdiction ON public.regulatory_events(jurisdiction_code);

-- 9. Regulatory Pathways Master
CREATE TABLE IF NOT EXISTS public.regulatory_pathways (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL means global pathway standard
    pathway_code VARCHAR(50) NOT NULL,
    pathway_name VARCHAR(255) NOT NULL,
    jurisdiction_code VARCHAR(50) NOT NULL,
    product_type VARCHAR(100) DEFAULT 'GENERIC_DRUG',
    typical_timeline_months INT,
    description TEXT,
    key_guidance_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Regulatory Requirements (Contextualized Documentation & Dossier Modules)
CREATE TABLE IF NOT EXISTS public.regulatory_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    jurisdiction_code VARCHAR(50) NOT NULL,
    pathway_id UUID REFERENCES public.regulatory_pathways(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN (
        'ADMINISTRATIVE',
        'QUALITY_CMC',
        'NON_CLINICAL',
        'CLINICAL_BIOEQUIVALENCE',
        'LABELING_PACKAGING',
        'STABILITY',
        'INSPECTION_GMP',
        'OTHER'
    )),
    requirement_code VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    reference_guideline TEXT,
    effective_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_reqs_jurisdiction ON public.regulatory_requirements(jurisdiction_code);

-- 11. Regulatory Assessments (Product + Jurisdictions + Opportunity Evaluation)
CREATE TABLE IF NOT EXISTS public.regulatory_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assessment_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    target_jurisdictions JSONB NOT NULL, -- Array of jurisdiction codes: ['US', 'DE', 'FR']
    overall_status VARCHAR(50) DEFAULT 'EVALUATED',
    readiness_score NUMERIC(5, 2) DEFAULT 0.00,
    readiness_breakdown JSONB, -- { authorization_coverage: 40, data_freshness: 80, match_confidence: 95 }
    key_findings TEXT,
    recommendations TEXT,
    assessed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_assessments_org ON public.regulatory_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_assessments_product ON public.regulatory_assessments(product_id);
CREATE INDEX IF NOT EXISTS idx_reg_assessments_opp ON public.regulatory_assessments(opportunity_id);

-- 12. Rule-Based Regulatory Risks
CREATE TABLE IF NOT EXISTS public.regulatory_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.regulatory_assessments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    jurisdiction_code VARCHAR(50) NOT NULL,
    risk_code VARCHAR(100) NOT NULL CHECK (risk_code IN (
        'NO_REGULATORY_DATA',
        'PRODUCT_MATCH_UNCERTAIN',
        'STATUS_UNKNOWN',
        'APPROVAL_NOT_FOUND',
        'EXPIRED_STATUS',
        'WITHDRAWN_STATUS',
        'SUSPENDED_STATUS',
        'PENDING_APPLICATION',
        'DATA_STALE',
        'SOURCE_CONFLICT',
        'REQUIREMENT_GAP',
        'MISSING_AUTHORIZATION_IDENTIFIER'
    )),
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    mitigation_suggestion TEXT,
    resolution_status VARCHAR(50) DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_risks_product ON public.regulatory_risks(product_id);
CREATE INDEX IF NOT EXISTS idx_reg_risks_severity ON public.regulatory_risks(severity);

-- 13. Regulatory Data Quality Results & Source Conflicts
CREATE TABLE IF NOT EXISTS public.regulatory_data_quality_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    regulatory_record_id UUID NOT NULL REFERENCES public.regulatory_records(id) ON DELETE CASCADE,
    check_code VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'WARNING',
    message TEXT NOT NULL,
    field_name VARCHAR(100),
    invalid_value TEXT,
    is_conflict BOOLEAN DEFAULT FALSE,
    conflicting_source_id UUID REFERENCES public.regulatory_sources(id) ON DELETE SET NULL,
    conflicting_record_id UUID REFERENCES public.regulatory_records(id) ON DELETE SET NULL,
    resolution_decision VARCHAR(50),
    resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Regulatory Analysis Snapshots (Immutable Audit & Decision Anchor)
CREATE TABLE IF NOT EXISTS public.regulatory_analysis_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.regulatory_assessments(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    snapshot_name VARCHAR(255) NOT NULL,
    dataset_versions_used JSONB NOT NULL, -- Array of dataset version IDs
    calculation_version VARCHAR(50) DEFAULT 'v1.0.0',
    full_snapshot_payload JSONB NOT NULL, -- Complete state at time of evaluation
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Seed Global Standard Regulatory Authorities
INSERT INTO public.regulatory_authorities (code, name, short_name, country_iso2, authority_type, website_url, description) VALUES
('US_FDA', 'United States Food and Drug Administration', 'US FDA', 'US', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.fda.gov', 'US federal agency responsible for protecting public health via drug regulation'),
('EU_EMA', 'European Medicines Agency', 'EMA', 'EU', 'REGIONAL_AGENCY', 'https://www.ema.europa.eu', 'Decentralised agency responsible for the scientific evaluation of medicines across the EEA'),
('UK_MHRA', 'Medicines and Healthcare products Regulatory Agency', 'MHRA', 'GB', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.gov.uk/mhra', 'Executive agency regulating medicines and medical devices in the United Kingdom'),
('JP_PMDA', 'Pharmaceuticals and Medical Devices Agency', 'PMDA', 'JP', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.pmda.go.jp', 'Japanese agency responsible for ensuring safety and efficacy of pharmaceuticals'),
('CA_HC', 'Health Canada / Santé Canada', 'Health Canada', 'CA', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.canada.ca/en/health-canada.html', 'Federal department responsible for national health and drug approvals in Canada'),
('AU_TGA', 'Therapeutic Goods Administration', 'TGA', 'AU', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.tga.gov.au', 'Australian government agency regulating therapeutic goods and clinical evaluations'),
('BR_ANVISA', 'Agência Nacional de Vigilância Sanitária', 'ANVISA', 'BR', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.gov.br/anvisa', 'Brazilian regulatory agency overseeing sanitary and pharmaceutical surveillance'),
('CN_NMPA', 'National Medical Products Administration', 'NMPA', 'CN', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.nmpa.gov.cn', 'Chinese national agency regulating drugs, medical devices, and cosmetics'),
('IN_CDSCO', 'Central Drugs Standard Control Organization', 'CDSCO', 'IN', 'NATIONAL_COMPETENT_AUTHORITY', 'https://cdsco.gov.in', 'National regulatory authority for pharmaceuticals in India'),
('CH_SWISSMEDIC', 'Swiss Agency for Therapeutic Products', 'Swissmedic', 'CH', 'NATIONAL_COMPETENT_AUTHORITY', 'https://www.swissmedic.ch', 'Swiss surveillance authority for medicines and medical devices')
ON CONFLICT DO NOTHING;

-- 16. Seed Standard Regulatory Pathways
INSERT INTO public.regulatory_pathways (pathway_code, pathway_name, jurisdiction_code, product_type, typical_timeline_months, description) VALUES
('US_ANDA', 'Abbreviated New Drug Application (ANDA)', 'US', 'GENERIC_DRUG', 10, 'Application for a generic drug product for an approved reference listed drug under 505(j)'),
('US_NDA_505B2', '505(b)(2) New Drug Application', 'US', 'HYBRID_GENERIC', 12, 'New Drug Application containing full reports of investigations with reliance on published literature'),
('US_NDA', 'New Drug Application (NDA 505b1)', 'US', 'INNOVATOR_DRUG', 12, 'Formal proposal for the FDA to approve a new pharmaceutical for commercial sale'),
('EU_CENTRALISED', 'Centralised Procedure (CP)', 'EU', 'ALL', 14, 'Single marketing authorization application valid throughout all EU/EEA member states via EMA'),
('EU_DECENTRALISED', 'Decentralised Procedure (DCP)', 'EU', 'GENERIC_DRUG', 10, 'Simultaneous application in several EU countries for products not yet authorized'),
('EU_MRP', 'Mutual Recognition Procedure (MRP)', 'EU', 'GENERIC_DRUG', 6, 'Mutual recognition of an existing national marketing authorization in other EU member states'),
('UK_PL', 'UK Product Licence (National)', 'UK', 'GENERIC_DRUG', 9, 'MHRA national marketing authorization procedure for Great Britain/UK')
ON CONFLICT DO NOTHING;

-- 17. Seed Canonical Permissions for Step 13
INSERT INTO public.permissions (resource, action, code, name, category, description) VALUES
('regulatory', 'read', 'regulatory.read', 'View Regulatory Intelligence', 'Regulatory', 'Can view regulatory intelligence records, authorities, and statuses'),
('regulatory', 'create', 'regulatory.create', 'Create Regulatory Records', 'Regulatory', 'Can create regulatory records and source datasets'),
('regulatory', 'update', 'regulatory.update', 'Update Regulatory Records', 'Regulatory', 'Can update regulatory information and statuses'),
('regulatory', 'import', 'regulatory.import', 'Import Regulatory Data', 'Regulatory', 'Can upload and import authorized regulatory files and datasets'),
('regulatory', 'match', 'regulatory.match', 'Match Regulatory Entities', 'Regulatory', 'Can match and confirm regulatory records to Product Master'),
('regulatory', 'review', 'regulatory.review', 'Review Regulatory Conflicts', 'Regulatory', 'Can resolve regulatory data conflicts and candidate reviews'),
('regulatory', 'assessment', 'regulatory.assessment', 'Create Regulatory Assessments', 'Regulatory', 'Can generate and finalize regulatory assessments and snapshots'),
('regulatory', 'risk', 'regulatory.risk', 'Manage Regulatory Risks', 'Regulatory', 'Can acknowledge and resolve identified regulatory risks'),
('regulatory', 'source', 'regulatory.source', 'Manage Regulatory Sources', 'Regulatory', 'Can configure regulatory sources, licenses, and providers'),
('regulatory', 'export', 'regulatory.export', 'Export Regulatory Intelligence', 'Regulatory', 'Can export regulatory profiles, reports, and country matrices'),
('regulatory', 'analytics', 'regulatory.analytics', 'View Regulatory Analytics', 'Regulatory', 'Can view global regulatory analytics, readiness scores, and trends'),
('regulatory', 'admin', 'regulatory.admin', 'Administer Regulatory System', 'Regulatory', 'Full administrative authority over regulatory pathways, rules, and configuration')
ON CONFLICT (resource, action) DO UPDATE SET 
code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description;

-- Grant permissions to Super Administrator role if it exists
DO $$
DECLARE
    super_admin_role_id UUID;
BEGIN
    SELECT id INTO super_admin_role_id FROM public.roles WHERE code = 'SUPER_ADMIN' LIMIT 1;
    IF super_admin_role_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT super_admin_role_id, p.id
        FROM public.permissions p
        WHERE p.resource = 'regulatory'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 18. Enable Row-Level Security (RLS) on Tenant Tables
ALTER TABLE public.regulatory_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_product_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_data_quality_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_analysis_snapshots ENABLE ROW LEVEL SECURITY;

-- 19. Create Tenant Isolation Policies (Using public.get_auth_user_organization_id())
DO $$
BEGIN
    -- Sources
    DROP POLICY IF EXISTS reg_sources_tenant_policy ON public.regulatory_sources;
    CREATE POLICY reg_sources_tenant_policy ON public.regulatory_sources
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Datasets
    DROP POLICY IF EXISTS reg_datasets_tenant_policy ON public.regulatory_datasets;
    CREATE POLICY reg_datasets_tenant_policy ON public.regulatory_datasets
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Dataset Versions
    DROP POLICY IF EXISTS reg_versions_tenant_policy ON public.regulatory_dataset_versions;
    CREATE POLICY reg_versions_tenant_policy ON public.regulatory_dataset_versions
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Records
    DROP POLICY IF EXISTS reg_records_tenant_policy ON public.regulatory_records;
    CREATE POLICY reg_records_tenant_policy ON public.regulatory_records
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Product Matches
    DROP POLICY IF EXISTS reg_matches_tenant_policy ON public.regulatory_product_matches;
    CREATE POLICY reg_matches_tenant_policy ON public.regulatory_product_matches
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Status History
    DROP POLICY IF EXISTS reg_history_tenant_policy ON public.regulatory_status_history;
    CREATE POLICY reg_history_tenant_policy ON public.regulatory_status_history
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Events
    DROP POLICY IF EXISTS reg_events_tenant_policy ON public.regulatory_events;
    CREATE POLICY reg_events_tenant_policy ON public.regulatory_events
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Assessments
    DROP POLICY IF EXISTS reg_assessments_tenant_policy ON public.regulatory_assessments;
    CREATE POLICY reg_assessments_tenant_policy ON public.regulatory_assessments
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Risks
    DROP POLICY IF EXISTS reg_risks_tenant_policy ON public.regulatory_risks;
    CREATE POLICY reg_risks_tenant_policy ON public.regulatory_risks
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Data Quality Results
    DROP POLICY IF EXISTS reg_dq_tenant_policy ON public.regulatory_data_quality_results;
    CREATE POLICY reg_dq_tenant_policy ON public.regulatory_data_quality_results
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());

    -- Snapshots
    DROP POLICY IF EXISTS reg_snapshots_tenant_policy ON public.regulatory_analysis_snapshots;
    CREATE POLICY reg_snapshots_tenant_policy ON public.regulatory_analysis_snapshots
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
END $$;
