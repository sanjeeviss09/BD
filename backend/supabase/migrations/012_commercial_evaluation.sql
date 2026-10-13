-- ============================================================================
-- Migration: 012_commercial_evaluation.sql
-- Description: Step 18 Commercial Evaluation Engine Domain
-- Safe, Idempotent, Production-Grade, Tenant-Isolated Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Core Commercial Evaluations Table
CREATE TABLE IF NOT EXISTS public.commercial_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    evaluation_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    rfq_id UUID REFERENCES public.rfqs(id) ON DELETE SET NULL,
    rfq_line_item_id UUID REFERENCES public.rfq_line_items(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    production_feasibility_assessment_id UUID, -- For Step 15 link
    market_analysis_snapshot_id UUID, -- Step 9/11 link
    regulatory_assessment_id UUID, -- Step 13 link
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
    commercial_recommendation VARCHAR(50) CHECK (commercial_recommendation IN (
        'ATTRACTIVE',
        'CONDITIONALLY_ATTRACTIVE',
        'BORDERLINE',
        'UNATTRACTIVE',
        'INSUFFICIENT_DATA'
    )),
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

-- 2. Commercial Evaluation Versions (Immutable snapshots upon finalization)
CREATE TABLE IF NOT EXISTS public.commercial_evaluation_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    economics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    assumptions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    scenarios_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivities_snapshot JSONB DEFAULT '[]'::jsonb,
    risks_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    provenance_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculation_rule_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    is_immutable BOOLEAN NOT NULL DEFAULT FALSE,
    change_summary TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluation_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_comm_eval_ver_eval ON public.commercial_evaluation_versions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_comm_eval_ver_org ON public.commercial_evaluation_versions(organization_id);

-- 3. Commercial Cost Components Breakdown
CREATE TABLE IF NOT EXISTS public.commercial_cost_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    component_type VARCHAR(100) NOT NULL CHECK (component_type IN (
        'API_ACTIVE_SUBSTANCE',
        'EXCIPIENTS',
        'PRIMARY_PACKAGING',
        'SECONDARY_PACKAGING',
        'MANUFACTURING_CONVERSION',
        'DIRECT_LABOUR',
        'FACILITY_OVERHEAD',
        'QA_QC_TESTING',
        'REGULATORY_MAINTENANCE',
        'INBOUND_LOGISTICS',
        'OUTBOUND_FREIGHT',
        'CARGO_INSURANCE',
        'CUSTOMS_DUTIES_TARIFFS',
        'COMMERCIAL_COMMISSION',
        'OTHER_COST'
    )),
    description TEXT,
    cost_per_unit NUMERIC(15,4),
    quantity_basis NUMERIC(15,4),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    fx_rate NUMERIC(12,6) NOT NULL DEFAULT 1.0,
    total_cost NUMERIC(15,2),
    source_classification VARCHAR(50) NOT NULL DEFAULT 'CONFIGURED_ASSUMPTION' CHECK (source_classification IN (
        'CUSTOMER_PROVIDED',
        'INTERNAL_USER_INPUT',
        'AUTHORIZED_SOURCE',
        'PRODUCT_MASTER_VALUE',
        'MARKET_INTELLIGENCE_VALUE',
        'REGULATORY_VALUE',
        'PRODUCTION_FEASIBILITY_VALUE',
        'CONFIGURED_ASSUMPTION',
        'CALCULATED_VALUE',
        'SYSTEM_DERIVED_VALUE',
        'UNKNOWN/NOT_AVAILABLE'
    )),
    source_reference TEXT,
    is_assumption BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from DATE,
    valid_to DATE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_costs_eval ON public.commercial_cost_components(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_comm_costs_org ON public.commercial_cost_components(organization_id);
CREATE INDEX IF NOT EXISTS idx_comm_costs_type ON public.commercial_cost_components(component_type);

-- 4. Commercial Pricing & Requirement Inputs
CREATE TABLE IF NOT EXISTS public.commercial_pricing_inputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    quantity NUMERIC(15,2) NOT NULL,
    quantity_unit VARCHAR(50) NOT NULL DEFAULT 'Packs',
    customer_target_price NUMERIC(15,4),
    internal_proposed_price NUMERIC(15,4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_terms VARCHAR(100) DEFAULT 'NET_60',
    incoterm VARCHAR(50) DEFAULT 'CIF',
    delivery_term VARCHAR(100),
    contract_duration_months INTEGER DEFAULT 12,
    annual_forecast_quantity NUMERIC(15,2),
    minimum_order_quantity NUMERIC(15,2),
    price_source_classification VARCHAR(50) NOT NULL DEFAULT 'INTERNAL_USER_INPUT',
    price_source_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_pricing_eval ON public.commercial_pricing_inputs(evaluation_id);

-- 5. Commercial Scenarios (Base, Upside, Downside, Customer Target, Custom)
CREATE TABLE IF NOT EXISTS public.commercial_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scenario_type VARCHAR(50) NOT NULL CHECK (scenario_type IN (
        'BASE_CASE',
        'UPSIDE_CASE',
        'DOWNSIDE_CASE',
        'CUSTOMER_TARGET_CASE',
        'INTERNAL_OFFER_CASE',
        'CUSTOM_SCENARIO'
    )),
    scenario_name VARCHAR(100) NOT NULL,
    quantity NUMERIC(15,2),
    unit_price NUMERIC(15,4),
    unit_cost NUMERIC(15,4),
    calculated_revenue NUMERIC(15,2),
    calculated_total_cost NUMERIC(15,2),
    calculated_gross_profit NUMERIC(15,2),
    calculated_gross_margin_pct NUMERIC(7,2),
    assumptions_notes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(evaluation_id, scenario_type)
);

CREATE INDEX IF NOT EXISTS idx_comm_scenarios_eval ON public.commercial_scenarios(evaluation_id);

-- 6. Commercial Decision-Support Risks
CREATE TABLE IF NOT EXISTS public.commercial_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    risk_code VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    explanation TEXT NOT NULL,
    mitigation_suggestion TEXT,
    status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'MITIGATED', 'ACCEPTED', 'RESOLVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_risks_eval ON public.commercial_risks(evaluation_id);

-- 7. Commercial Assumption Register
CREATE TABLE IF NOT EXISTS public.commercial_assumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    assumption_key VARCHAR(100) NOT NULL,
    assumption_label VARCHAR(255) NOT NULL,
    assumption_value TEXT NOT NULL,
    unit VARCHAR(50),
    currency VARCHAR(10),
    source_type VARCHAR(50) DEFAULT 'INTERNAL_USER_INPUT',
    valid_from DATE,
    valid_to DATE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_assumptions_eval ON public.commercial_assumptions(evaluation_id);

-- 8. Immutable Decision Snapshots
CREATE TABLE IF NOT EXISTS public.commercial_decision_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE RESTRICT,
    evaluation_version_id UUID REFERENCES public.commercial_evaluation_versions(id) ON DELETE RESTRICT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    snapshot_hash VARCHAR(255) NOT NULL,
    complete_payload JSONB NOT NULL,
    decision_outcome VARCHAR(50) CHECK (decision_outcome IN (
        'APPROVED_FOR_OFFER',
        'COUNTER_OFFER_RECOMMENDED',
        'DISQUALIFIED',
        'REFERRED_TO_EXECUTIVE'
    )),
    decision_reasoning TEXT,
    decided_by UUID,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_snapshots_eval ON public.commercial_decision_snapshots(evaluation_id);

-- 9. Commercial Source Lineage Links
CREATE TABLE IF NOT EXISTS public.commercial_source_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES public.commercial_evaluations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'RFQ_RECORD',
        'MARKET_ANALYSIS_SNAPSHOT',
        'REGULATORY_ASSESSMENT',
        'PRODUCTION_FEASIBILITY_ASSESSMENT',
        'PRODUCT_MASTER',
        'DOCUMENT_COST_SHEET'
    )),
    source_id UUID,
    source_version_id UUID,
    source_reference TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comm_source_links_eval ON public.commercial_source_links(evaluation_id);

-- 10. Updated_At Triggers
CREATE OR REPLACE FUNCTION update_commercial_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER update_comm_eval_modtime BEFORE UPDATE ON public.commercial_evaluations FOR EACH ROW EXECUTE FUNCTION update_commercial_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_comm_costs_modtime BEFORE UPDATE ON public.commercial_cost_components FOR EACH ROW EXECUTE FUNCTION update_commercial_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER update_comm_pricing_modtime BEFORE UPDATE ON public.commercial_pricing_inputs FOR EACH ROW EXECUTE FUNCTION update_commercial_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. Seed Canonical Permissions (Idempotent)
INSERT INTO public.permissions (resource, action, code, name, description, category)
VALUES
    ('commercial_evaluation', 'read', 'commercial_evaluation.read', 'View Commercial Evaluations', 'View commercial evaluations, costing, and margin analysis', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'create', 'commercial_evaluation.create', 'Create Commercial Evaluation', 'Create new commercial evaluations from RFQs or products', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'update', 'commercial_evaluation.update', 'Update Commercial Evaluation', 'Modify commercial evaluation parameters and line items', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'cost', 'commercial_evaluation.cost', 'Manage Commercial Costing', 'Add and update cost components and assumptions', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'price', 'commercial_evaluation.price', 'Manage Commercial Pricing', 'Set target and proposed selling prices', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'scenario', 'commercial_evaluation.scenario', 'Run Commercial Scenarios', 'Run scenario comparisons and sensitivity analysis', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'finalize', 'commercial_evaluation.finalize', 'Finalize Commercial Evaluation', 'Lock and finalize commercial evaluation versions into immutable decision snapshots', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'export', 'commercial_evaluation.export', 'Export Commercial Dossier', 'Export commercial evaluation models and Excel reports', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'analytics', 'commercial_evaluation.analytics', 'View Commercial Analytics', 'Access cross-evaluation commercial intelligence KPIs', 'COMMERCIAL_EVALUATION'),
    ('commercial_evaluation', 'admin', 'commercial_evaluation.admin', 'Administer Commercial Engine', 'Configure commercial rules, thresholds, and templates', 'COMMERCIAL_EVALUATION')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant permissions to Admin / Commercial Roles
DO $$
DECLARE
    admin_role_id UUID;
    perm RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE code = 'SUPER_ADMIN' OR name = 'Administrator' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
        FOR perm IN SELECT id FROM public.permissions WHERE category = 'COMMERCIAL_EVALUATION' LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- 12. Enable Row Level Security (RLS) & Tenant Isolation
ALTER TABLE public.commercial_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_evaluation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_cost_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_pricing_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_decision_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_source_links ENABLE ROW LEVEL SECURITY;

-- Hardened RLS Policies using public.get_auth_user_organization_id()
DO $$ BEGIN
    CREATE POLICY "comm_eval_tenant_isolation" ON public.commercial_evaluations
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_eval_versions_tenant_isolation" ON public.commercial_evaluation_versions
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_costs_tenant_isolation" ON public.commercial_cost_components
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_pricing_tenant_isolation" ON public.commercial_pricing_inputs
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_scenarios_tenant_isolation" ON public.commercial_scenarios
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_risks_tenant_isolation" ON public.commercial_risks
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_assumptions_tenant_isolation" ON public.commercial_assumptions
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_snapshots_tenant_isolation" ON public.commercial_decision_snapshots
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "comm_sources_tenant_isolation" ON public.commercial_source_links
        FOR ALL USING (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
