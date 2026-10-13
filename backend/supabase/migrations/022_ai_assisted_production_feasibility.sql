-- ============================================================================
-- Migration: 022_ai_assisted_production_feasibility.sql
-- Description: AI-Assisted Production Feasibility & Commercial Evaluation Engine
-- Features:
--   1. Centralized AI Provider Configuration & Server-Side Encrypted Credentials
--   2. Facility Multi-Sheet Document Import Sessions & Versioning
--   3. Production Feasibility Assessment Scenarios (Base, Conservative, Optimistic, Target-Price)
--   4. Versioned Production Cost Breakdown & CDMO Economics Ledger
--   5. Immutable Final Decision Snapshots & Audit Governance
-- Safe, Additive, Idempotent, Production-Grade Schema with RLS
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. AI Provider Configurations Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_provider_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider_name VARCHAR(50) NOT NULL CHECK (provider_name IN ('OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'CUSTOM_LLM', 'LOCAL')),
    provider_display_name VARCHAR(100) NOT NULL,
    api_endpoint VARCHAR(255),
    api_key_ciphertext TEXT,
    api_key_masked VARCHAR(50),
    model_name VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_output_tokens INT DEFAULT 4000,
    temperature NUMERIC(3,2) DEFAULT 0.20,
    timeout_seconds INT DEFAULT 60,
    use_case_permissions JSONB DEFAULT '["FEASIBILITY_EXPLANATION", "BOTTLENECK_ANALYSIS", "RISK_IDENTIFICATION", "COMMERCIAL_ANALYSIS", "SCENARIO_COMPARISON", "EXECUTIVE_REPORT"]'::jsonb,
    last_test_status VARCHAR(50) DEFAULT 'NOT_TESTED' CHECK (last_test_status IN ('NOT_TESTED', 'SUCCESS', 'FAILED')),
    last_test_message TEXT,
    last_test_at TIMESTAMP WITH TIME ZONE,
    last_successful_request_at TIMESTAMP WITH TIME ZONE,
    usage_count INT DEFAULT 0,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, provider_name, model_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_org ON public.ai_provider_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_provider_default ON public.ai_provider_configurations(organization_id, is_default) WHERE is_default = TRUE;

-- ----------------------------------------------------------------------------
-- 2. Facility Import Sessions (Excel / Word Multi-Sheet Data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.facility_import_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(20) NOT NULL DEFAULT 'XLSX' CHECK (file_format IN ('XLSX', 'XLS', 'CSV', 'DOCX', 'DOC')),
    file_size_bytes BIGINT DEFAULT 0,
    total_facilities_extracted INT DEFAULT 0,
    total_lines_extracted INT DEFAULT 0,
    total_equipment_extracted INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PREVIEW' CHECK (status IN ('PREVIEW', 'VALIDATED', 'COMMITTED', 'REJECTED')),
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    mapping_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status VARCHAR(50) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FLAGGED')),
    verification_notes TEXT,
    imported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fac_import_org ON public.facility_import_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_fac_import_status ON public.facility_import_sessions(organization_id, status);

-- ----------------------------------------------------------------------------
-- 3. Production Assessment Scenarios (Base, Conservative, Optimistic, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_assessment_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    scenario_key VARCHAR(50) NOT NULL CHECK (scenario_key IN (
        'BASE_CASE',
        'CONSERVATIVE_CASE',
        'OPTIMISTIC_CASE',
        'TARGET_PRICE_CASE',
        'TARGET_MARGIN_CASE',
        'ALT_FACILITY_CASE',
        'ALT_VOLUME_CASE',
        'CUSTOM_SCENARIO'
    )),
    scenario_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(15,2) NOT NULL,
    quantity_unit VARCHAR(50) DEFAULT 'UNITS',
    batch_size NUMERIC(15,2),
    estimated_batches NUMERIC(10,2),
    expected_yield_pct NUMERIC(5,2) DEFAULT 95.0,
    facility_id UUID REFERENCES public.production_facilities(id) ON DELETE SET NULL,
    production_line_id UUID REFERENCES public.production_lines(id) ON DELETE SET NULL,
    total_manufacturing_cost NUMERIC(15,2),
    unit_cost NUMERIC(15,4),
    cost_per_batch NUMERIC(15,2),
    proposed_unit_price NUMERIC(15,4),
    projected_revenue NUMERIC(15,2),
    projected_gross_profit NUMERIC(15,2),
    gross_margin_pct NUMERIC(5,2),
    break_even_quantity NUMERIC(15,2),
    break_even_unit_price NUMERIC(15,4),
    target_margin_price NUMERIC(15,4),
    lead_time_days INT,
    feasibility_status VARCHAR(50) DEFAULT 'FEASIBLE',
    is_base_case BOOLEAN DEFAULT FALSE,
    assumptions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(feasibility_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS idx_prod_scenarios_org ON public.production_assessment_scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_scenarios_feas ON public.production_assessment_scenarios(feasibility_id);

-- ----------------------------------------------------------------------------
-- 4. Production Cost Breakdown (Granular CDMO Cost Model)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_cost_breakdowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    component_type VARCHAR(100) NOT NULL CHECK (component_type IN (
        'RAW_MATERIALS_API',
        'EXCIPIENTS',
        'PACKAGING_PRIMARY',
        'PACKAGING_SECONDARY',
        'DIRECT_LABOR',
        'EQUIPMENT_USAGE',
        'UTILITIES',
        'QC_QA_RELEASE',
        'ANALYTICAL_TESTING',
        'CLEANING_CHANGEOVER',
        'TECH_TRANSFER_DEV',
        'YIELD_SCRAP_LOSS',
        'LOGISTICS_FREIGHT',
        'DUTIES_TAXES',
        'OVERHEAD_ALLOCATION',
        'CAPITAL_TOOLING',
        'CONTINGENCY'
    )),
    description TEXT,
    cost_type VARCHAR(50) DEFAULT 'VARIABLE' CHECK (cost_type IN ('FIXED', 'VARIABLE', 'PER_BATCH', 'PER_UNIT')),
    cost_per_unit NUMERIC(15,4),
    quantity_basis NUMERIC(15,2),
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    fx_rate NUMERIC(10,4) DEFAULT 1.0,
    source_basis VARCHAR(100) DEFAULT 'CONFIGURED_STANDARD',
    is_estimate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_costs_org ON public.production_cost_breakdowns(organization_id);
CREATE INDEX IF NOT EXISTS idx_prod_costs_feas ON public.production_cost_breakdowns(feasibility_id);

-- ----------------------------------------------------------------------------
-- 5. Assessment Decision Snapshots (Immutable Final Audit Record)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessment_decision_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feasibility_id UUID NOT NULL REFERENCES public.production_feasibility(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    decision_outcome VARCHAR(50) NOT NULL CHECK (decision_outcome IN ('APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'NEEDS_DATA', 'ON_HOLD')),
    reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewer_name VARCHAR(255),
    reviewer_role VARCHAR(100),
    reviewer_comments TEXT,
    conditions TEXT[] DEFAULT '{}',
    inputs_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    facility_version_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculations_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_analysis_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    scenarios_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_immutable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(feasibility_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_decision_snap_org ON public.assessment_decision_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_decision_snap_feas ON public.assessment_decision_snapshots(feasibility_id);

-- ----------------------------------------------------------------------------
-- 6. Enable Row-Level Security (RLS) on all new tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.ai_provider_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_assessment_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_cost_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_decision_snapshots ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. Add Tenant-Isolated RLS Policies
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- AI Provider Configurations
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_provider_configurations' AND policyname = 'ai_provider_org_isolation') THEN
        CREATE POLICY ai_provider_org_isolation ON public.ai_provider_configurations
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Facility Import Sessions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facility_import_sessions' AND policyname = 'fac_import_org_isolation') THEN
        CREATE POLICY fac_import_org_isolation ON public.facility_import_sessions
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Production Assessment Scenarios
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_assessment_scenarios' AND policyname = 'prod_scenarios_org_isolation') THEN
        CREATE POLICY prod_scenarios_org_isolation ON public.production_assessment_scenarios
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Production Cost Breakdowns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_cost_breakdowns' AND policyname = 'prod_costs_org_isolation') THEN
        CREATE POLICY prod_costs_org_isolation ON public.production_cost_breakdowns
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;

    -- Assessment Decision Snapshots
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_decision_snapshots' AND policyname = 'decision_snap_org_isolation') THEN
        CREATE POLICY decision_snap_org_isolation ON public.assessment_decision_snapshots
            FOR ALL USING (organization_id = get_auth_user_organization_id())
            WITH CHECK (organization_id = get_auth_user_organization_id());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 8. Seed Required RBAC Permissions
-- ----------------------------------------------------------------------------
INSERT INTO public.permissions (code, name, module, description)
VALUES 
    ('ai.manage_config', 'Manage AI Configuration', 'AI', 'Configure AI providers, API keys, models, and usage constraints'),
    ('ai.use_assist', 'Use AI Assistant', 'AI', 'Execute grounded AI evaluation queries on production and commercial data'),
    ('production.import_facilities', 'Import Facility Documents', 'Production', 'Upload and import Excel/Word facility definitions into master configuration'),
    ('production.evaluate_commercial', 'Evaluate Commercial Feasibility', 'Production', 'Perform unified production and commercial CDMO evaluations')
ON CONFLICT (code) DO NOTHING;

COMMIT;
