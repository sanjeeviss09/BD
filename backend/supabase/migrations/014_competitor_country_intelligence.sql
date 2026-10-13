-- Step 14: Competitor & Country Intelligence Module
-- Idempotent, re-runnable, and production-safe migration

-- 1. Competitor Relationships
CREATE TABLE IF NOT EXISTS public.competitor_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- The Subject (what we are analyzing)
    subject_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'MOLECULE', 'BRAND', 'THERAPEUTIC_CATEGORY'
    subject_id UUID NOT NULL, -- Reusing canonical masters (e.g. products.id, molecules.id)
    
    -- The Competitor (who is competing)
    competitor_type VARCHAR(50) NOT NULL, -- 'PRODUCT', 'COMPANY', 'MOLECULE'
    competitor_entity_id UUID NOT NULL, -- Reusing canonical masters
    
    -- Relationship Details
    relationship_type VARCHAR(100) NOT NULL, -- 'SAME_MOLECULE', 'SAME_THERAPEUTIC_CLASS', 'SAME_INDICATION', 'DIRECT_BRANDED_COMPETITOR', 'GENERIC_COMPETITOR', 'BIOSIMILAR_COMPETITOR', 'THERAPEUTIC_SUBSTITUTE'
    relationship_strength NUMERIC(5,2), -- Configurable weight/confidence
    
    -- Evidence
    evidence_type VARCHAR(100), -- 'MARKET_OBSERVATION', 'REGULATORY_RECORD', 'MANUAL_OVERRIDE', 'COMPANY_FILING'
    evidence_source_id UUID, -- Reference to source_records, market_observations, etc.
    confidence_score NUMERIC(5,2),
    
    -- Temporal Validity
    effective_from DATE,
    effective_to DATE,
    
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for competitor relationships
CREATE INDEX IF NOT EXISTS idx_comp_rel_org ON public.competitor_relationships(organization_id);
CREATE INDEX IF NOT EXISTS idx_comp_rel_subject ON public.competitor_relationships(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_comp_rel_competitor ON public.competitor_relationships(competitor_type, competitor_entity_id);

-- 2. Country Market Profiles (Country Intelligence Layer)
CREATE TABLE IF NOT EXISTS public.country_market_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    country_id UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
    
    -- Subject Scope (Optional, can be broad country profile or product-specific)
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    molecule_id UUID REFERENCES public.molecules(id) ON DELETE CASCADE,
    
    -- Source reference
    dataset_version_id UUID REFERENCES public.market_dataset_versions(id) ON DELETE SET NULL,
    reporting_period DATE,
    
    -- Dimensions
    market_sales NUMERIC(20, 4),
    market_volume NUMERIC(20, 4),
    growth_pct NUMERIC(10, 4),
    cagr_pct NUMERIC(10, 4),
    
    competitor_count INT DEFAULT 0,
    hhi_value NUMERIC(10, 4),
    
    -- Status Indicators
    regulatory_status VARCHAR(100),
    market_access_status VARCHAR(100),
    patent_exclusivity_status VARCHAR(100),
    
    -- Data Quality & Confidence
    data_completeness_score NUMERIC(5,2),
    confidence_score NUMERIC(5,2),
    opportunity_score NUMERIC(5,2),
    recommendation VARCHAR(100),
    
    created_by UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for country market profiles
CREATE INDEX IF NOT EXISTS idx_country_prof_org ON public.country_market_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_country_prof_country ON public.country_market_profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_country_prof_product ON public.country_market_profiles(product_id);
CREATE INDEX IF NOT EXISTS idx_country_prof_molecule ON public.country_market_profiles(molecule_id);
CREATE INDEX IF NOT EXISTS idx_country_prof_dataset ON public.country_market_profiles(dataset_version_id);

-- 3. RLS Tenant Isolation
ALTER TABLE public.competitor_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_market_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "competitor_relationships_tenant_isolation" ON public.competitor_relationships
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "country_market_profiles_tenant_isolation" ON public.country_market_profiles
        FOR ALL USING (organization_id = public.get_auth_user_organization_id())
        WITH CHECK (organization_id = public.get_auth_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Permissions for Competitor & Country Intelligence
INSERT INTO public.permissions (resource, action, code, name, description, category)
VALUES
    ('intelligence', 'competitor.read', 'intelligence.competitor.read', 'Read Competitor Intelligence', 'Access competitor relationships and analysis', 'INTELLIGENCE'),
    ('intelligence', 'competitor.manage', 'intelligence.competitor.manage', 'Manage Competitor Intelligence', 'Create manual competitor overrides and configurations', 'INTELLIGENCE'),
    ('intelligence', 'country.read', 'intelligence.country.read', 'Read Country Intelligence', 'Access country profiles and attractiveness scores', 'INTELLIGENCE'),
    ('intelligence', 'country.manage', 'intelligence.country.manage', 'Manage Country Intelligence', 'Manage country scoring weights and configurations', 'INTELLIGENCE')
ON CONFLICT (resource, action) DO UPDATE
SET code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Link permissions to SUPER_ADMIN role
DO $$
DECLARE
    admin_role_id UUID;
    perm RECORD;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE code = 'SUPER_ADMIN' OR name = 'Super Administrator' LIMIT 1;
    IF admin_role_id IS NOT NULL THEN
        FOR perm IN SELECT id FROM public.permissions WHERE category = 'INTELLIGENCE' LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;
