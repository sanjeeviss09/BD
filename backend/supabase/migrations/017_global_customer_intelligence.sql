-- Step 16: Global Customer Intelligence Module

-- 1. Company Master
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    aliases JSONB DEFAULT '[]'::jsonb,
    website VARCHAR(255),
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    company_type VARCHAR(100),
    parent_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    source VARCHAR(100),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- 2. Customer Candidates
CREATE TABLE IF NOT EXISTS public.customer_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    subject_type VARCHAR(50) NOT NULL, -- PRODUCT, MOLECULE
    subject_id UUID NOT NULL,
    country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    customer_type VARCHAR(100),
    relationship_type VARCHAR(100),
    candidate_status VARCHAR(50) DEFAULT 'DISCOVERED',
    fit_score INT,
    fit_level VARCHAR(50),
    confidence_score INT,
    discovery_source VARCHAR(100),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, company_id, subject_type, subject_id, country_id)
);

-- 3. Customer Evidence
CREATE TABLE IF NOT EXISTS public.customer_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES customer_candidates(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL, -- MARKET, REGULATORY, PIPELINE, SIGNAL, PRODUCTION
    reason TEXT NOT NULL,
    source_id UUID,
    dataset_id UUID,
    source_record_id VARCHAR(255),
    confidence_level VARCHAR(50),
    retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Customer Signals
CREATE TABLE IF NOT EXISTS public.customer_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    signal_type VARCHAR(100) NOT NULL,
    evidence TEXT NOT NULL,
    source_id UUID,
    confidence_level VARCHAR(50),
    signal_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Customer Fit Configurations
CREATE TABLE IF NOT EXISTS public.customer_fit_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    dimensions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Customer Fit Snapshots
CREATE TABLE IF NOT EXISTS public.customer_fit_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES customer_candidates(id) ON DELETE CASCADE,
    configuration_id UUID REFERENCES customer_fit_configurations(id) ON DELETE SET NULL,
    score INT NOT NULL,
    fit_level VARCHAR(50) NOT NULL,
    dimensions_scores JSONB NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_fit_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_fit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization companies" ON public.companies FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization companies" ON public.companies FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can update their organization companies" ON public.companies FOR UPDATE USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "Users can view their organization candidates" ON public.customer_candidates FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization candidates" ON public.customer_candidates FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can update their organization candidates" ON public.customer_candidates FOR UPDATE USING (organization_id = get_auth_user_organization_id());

CREATE POLICY "Users can view their organization evidence" ON public.customer_evidence FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization evidence" ON public.customer_evidence FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());

CREATE POLICY "Users can view their organization signals" ON public.customer_signals FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization signals" ON public.customer_signals FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());

CREATE POLICY "Users can view their organization fit configurations" ON public.customer_fit_configurations FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization fit configurations" ON public.customer_fit_configurations FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());

CREATE POLICY "Users can view their organization fit snapshots" ON public.customer_fit_snapshots FOR SELECT USING (organization_id = get_auth_user_organization_id());
CREATE POLICY "Users can insert their organization fit snapshots" ON public.customer_fit_snapshots FOR INSERT WITH CHECK (organization_id = get_auth_user_organization_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_org ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_candidates_org_company ON public.customer_candidates(organization_id, company_id);
CREATE INDEX IF NOT EXISTS idx_customer_candidates_subject ON public.customer_candidates(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_customer_evidence_candidate ON public.customer_evidence(candidate_id);
CREATE INDEX IF NOT EXISTS idx_customer_signals_company ON public.customer_signals(company_id);

-- SEED Permissions for RBAC
INSERT INTO permissions (code, name, description, category, resource, action)
VALUES 
('customer_intelligence.view', 'View Customer Intelligence', 'Can view customer intelligence data', 'Customer Intelligence', 'customer_intelligence', 'read'),
('customer_intelligence.discover', 'Discover Customers', 'Can run customer discovery analysis', 'Customer Intelligence', 'customer_intelligence', 'create'),
('customer_intelligence.qualify', 'Qualify Customers', 'Can qualify customer candidates', 'Customer Intelligence', 'customer_intelligence', 'update'),
('customer_intelligence.shortlist', 'Shortlist Customers', 'Can add customers to shortlist', 'Customer Intelligence', 'customer_intelligence', 'update'),
('customer_intelligence.manage', 'Manage Customers', 'Can manage all aspects of customer intelligence', 'Customer Intelligence', 'customer_intelligence', 'manage')
ON CONFLICT (resource, action) DO NOTHING;

DO $$
DECLARE
    role_record RECORD;
BEGIN
    FOR role_record IN SELECT * FROM roles WHERE code IN ('SYS_ADMIN', 'ORG_ADMIN', 'BD_MANAGER', 'BD_USER')
    LOOP
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_record.id, id FROM permissions WHERE category = 'Customer Intelligence'
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
END $$;
