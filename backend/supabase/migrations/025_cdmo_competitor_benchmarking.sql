-- ============================================================================
-- Migration: 025_cdmo_competitor_benchmarking.sql
-- Description: CDMO Feasibility, Competitor Benchmarking & Commercial Decision Intelligence
-- Safety: Additive, Idempotent, RLS-Enforced, Backward-Compatible
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Prerequisite: Commercial Evaluations Table (Step 18 Domain)
CREATE TABLE IF NOT EXISTS public.commercial_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    evaluation_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    rfq_id UUID REFERENCES public.rfqs(id) ON DELETE SET NULL,
    rfq_line_item_id UUID REFERENCES public.rfq_line_items(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    production_feasibility_assessment_id UUID,
    market_analysis_snapshot_id UUID,
    regulatory_assessment_id UUID,
    customer_name VARCHAR(255),
    target_market_country VARCHAR(100) DEFAULT 'US',
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'DATA_COLLECTION',
        'UNDER_EVALUATION',
        'INTERNAL_REVIEW',
        'READY_FOR_DECISION',
        'FINALIZED',
        'SUPERSEDED',
        'ON_HOLD',
        'CANCELLED',
        'CLOSED'
    )),
    version_number INTEGER NOT NULL DEFAULT 1,
    active_version_id UUID,
    owner_id UUID,
    validity_date DATE,
    notes TEXT,
    commercial_recommendation VARCHAR(50),
    commercial_score NUMERIC(5,2),
    score_breakdown JSONB DEFAULT '{}'::jsonb,
    is_finalized BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    finalized_by UUID,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, evaluation_number)
);

CREATE INDEX IF NOT EXISTS idx_comm_eval_org_status ON public.commercial_evaluations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_eval_rfq ON public.commercial_evaluations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_comm_eval_opp ON public.commercial_evaluations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_comm_eval_prod ON public.commercial_evaluations(product_id);

ALTER TABLE public.commercial_evaluations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commercial_evaluations' AND policyname = 'comm_eval_tenant_isolation') THEN
        CREATE POLICY comm_eval_tenant_isolation ON public.commercial_evaluations
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() OR auth_user_id = auth.uid()));
    END IF;
END $$;

-- 1. CDMO Capability Profiles (Verified CDMO manufacturing and commercial capability database)
CREATE TABLE IF NOT EXISTS public.cdmo_capability_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    cdmo_name VARCHAR(255) NOT NULL,
    headquarters_country VARCHAR(100),
    website VARCHAR(255),
    is_axxelent_entity BOOLEAN DEFAULT FALSE,
    
    -- Manufacturing footprint & facilities
    manufacturing_locations JSONB DEFAULT '[]'::jsonb,
    primary_facilities JSONB DEFAULT '[]'::jsonb,
    
    -- Technologies & dosage forms
    dosage_forms JSONB DEFAULT '[]'::jsonb,
    manufacturing_technologies JSONB DEFAULT '[]'::jsonb,
    is_sterile_capable BOOLEAN DEFAULT FALSE,
    is_non_sterile_capable BOOLEAN DEFAULT TRUE,
    
    -- Scale & equipment
    batch_size_ranges JSONB DEFAULT '{}'::jsonb,
    annual_capacity_disclosed VARCHAR(255), -- If unknown, store null or 'Not publicly available'
    capacity_verification_status VARCHAR(50) DEFAULT 'UNKNOWN',
    equipment_platforms JSONB DEFAULT '[]'::jsonb,
    packaging_capabilities JSONB DEFAULT '[]'::jsonb,
    
    -- Quality, Development & Regulatory
    tech_transfer_capabilities JSONB DEFAULT '[]'::jsonb,
    analytical_testing_capabilities JSONB DEFAULT '[]'::jsonb,
    regulatory_approvals JSONB DEFAULT '[]'::jsonb, -- e.g. ["US_FDA", "EU_EMA", "WHO_GMP", "PMDA_JAPAN", "ANVISA"]
    quality_certifications JSONB DEFAULT '[]'::jsonb,
    
    -- Commercial & Market
    published_pricing_available BOOLEAN DEFAULT FALSE,
    published_pricing_notes TEXT DEFAULT 'Not publicly available',
    market_presence_regions JSONB DEFAULT '[]'::jsonb,
    public_strengths JSONB DEFAULT '[]'::jsonb,
    public_limitations JSONB DEFAULT '[]'::jsonb,
    customer_segments_served JSONB DEFAULT '[]'::jsonb,
    
    -- Evidence & Provenance
    evidence_sources JSONB DEFAULT '[]'::jsonb, -- Array of { title, organization, url, date, docRef, verified }
    last_verified_at DATE DEFAULT CURRENT_DATE,
    freshness_status VARCHAR(50) DEFAULT 'CURRENT',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdmo_prof_org ON public.cdmo_capability_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_cdmo_prof_comp ON public.cdmo_capability_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_cdmo_prof_name ON public.cdmo_capability_profiles(organization_id, cdmo_name);

-- 2. CDMO Opportunity Benchmarks (Linked to Commercial Evaluations)
CREATE TABLE IF NOT EXISTS public.cdmo_competitor_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    benchmark_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    
    -- Discovered competitors & classifications
    discovered_competitors JSONB NOT NULL DEFAULT '[]'::jsonb, 
    -- [{ cdmo_name, cdmo_id, classification: 'DIRECT'|'POTENTIAL'|'INDIRECT'|'NON_COMPARABLE', reason, evidenceRef, retrievalDate }]
    
    -- 14 Comparison Categories Matrix
    comparison_matrix JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{ categoryId, categoryName, axxelentAssessment, competitorAssessments: [{ cdmoName, value, position: 'ADVANTAGE'|'PARITY'|'GAP'|'UNKNOWN', evidence, freshness }], missingInfo, explanation }]
    
    -- Dual Scoring Dimensions
    competitive_suitability_score NUMERIC(5,2) DEFAULT 0,
    evidence_completeness_score NUMERIC(5,2) DEFAULT 0,
    scoring_breakdown JSONB DEFAULT '{}'::jsonb,
    
    -- Internal Feasibility Synthesis (From authoritative Production Feasibility Engine)
    axxelent_feasibility_summary JSONB DEFAULT '{}'::jsonb,
    axxelent_confirmed_advantages JSONB DEFAULT '[]'::jsonb,
    competitor_documented_advantages JSONB DEFAULT '[]'::jsonb,
    axxelent_unresolved_gaps JSONB DEFAULT '[]'::jsonb,
    critical_missing_information JSONB DEFAULT '[]'::jsonb,
    
    -- Strategic Recommendation (Proceed / Proceed with Conditions / Hold for Information / Do Not Proceed)
    strategic_recommendation VARCHAR(50) NOT NULL CHECK (strategic_recommendation IN (
        'PROCEED',
        'PROCEED_WITH_CONDITIONS',
        'HOLD_FOR_INFORMATION',
        'DO_NOT_PROCEED'
    )),
    recommendation_rationale TEXT NOT NULL,
    conditions_to_resolve JSONB DEFAULT '[]'::jsonb,
    required_management_actions JSONB DEFAULT '[]'::jsonb,
    
    -- Five Management Questions Answers
    management_questions_answers JSONB DEFAULT '{}'::jsonb,
    
    -- Risk Register
    risk_register JSONB DEFAULT '[]'::jsonb,
    
    -- Action Plan
    action_plan JSONB DEFAULT '[]'::jsonb,
    
    -- Governance, Audit & Human Approval
    ai_model_used VARCHAR(100) DEFAULT 'nvidia/nemotron-3-ultra-550b-a55b',
    scoring_methodology_version VARCHAR(50) DEFAULT 'v1.0-CDMO-DUAL-SCORE',
    cost_calculation_version VARCHAR(50) DEFAULT 'v1.0-DETERMINISTIC',
    is_frozen_snapshot BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    approval_status VARCHAR(50) DEFAULT 'PENDING_REVIEW' CHECK (approval_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CONDITIONAL_APPROVAL')),
    approval_notes TEXT,
    
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evaluation_id, benchmark_version)
);

CREATE INDEX IF NOT EXISTS idx_cdmo_bench_eval ON public.cdmo_competitor_benchmarks(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_cdmo_bench_org ON public.cdmo_competitor_benchmarks(organization_id);

-- 3. CDMO Scoring Configurations (Configurable criteria, weights and rules)
CREATE TABLE IF NOT EXISTS public.cdmo_scoring_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    configuration_name VARCHAR(100) NOT NULL DEFAULT 'Standard Pharmaceutical CDMO Evaluation',
    version_number INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    criteria_weights JSONB NOT NULL DEFAULT '{
        "TECH_FIT": 15,
        "DOSAGE_TECH": 15,
        "FACILITY_EQUIP": 10,
        "PRODUCTION_CAP": 10,
        "BATCH_SIZE": 8,
        "REGULATORY_COV": 12,
        "QUALITY_ANALYT": 8,
        "TECH_TRANSFER": 5,
        "DELIVERY_TIME": 7,
        "COMMERCIAL_ATT": 10
    }'::jsonb,
    
    mandatory_eligibility_rules JSONB NOT NULL DEFAULT '[
        {"rule": "STERILE_CAPABILITY_MATCH", "description": "If product requires sterile processing, facility must have certified aseptic or terminal sterilization"},
        {"rule": "TARGET_MARKET_REGULATORY_APPROVAL", "description": "Target market regulatory agency approval or audit readiness is mandatory"},
        {"rule": "POSITIVE_CONTRIBUTION_MARGIN", "description": "Proposed selling price must deliver positive unit contribution margin"}
    ]'::jsonb,
    
    missing_data_treatment VARCHAR(50) DEFAULT 'EXCLUDE_FROM_PENALTY_RECORD_SEPARATE_COMPLETENESS',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdmo_score_cfg_org ON public.cdmo_scoring_configurations(organization_id);

-- 4. Row Level Security Policies
ALTER TABLE public.cdmo_capability_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdmo_competitor_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdmo_scoring_configurations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cdmo_capability_profiles' AND policyname = 'cdmo_cap_org_isolation') THEN
        CREATE POLICY cdmo_cap_org_isolation ON public.cdmo_capability_profiles
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() OR auth_user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cdmo_competitor_benchmarks' AND policyname = 'cdmo_bench_org_isolation') THEN
        CREATE POLICY cdmo_bench_org_isolation ON public.cdmo_competitor_benchmarks
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() OR auth_user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cdmo_scoring_configurations' AND policyname = 'cdmo_cfg_org_isolation') THEN
        CREATE POLICY cdmo_cfg_org_isolation ON public.cdmo_scoring_configurations
            FOR ALL USING (organization_id = (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() OR auth_user_id = auth.uid()));
    END IF;
END $$;

-- 5. Seed RBAC Permissions for CDMO Competitor Benchmarking
INSERT INTO public.permissions (code, name, module, description)
VALUES 
    ('commercial.benchmarking_view', 'View Competitor Benchmarking', 'COMMERCIAL', 'View CDMO capability profiles, competitor landscape, and 14-point comparison matrices'),
    ('commercial.benchmarking_execute', 'Execute CDMO Benchmark', 'COMMERCIAL', 'Execute competitor discovery, AI evidence retrieval, and deterministic suitability scoring'),
    ('commercial.decision_report_export', 'Export Decision Intelligence Report', 'COMMERCIAL', 'Generate and download the 11-section executive commercial report and Sheet 1 Excel summary'),
    ('commercial.decision_approval', 'Approve Strategic Decision', 'COMMERCIAL', 'Provide authorized human review and sign-off on Commercial Decision outcomes')
ON CONFLICT (code) DO NOTHING;
